"""IntentAgent — 자연어 메시지의 의도(schedule/todo/memo/meeting/chat)를 분류.

상세 설계(입력/출력/Prompt/JSON Schema/Validation/Confidence/Retry): ../../docs/08_AI_AGENTS.md
"""
from typing import Any

from ai.agents.base import AgentResult, BaseAgent


class IntentAgent(BaseAgent):
    name = "intent"

    async def run(self, message: str, context: dict[str, Any]) -> AgentResult:
        # TODO: LLM 호출 + JSON Schema 검증 + Confidence 산출 (docs/08_AI_AGENTS.md)
        raise NotImplementedError("IntentAgent 구현 필요")
