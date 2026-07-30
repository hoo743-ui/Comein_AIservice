import os
import json
from typing import Type
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.genai.errors import APIError

from ai.llm.base import LLMProvider, LLMRateLimitError, LLMGenerationError, T

class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            # Fallback or warning can be handled here; for now we init the client.
            # google-genai will automatically pick up GEMINI_API_KEY from env if available.
            pass
        self.client = genai.Client()

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        try:
            config = types.GenerateContentConfig()
            if json_mode:
                config.response_mime_type = "application/json"
            
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )
            return response.text
        except APIError as e:
            if e.code == 429:
                raise LLMRateLimitError(f"Gemini Rate Limit Exceeded: {e}")
            raise LLMGenerationError(f"Gemini API Error: {e}")
        except Exception as e:
            raise LLMGenerationError(f"Gemini Generation Error: {e}")

    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.0, # Use 0.0 for structured data extraction
            )
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )
            
            # The SDK might return the JSON string or directly parse it if response_schema is used,
            # but currently genai SDK returns text which needs to be parsed into the Pydantic model.
            response_text = response.text
            return schema.model_validate_json(response_text)
            
        except APIError as e:
            if e.code == 429:
                raise LLMRateLimitError(f"Gemini Rate Limit Exceeded: {e}")
            raise LLMGenerationError(f"Gemini API Error: {e}")
        except Exception as e:
            raise LLMGenerationError(f"Gemini Structured Generation Error: {e}")

    async def classify(self, text: str, labels: list[str]) -> str:
        prompt = f"Classify the following text into exactly one of these categories: {labels}\n\nText: {text}\n\nCategory:"
        response_text = await self.generate(prompt)
        # simple cleanup
        result = response_text.strip().strip("'\"")
        if result not in labels:
            # fallback matching
            for label in labels:
                if label.lower() in result.lower():
                    return label
        return result
