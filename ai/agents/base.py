"""BaseAgent — 모든 Agent의 공통 인터페이스.

각 Agent는 역할/입력/출력/Prompt/JSON Schema/Validation/Confidence/Retry/Error
를 정의한다. 상세: ../../docs/08_AI_AGENTS.md
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentResult:
    """Agent 실행 결과 — confidence 로 사용자 확인 UX 분기."""

    data: dict[str, Any]
    confidence: float = 1.0
    reply: str = ""
    cards: list[dict] = field(default_factory=list)


class BaseAgent(ABC):
    name: str

    @abstractmethod
    async def run(self, message: str, context: dict[str, Any]) -> AgentResult:
        """자연어 입력을 처리하여 구조화된 결과를 반환한다."""
        raise NotImplementedError
