"""LLM 라우팅 팩토리 — 작업 유형별 Provider 선택 (쿼터 이원화).

- 분류(Intent) 등 가볍고 잦은 호출 → Groq (초고속)
- 파싱/요약 등 품질 중요 호출     → Gemini
상세: ../../docs/07_AI_SYSTEM.md
"""
from enum import Enum
import logging
import os
from typing import Type

from ai.llm.base import LLMProvider, LLMError, T
from ai.llm.gemini import GeminiProvider
from ai.llm.groq import GroqProvider

logger = logging.getLogger(__name__)

class Task(str, Enum):
    CLASSIFY = "classify"   # → Groq
    GENERATE = "generate"   # → Gemini (fallback to Groq)

class FallbackProvider(LLMProvider):
    name = "fallback"

    def __init__(self, primary: LLMProvider, secondary: LLMProvider):
        self.primary = primary
        self.secondary = secondary

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        try:
            return await self.primary.generate(prompt, json_mode=json_mode)
        except LLMError as e:
            logger.warning(f"Primary provider {self.primary.name} failed: {e}. Falling back to {self.secondary.name}")
            return await self.secondary.generate(prompt, json_mode=json_mode)

    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        try:
            return await self.primary.generate_structured(prompt, schema)
        except LLMError as e:
            logger.warning(f"Primary provider {self.primary.name} failed: {e}. Falling back to {self.secondary.name}")
            return await self.secondary.generate_structured(prompt, schema)

    async def classify(self, text: str, labels: list[str]) -> str:
        try:
            return await self.primary.classify(text, labels)
        except LLMError as e:
            logger.warning(f"Primary provider {self.primary.name} failed: {e}. Falling back to {self.secondary.name}")
            return await self.secondary.classify(text, labels)

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
    """작업 유형에 맞는 Provider 인스턴스를 반환한다."""
    global _fallback_instance

    groq = _groq()

    if task == Task.CLASSIFY:
        # 분류는 Groq 이 맡기로 했지만, 없으면 Gemini 도 classify 를 할 줄 안다.
        return groq or _gemini()

    if groq is None:
        return _gemini()

    if _fallback_instance is None:
        _fallback_instance = FallbackProvider(primary=_gemini(), secondary=groq)
    return _fallback_instance
