import os
import httpx
from typing import Type

from ai.llm.base import LLMProvider, LLMRateLimitError, LLMGenerationError, T

class GeminiProvider(LLMProvider):
    name = "gemini"

    # 2026년 기준 사용 가능한 최신 모델 별칭을 사용합니다.
    def __init__(self, model_name: str = "gemini-flash-latest"):
        self.model_name = model_name
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        if not self.api_key:
            raise LLMGenerationError("Gemini API Key is missing")
            
        url = f"{self.base_url}/{self.model_name}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}]
        }
        if json_mode:
            payload["generationConfig"] = {"responseMimeType": "application/json"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=30.0)
        except httpx.HTTPError as e:
            raise LLMGenerationError(f"Gemini transport error: {e!r}")

        if resp.status_code == 429:
            raise LLMRateLimitError(f"Gemini Rate Limit Exceeded: {resp.text}")
        if resp.status_code != 200:
            raise LLMGenerationError(f"Gemini API Error ({resp.status_code}): {resp.text}")
            
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise LLMGenerationError(f"Unexpected response format: {data}")

    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        if not self.api_key:
            raise LLMGenerationError("Gemini API Key is missing")
            
        url = f"{self.base_url}/{self.model_name}:generateContent?key={self.api_key}"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json"
                # responseSchema는 중첩된 Pydantic 모델의 $ref를 지원하지 않으므로 제외
            }
        }
        
        # 타임아웃·연결 끊김은 httpx 의 예외라 LLMError 가 아니다. 감싸지 않으면
        # FallbackProvider(LLMError 만 잡는다)를 그대로 지나쳐 Groq 으로 넘어가지 못한다 —
        # 광고한 failover 가 정작 가장 흔한 실패에서 열리지 않았다.
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=30.0)
        except httpx.HTTPError as e:
            raise LLMGenerationError(f"Gemini transport error: {e!r}")

        if resp.status_code == 429:
            raise LLMRateLimitError(f"Gemini Rate Limit Exceeded: {resp.text}")
        if resp.status_code != 200:
            raise LLMGenerationError(f"Gemini API Error ({resp.status_code}): {resp.text}")

        try:
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return schema.model_validate_json(text)
        except Exception as e:
            # 본문이 JSON 이 아니면 data 조차 없다 — 그럴 땐 원문을 그대로 싣는다.
            raise LLMGenerationError(f"Gemini Structured Generation Error: {e}\nRaw Response: {resp.text}")

    async def classify(self, text: str, labels: list[str]) -> str:
        prompt = f"Classify the following text into exactly one of these categories: {labels}\n\nText: {text}\n\nCategory:"
        response_text = await self.generate(prompt)
        result = response_text.strip().strip("'\"")
        if result not in labels:
            for label in labels:
                if label.lower() in result.lower():
                    return label
        return result
