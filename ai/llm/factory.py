"""LLM 라우팅 팩토리 — 작업 유형별 Provider 선택 (쿼터 이원화).

- 분류(Intent) 등 가볍고 잦은 호출 → Groq (초고속)
- 파싱/요약 등 품질 중요 호출     → Gemini
상세: ../../docs/07_AI_SYSTEM.md
"""
import asyncio
from enum import Enum
import logging
import os
from typing import Any, Awaitable, Callable, Type

from ai.llm.base import (
    LLMProvider,
    LLMError,
    LLMModelUnavailableError,
    LLMTimeoutError,
    LLMTransientError,
    T,
)
from ai.llm.gemini import GeminiProvider
from ai.llm.groq import GroqProvider

logger = logging.getLogger(__name__)

class Task(str, Enum):
    CLASSIFY = "classify"   # → Groq
    GENERATE = "generate"   # → Gemini (fallback to Groq)

class FallbackProvider(LLMProvider):
    """Gemini 로 묻고, 안 되면 Groq 에 묻는다. 그리고 흔들림에는 한 번 더 묻는다.

    예전에는 층이 하나였다 — 주 Provider 가 실패하면 곧바로 보조로 넘기고, 보조가
    실패하면 그것으로 끝. 그런데 실제로 본 실패의 대부분은 "잘못한 것이 없는데 실패"
    였다(503 high demand · 타임아웃). 그런 실패는 잠깐 뒤 다시 물으면 대개 답한다.
    한 번도 다시 묻지 않고 사용자에게 오류를 보내고 있었다.

    무엇을 다시 묻고 무엇을 넘길지는 예외의 이름이 정한다:

      LLMTransientError       503 처럼 곧바로 돌아온 실패 → 같은 곳에 한 번 더 (짧게 쉬고)
      LLMTimeoutError         이미 제한 시간을 다 썼다 → 여기서 또 기다리지 않고 넘긴다
      LLMRateLimitError       같은 문을 두드려도 소용없다 → 바로 넘긴다
      LLMModelUnavailableError 사람이 고쳐야 한다 → 넘기되 큰 소리로 남긴다
      LLMGenerationError      모양이 어긋났다. temperature 0 이라 다시 물어도 같다 → 넘긴다

    두 층 모두 실패하면 마지막 예외를 그대로 올린다 — 어디서 무엇이 무너졌는지
    로그에 남아야 다음에 같은 자리를 찾을 수 있다.
    """

    name = "fallback"

    #: 흔들림에 한 번 더 물어보기 전에 쉬는 시간. 길면 화면이 그만큼 더 멈춘다.
    RETRY_PAUSE_SECONDS = 0.6

    def __init__(self, primary: LLMProvider, secondary: LLMProvider):
        self.primary = primary
        self.secondary = secondary

    async def _attempt(self, provider: LLMProvider, call: Callable[[LLMProvider], Awaitable[Any]], *, label: str) -> Any:
        """한 Provider 에게 묻는다. 흔들림이면 한 번만 더 묻는다.

        **타임아웃은 예외다.** 처음엔 그것도 흔들림으로 묶어 한 번 더 물었는데, 그러면
        15초를 기다린 뒤 또 15초를 기다리고서야 폴백이 시작한다 — 배포본에서 25초 넘는
        응답이 그렇게 나왔다. 기다림의 값이 다르면 정책도 달라야 한다.
        """
        try:
            return await call(provider)
        except LLMTimeoutError:
            raise  # 이미 기다릴 만큼 기다렸다. 다음 Provider 가 받는다.
        except LLMTransientError as e:
            logger.warning("%s(%s) 흔들림 — 한 번 더 묻는다: %s", label, provider.name, e)
            await asyncio.sleep(self.RETRY_PAUSE_SECONDS)
            return await call(provider)

    async def _with_fallback(self, call: Callable[[LLMProvider], Awaitable[Any]]) -> Any:
        try:
            return await self._attempt(self.primary, call, label="primary")
        except LLMModelUnavailableError as e:
            # 흔들림이 아니라 사실이다. 폴백으로 가려지면 다음 사람이 못 찾는다.
            logger.error("주 모델이 사라졌다 — 이름을 갈아야 한다: %s", e)
        except LLMError as e:
            logger.warning("주 Provider(%s) 실패: %s → %s 로 넘긴다", self.primary.name, e, self.secondary.name)

        try:
            return await self._attempt(self.secondary, call, label="secondary")
        except LLMModelUnavailableError as e:
            logger.error("폴백 모델도 사라졌다 — 이제 갈 곳이 없다: %s", e)
            raise

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        return await self._with_fallback(lambda p: p.generate(prompt, json_mode=json_mode))

    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        return await self._with_fallback(lambda p: p.generate_structured(prompt, schema))

    async def classify(self, text: str, labels: list[str]) -> str:
        return await self._with_fallback(lambda p: p.classify(text, labels))

