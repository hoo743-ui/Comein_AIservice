import asyncio
import json
import os
from dotenv import load_dotenv

# backend 폴더 안의 .env 파일 로드 (API 키 불러오기)
load_dotenv("backend/.env")

# 우리가 만든 AI 라우터 불러오기
from ai.router import route

async def main():
    print("🤖 Comein AI 파싱(JSON) 테스트 시작...")
    
    # 1. API 키 확인
    if not os.getenv("GEMINI_API_KEY"):
        print("⚠️ [경고] .env 파일에 GEMINI_API_KEY가 없습니다!")
        print("   루트 폴더의 .env 파일에 GEMINI_API_KEY=AIzaSy... 를 넣어주세요.")
        return

    # 2. 테스트할 자연어 메시지 (복합 의도)
    message = "내일 오후 3시 정우랑 미팅 잡고, 내일 밤 11시까지 발표 자료 만들기 투두에 넣어줘"
    print(f"\n👤 사용자 입력: {message}")
    
    # 3. AI 파이프라인 실행
    print("\n⏳ AI가 규칙(Pydantic)에 맞춰 분석 중입니다...")
    try:
        result_json = await route(message=message, user_id="test-user")
        
        # 4. 결과 출력
        print("\n✅ [AI 변환 결과 (완벽한 JSON)]")
        print(json.dumps(result_json, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"\n❌ 에러 발생: {e}")

if __name__ == "__main__":
    asyncio.run(main())
