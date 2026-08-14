import os
import json
from typing import Type
from groq import AsyncGroq
from groq import APIError, APIConnectionError, APIStatusError, APITimeoutError, RateLimitError

from ai.llm.base import (
    LLMProvider,
    LLMGenerationError,
    LLMModelUnavailableError,
    LLMRateLimitError,
    LLMTransientError,
    T,
)


def _classify(e: Exception, model_name: str) -> Exception:
    """Groq 의 예외를 우리 어휘로 옮긴다 — 이 이름이 곧 재시도 정책이다.

    폴백의 **마지막** 층이라 여기서 잘못 부르면 갈 곳이 없다. 특히 모델이 은퇴한 경우
    (Groq 은 낡은 모델을 실제로 내린다) 그냥 '생성 오류' 로 두면, 사람이 이름을 갈아야
    하는 일이 "가끔 실패하네" 로 읽힌다.
    """
    if isinstance(e, RateLimitError):
        return LLMRateLimitError(f"Groq Rate Limit Exceeded: {e}")
    if isinstance(e, (APITimeoutError, APIConnectionError)):
        return LLMTransientError(f"Groq transport error: {e!r}")
    if isinstance(e, APIStatusError):
        status = getattr(e, "status_code", None)
        body = str(e)
        if status == 404 or "decommissioned" in body or "does not exist" in body:
            return LLMModelUnavailableError(
                f"Groq model '{model_name}' is gone (status={status}). 이름을 갈아야 한다: {e}"
            )
        if status is not None and status >= 500:
            return LLMTransientError(f"Groq {status}: {e}")
        return LLMGenerationError(f"Groq API Error ({status}): {e}")
    if isinstance(e, APIError):
        return LLMGenerationError(f"Groq API Error: {e}")
    return LLMGenerationError(f"Groq Error: {e}")

#: 폴백이 부르는 이름. 한 곳에만 적는다 — scripts/check_models.py 가 이걸 읽어
#: "오늘도 있는가" 를 확인한다. 두 군데 적으면 언젠가 한쪽만 갈린다.
DEFAULT_MODEL = "llama-3.3-70b-versatile"


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, model_name: str = DEFAULT_MODEL):
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
        except Exception as e:
            raise _classify(e, self.model_name) from e

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
        except Exception as e:
            raise _classify(e, self.model_name) from e

        # 스키마 검증 실패는 호출 실패와 다르다 — 위 except 안에 두면 '모양이 어긋났다' 가
        # 전송 오류로 둔갑해 폴백 정책이 엉뚱하게 움직인다.
        try:
            return schema.model_validate_json(response_text)
        except Exception as e:
            raise LLMGenerationError(f"Groq Structured Generation Error: {e}\nRaw: {response_text[:500]}")

    async def classify(self, text: str, labels: list[str]) -> str:
        prompt = f"Classify the following text into exactly one of these categories: {labels}\n\nText: {text}\n\nCategory:"
        response_text = await self.generate(prompt)
        
        result = response_text.strip().strip("'\"")
        if result not in labels:
            for label in labels:
                if label.lower() in result.lower():
                    return label
        return result
