"""LLM 라우팅 팩토리 — 작업 유형별 Provider 선택 (쿼터 이원화).

- 분류(Intent) 등 가볍고 잦은 호출 → Groq (초고속)
- 파싱/요약 등 품질 중요 호출     → Gemini
상세: ../../docs/07_AI_SYSTEM.md
"""
from enum import Enum
import logging
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

def get_provider(task: Task) -> LLMProvider:
    """작업 유형에 맞는 Provider 인스턴스를 반환한다."""
    global _gemini_instance, _groq_instance, _fallback_instance
    
    if _gemini_instance is None:
        _gemini_instance = GeminiProvider()
    if _groq_instance is None:
        _groq_instance = GroqProvider()
    if _fallback_instance is None:
        _fallback_instance = FallbackProvider(primary=_gemini_instance, secondary=_groq_instance)
        
    if task == Task.CLASSIFY:
        return _groq_instance
    return _fallback_instance
