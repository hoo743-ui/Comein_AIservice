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
    """429 Rate Limit 등 쿼터 초과 예외"""
    pass

class LLMGenerationError(LLMError):
    """생성/파싱 오류 예외"""
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
