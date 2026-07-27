"""SQLAlchemy 모델 정의 위치 — docs/09_DATABASE.md(현재 비어있음) 대신 CLAUDE.md §7 기준.

모든 모델을 여기서 import해 `Base.metadata`와 관계(relationship) 문자열
참조가 올바르게 구성되도록 한다.
"""
from app.models.meeting import Meeting
from app.models.memo import Memo
from app.models.schedule import Schedule
from app.models.todo import Todo
from app.models.user import User

__all__ = ["User", "Schedule", "Todo", "Memo", "Meeting"]
