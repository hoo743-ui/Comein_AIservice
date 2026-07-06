"""LLM 라우팅 팩토리 — 작업 유형별 Provider 선택 (쿼터 이원화).

- 분류(Intent) 등 가볍고 잦은 호출 → Groq (초고속)
- 파싱/요약 등 품질 중요 호출     → Gemini
상세: ../../docs/07_AI_SYSTEM.md
"""
from enum import Enum

from ai.llm.base import LLMProvider


class Task(str, Enum):
    CLASSIFY = "classify"   # → Groq
    GENERATE = "generate"   # → Gemini


def get_provider(task: Task) -> LLMProvider:
    """작업 유형에 맞는 Provider 인스턴스를 반환한다.

    TODO: gemini.GeminiProvider / groq.GroqProvider 구현 후 연결.
    쿼터 초과 시 fallback(Ollama)로 교체 가능하도록 설계한다.
    """
    raise NotImplementedError("Provider 구현 필요 — docs/07_AI_SYSTEM.md")
