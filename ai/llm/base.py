"""LLM Provider 추상화 — Provider 교체 가능한 레이어.

쿼터 초과 대비 및 Gemini/Groq 이원화를 위한 공통 인터페이스.
상세: ../../docs/07_AI_SYSTEM.md
"""
from abc import ABC, abstractmethod
from typing import TypeVar, Type
from pydantic import BaseModel

T = TypeVar('T', bound=BaseModel)

class LLMError(Exception):
    """LLM 관련 기본 예외"""
    pass

class LLMRateLimitError(LLMError):
    """429 — 쿼터를 넘었다.

    같은 Provider 를 다시 두드려 봐야 소용없다. 곧바로 다른 쪽으로 넘어간다.
    """
    pass

class LLMTransientError(LLMError):
    """503·5xx·타임아웃·연결 끊김 — 잘못한 것이 없는데 실패했다.

    "This model is currently experiencing high demand" 가 대표적이다. 잠깐 뒤 다시
    물으면 대개 답한다. 이걸 아래 LLMGenerationError 와 같은 것으로 두면 재시도할
    가치가 있는 실패와 없는 실패를 구별할 수 없다 — 실제로 그래서 한 번의 흔들림이
    곧바로 사용자에게 오류로 갔다.
    """
    pass

class LLMTimeoutError(LLMTransientError):
    """기다렸는데 답이 없었다.

    흔들림의 일종이지만 **값이 다르다.** 503 은 곧바로 돌아오므로 한 번 더 물어도 잃는
    것이 없다. 타임아웃은 이미 제한 시간을 통째로 쓴 뒤다 — 같은 문 앞에서 한 번 더
    기다리면 폴백은 그만큼 늦게 시작하고, 화면에서는 그냥 멈춘 것으로 보인다.
    (실제로 그래서 배포본에서 25초 넘는 응답이 나왔다.)

    그래서 이것만은 재시도하지 않고 곧바로 다음 Provider 로 넘긴다.
    """
    pass

class LLMModelUnavailableError(LLMError):
    """404 / model_decommissioned — 그 모델이 이제 없다.

    이건 흔들림이 아니라 사실이다. 재시도로 낫지 않고, 사람이 모델 이름을 갈아야 한다.
    조용히 다른 오류에 섞이면 "가끔 실패하네" 로 읽히다가 폴백까지 함께 죽는다.
    """
    pass

class LLMGenerationError(LLMError):
    """생성/파싱 오류 — 답은 왔는데 우리가 원한 모양이 아니다.

    temperature 0 이라 같은 Provider 에 같은 프롬프트를 다시 넣으면 대개 같은 답이 온다.
    재시도 대신 다른 Provider 로 넘긴다 — 다른 모델은 다르게 쓸 수 있다.
    """
    pass

class LLMProvider(ABC):
    """모든 LLM Provider가 구현해야 하는 인터페이스."""

    name: str

    @abstractmethod
    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        """프롬프트로부터 텍스트(또는 JSON 문자열)를 생성한다."""
        raise NotImplementedError

    @abstractmethod
    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        """프롬프트와 Pydantic 모델을 받아 구조화된 데이터를 생성한다."""
        raise NotImplementedError

    @abstractmethod
    async def classify(self, text: str, labels: list[str]) -> str:
        """text 를 labels 중 하나로 분류한다 (Intent 등)."""
        raise NotImplementedError
