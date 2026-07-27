"""데모 사용자 엔드포인트.

인증(JWT/Supabase Auth)이 아직 없어, 프론트가 `/api/items` 호출에 쓸
user_id를 얻을 방법이 필요하다. 고정 이메일로 get-or-create 하는
임시 데모 사용자로 대체한다. 인증이 붙으면 이 엔드포인트는 제거한다.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User
from app.schemas.users import UserOut

router = APIRouter()

DEMO_EMAIL = "demo@comein.dev"


@router.get("/demo", response_model=UserOut)
async def get_or_create_demo_user(db: AsyncSession = Depends(get_db)) -> UserOut:
    user = await db.scalar(select(User).where(User.email == DEMO_EMAIL))
    if user is None:
        user = User(email=DEMO_EMAIL, name="Demo")
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return UserOut(id=user.id, email=user.email, name=user.name)
