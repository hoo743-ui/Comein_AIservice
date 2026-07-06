"""AI Router — Chat 입력의 진입점.

1) Intent Classifier로 의도 파악  2) 적절한 Agent로 라우팅
3) Agent 결과를 자연어 + 인라인 카드로 반환
상세: ../docs/07_AI_SYSTEM.md
"""
from typing import Any

from ai.agents.base import AgentResult

# MVP 필수 Agent: intent, parser, schedule, todo, memo
AGENT_REGISTRY: dict[str, str] = {
    "schedule": "ai.agents.schedule.ScheduleAgent",
    "todo": "ai.agents.todo.TodoAgent",
    "memo": "ai.agents.memo.MemoAgent",
}


async def route(message: str, context: dict[str, Any] | None = None) -> AgentResult:
    """자연어 메시지를 의도에 맞는 Agent로 라우팅한다.

    TODO: IntentAgent로 intent 분류 → AGENT_REGISTRY에서 Agent 선택 → run().
    """
    raise NotImplementedError("Intent 분류 + Agent 연결 필요 — docs/08_AI_AGENTS.md")
