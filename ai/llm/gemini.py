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
            
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=30.0)
            
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
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=30.0)
            
        if resp.status_code == 429:
            raise LLMRateLimitError(f"Gemini Rate Limit Exceeded: {resp.text}")
        if resp.status_code != 200:
            raise LLMGenerationError(f"Gemini API Error ({resp.status_code}): {resp.text}")
            
        data = resp.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return schema.model_validate_json(text)
        except Exception as e:
            raise LLMGenerationError(f"Gemini Structured Generation Error: {e}\nRaw Response: {data}")

    async def classify(self, text: str, labels: list[str]) -> str:
        prompt = f"Classify the following text into exactly one of these categories: {labels}\n\nText: {text}\n\nCategory:"
        response_text = await self.generate(prompt)
        result = response_text.strip().strip("'\"")
        if result not in labels:
            for label in labels:
                if label.lower() in result.lower():
                    return label
        return result
