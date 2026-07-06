"""ParserAgent — 자연어에서 구조화 데이터(일시/제목/장소 등)를 추출.

상세 설계(입력/출력/Prompt/JSON Schema/Validation/Confidence/Retry): ../../docs/08_AI_AGENTS.md
"""
from typing import Any

from ai.agents.base import AgentResult, BaseAgent


class ParserAgent(BaseAgent):
    name = "parser"

    async def run(self, message: str, context: dict[str, Any]) -> AgentResult:
        # TODO: LLM 호출 + JSON Schema 검증 + Confidence 산출 (docs/08_AI_AGENTS.md)
        raise NotImplementedError("ParserAgent 구현 필요")
