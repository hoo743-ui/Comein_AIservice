import os
import urllib.request
import json
from dotenv import load_dotenv

load_dotenv(".env")
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print("=== 사용 가능한 Gemini 모델 목록 ===")
        for model in data.get("models", []):
            name = model.get("name")
            supported = model.get("supportedGenerationMethods", [])
            if "generateContent" in supported:
                print(f"- {name}")
except urllib.error.HTTPError as e:
    print(f"API 요청 실패: {e.code} - {e.read().decode()}")
except Exception as e:
    print(f"에러 발생: {e}")
