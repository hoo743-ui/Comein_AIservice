"""initial: users, schedules, todos, memos, meetings

Revision ID: 6e0f9b20eb16
Revises:
Create Date: 2026-07-25

CLAUDE.md §7 데이터 모델 기준 초기 테이블. 로컬에 연결 가능한 Postgres가
없어 autogenerate 대신 app/models/*.py 정의를 기준으로 직접 작성했다.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6e0f9b20eb16"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "schedules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('pending', 'confirmed')", name="ck_schedules_status"),
    )
    op.create_index("ix_schedules_user_id", "schedules", ["user_id"])

    op.create_table(
        "todos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority", sa.String(), nullable=False, server_default="mid"),
        sa.Column("status", sa.String(), nullable=False, server_default="todo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("priority IN ('high', 'mid', 'low')", name="ck_todos_priority"),
        sa.CheckConstraint("status IN ('todo', 'doing', 'done')", name="ck_todos_status"),
    )
    op.create_index("ix_todos_user_id", "todos", ["user_id"])

    op.create_table(
        "memos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_memos_user_id", "memos", ["user_id"])

    op.create_table(
        "meetings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("schedule_id", sa.Uuid(), sa.ForeignKey("schedules.id"), nullable=False),
        sa.Column("participants", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("schedule_id", name="uq_meetings_schedule_id"),
    )
    op.create_index("ix_meetings_schedule_id", "meetings", ["schedule_id"])


def downgrade() -> None:
    op.drop_table("meetings")
    op.drop_table("memos")
    op.drop_table("todos")
    op.drop_table("schedules")
    op.drop_table("users")
