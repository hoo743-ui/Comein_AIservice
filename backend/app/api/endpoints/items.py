"""JSON 추출 결과 저장 엔드포인트.

텍스트 → (AI팀 파싱 API, 미구현) → ParsedItem[] 흐름 중 "파싱 이후" 단계.
AI팀 API가 준비되면 그 응답을 `ItemsCreateRequest.items`로 변환해 이 엔드포인트를
호출(또는 `create_items_from_parsed`를 직접 호출)하면 된다.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import User
from app.schemas.items import ItemsCreateRequest, ItemsCreateResponse
from app.services.items_service import create_items_from_parsed

router = APIRouter()


@router.post("", response_model=ItemsCreateResponse)
async def create_items(
    req: ItemsCreateRequest, db: AsyncSession = Depends(get_db)
) -> ItemsCreateResponse:
    user = await db.scalar(select(User).where(User.id == req.user_id))
    if user is None:
        raise HTTPException(status_code=404, detail="user_id에 해당하는 사용자가 없습니다.")

    results = await create_items_from_parsed(db, req.user_id, req.items)
    return ItemsCreateResponse(results=results)
