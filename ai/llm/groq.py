import os
import json
from typing import Type
from groq import AsyncGroq
from groq import APIError, RateLimitError

from ai.llm.base import LLMProvider, LLMRateLimitError, LLMGenerationError, T

class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, model_name: str = "llama-3.3-70b-versatile"):
        self.model_name = model_name
        self.api_key = os.getenv("GROQ_API_KEY")
        # 키를 명시적으로 넘긴다. 넘기지 않으면 SDK 가 환경변수를 다시 읽고, 없으면
        # 여기서 GroqError 를 던진다 — 팩토리가 그걸 모르고 무조건 세우던 것이 문제였다.
        # 키의 유무는 factory._groq() 가 먼저 판단한다.
        self.client = AsyncGroq(api_key=self.api_key)

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        try:
            kwargs = {
                "model": self.model_name,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
                
            response = await self.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
            
        except RateLimitError as e:
            raise LLMRateLimitError(f"Groq Rate Limit Exceeded: {e}")
        except APIError as e:
            raise LLMGenerationError(f"Groq API Error: {e}")
        except Exception as e:
            raise LLMGenerationError(f"Groq Generation Error: {e}")

    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        schema_json = schema.model_json_schema()
        system_prompt = (
            "You are a helpful assistant designed to output JSON. "
            f"Your output must strictly match the following JSON schema:\n{json.dumps(schema_json)}\n"
            "Return only valid JSON, without any markdown formatting like ```json."
        )
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
            )
            
            response_text = response.choices[0].message.content or "{}"
            return schema.model_validate_json(response_text)
            
        except RateLimitError as e:
            raise LLMRateLimitError(f"Groq Rate Limit Exceeded: {e}")
        except Exception as e:
            raise LLMGenerationError(f"Groq Structured Generation Error: {e}")

    async def classify(self, text: str, labels: list[str]) -> str:
        prompt = f"Classify the following text into exactly one of these categories: {labels}\n\nText: {text}\n\nCategory:"
        response_text = await self.generate(prompt)
        
        result = response_text.strip().strip("'\"")
        if result not in labels:
            for label in labels:
                if label.lower() in result.lower():
                    return label
        return result
