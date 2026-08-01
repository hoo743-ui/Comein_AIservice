import asyncio
import os
import sys

# 레포 루트를 import 경로에 올린다 (ai/ 패키지)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

# Load dotenv to get API keys for testing
from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, "backend", ".env"))

from ai.router import route

async def main():
    print("🤖 Testing Multi-intent Routing...")
    message = "내일 오후 3시 회의 잡고, 회의록 정리 투두에 넣어줘"
    print(f"\n👤 Input: {message}")
    
    try:
        result = await route(message=message)
        print("\n✅ AI Response:")
        
        # Pretty print the dictionary result
        import json
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
