"""TodoAgent — 할 일 생성 및 우선순위 추천.

상세 설계(입력/출력/Prompt/JSON Schema/Validation/Confidence/Retry): ../../docs/08_AI_AGENTS.md
"""
from typing import Any

from ai.agents.base import AgentResult, BaseAgent


class TodoAgent(BaseAgent):
    name = "todo"

    async def run(self, message: str, context: dict[str, Any]) -> AgentResult:
        # TODO: LLM 호출 + JSON Schema 검증 + Confidence 산출 (docs/08_AI_AGENTS.md)
        raise NotImplementedError("TodoAgent 구현 필요")
