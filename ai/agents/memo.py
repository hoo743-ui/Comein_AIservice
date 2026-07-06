"""MemoAgent — 메모 저장 및 태그 자동 부여.

상세 설계(입력/출력/Prompt/JSON Schema/Validation/Confidence/Retry): ../../docs/08_AI_AGENTS.md
"""
from typing import Any

from ai.agents.base import AgentResult, BaseAgent


class MemoAgent(BaseAgent):
    name = "memo"

    async def run(self, message: str, context: dict[str, Any]) -> AgentResult:
        # TODO: LLM 호출 + JSON Schema 검증 + Confidence 산출 (docs/08_AI_AGENTS.md)
        raise NotImplementedError("MemoAgent 구현 필요")