_gemini_instance = None
_groq_instance = None
_fallback_instance = None


def _gemini() -> LLMProvider:
    global _gemini_instance
    if _gemini_instance is None:
        _gemini_instance = GeminiProvider()
    return _gemini_instance


def _groq() -> LLMProvider | None:
    """Groq — 키가 없으면 아예 만들 수 없다. 그럴 땐 None 이다.

    `AsyncGroq()` 는 키가 없으면 **생성자에서** 던진다. 예전에는 두 Provider 를 무조건
    먼저 세워 두고 골랐는데, 그래서 `GROQ_API_KEY` 하나가 비면 Gemini 키가 멀쩡해도
    모든 요청이 "일시적인 오류가 발생했어요" 로 끝났다 — 폴백이 주 경로를 죽인 셈이다.
    없는 것은 없는 대로 두고, 있는 것으로 간다.
    """
    global _groq_instance
    if _groq_instance is None:
        if not os.getenv("GROQ_API_KEY"):
            logger.warning("GROQ_API_KEY 가 없습니다 — 폴백 없이 Gemini 단독으로 갑니다.")
            return None
        _groq_instance = GroqProvider()
    return _groq_instance


def get_provider(task: Task) -> LLMProvider:
    """작업 유형에 맞는 Provider 인스턴스를 반환한다.

    누가 먼저 답하는가는 `LLM_PRIMARY` 가 정한다(`gemini` | `groq`).

    왜 고를 수 있게 두는가 — 무료 티어의 형편은 우리가 정하지 못한다. 2026-08-21 에
    실측한 값이 그 이유다(따뜻한 서버, 같은 프롬프트):

        groq    0.67 · 0.75 · 0.76초      3/3 성공
        gemini  4.75 · 4.93 · 6.51초      1/3 은 503 high demand

    503 이면 같은 곳에 한 번 더 묻고(0.6초 쉬고) 그다음 넘기므로, Gemini 가 앞에 서 있는
    동안 한 줄을 넣고 기다리는 시간이 12~17초였다. 코드를 고쳐야만 바뀌는 값이었으면
    데모 당일에 손댈 수 없다. 환경변수 한 줄로 되돌릴 수 있게 둔다.
    """
    global _fallback_instance

    groq = _groq()

    if task == Task.CLASSIFY:
        # 분류는 Groq 이 맡기로 했지만, 없으면 Gemini 도 classify 를 할 줄 안다.
        return groq or _gemini()

    if groq is None:
        return _gemini()

    if _fallback_instance is None:
        want = os.getenv("LLM_PRIMARY", "gemini").strip().lower()
        if want == "groq":
            _fallback_instance = FallbackProvider(primary=groq, secondary=_gemini())
        else:
            if want not in ("", "gemini"):
                logger.warning("LLM_PRIMARY=%r 는 모르는 값입니다 — gemini 로 갑니다.", want)
            _fallback_instance = FallbackProvider(primary=_gemini(), secondary=groq)
        logger.info("LLM 주 Provider: %s", _fallback_instance.primary.name)
    return _fallback_instance
