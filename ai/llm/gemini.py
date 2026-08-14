import os
import httpx
from typing import Any, Type

from ai.llm.base import (
    LLMProvider,
    LLMGenerationError,
    LLMModelUnavailableError,
    LLMRateLimitError,
    LLMTransientError,
    T,
)

# 성공한 호출은 2~7초에 끝난다(배포본 실측). 30초를 기다리는 것은 이미 실패한 요청을
# 붙들고 있는 시간일 뿐이고, 그동안 폴백은 시작조차 못 한다 — 화면에서는 그게 그냥
# 멈춘 것으로 보인다. 가장 느렸던 성공(7.2초)의 두 배로 끊고 Groq 에 넘긴다.
REQUEST_TIMEOUT = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "15"))


#: 주 경로가 부르는 이름. 한 곳에만 적는다 — scripts/check_models.py 가 이걸 읽는다.
#: '-latest' 별칭이라 구글이 뒤에서 갈아 끼운다. 그래서 더더욱 확인이 필요하다.
DEFAULT_MODEL = "gemini-flash-latest"


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model_name = model_name
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    async def _post(self, payload: dict) -> dict[str, Any]:
        """한 번의 호출과, 실패를 무엇으로 부를지의 판단.

        두 메서드가 같은 오류 처리를 각자 갖고 있었다. 한쪽만 고쳐지는 자리라 모았다.
        여기서 나누는 이름이 곧 재시도 정책이다(ai/llm/factory.py):
          Transient   다시 물으면 답할 수도 있다
          RateLimit   같은 문을 다시 두드려도 소용없다
          ModelGone   사람이 고쳐야 한다
          Generation  답은 왔는데 모양이 아니다
        """
        if not self.api_key:
            raise LLMGenerationError("Gemini API Key is missing")

        url = f"{self.base_url}/{self.model_name}:generateContent?key={self.api_key}"

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=REQUEST_TIMEOUT)
        except httpx.TimeoutException as e:
            # 타임아웃·연결 끊김은 httpx 의 예외라 LLMError 가 아니다. 감싸지 않으면
            # FallbackProvider(LLMError 만 잡는다)를 그대로 지나쳐 Groq 으로 가지 못한다.
            raise LLMTransientError(f"Gemini timed out after {REQUEST_TIMEOUT}s: {e!r}")
        except httpx.HTTPError as e:
            raise LLMTransientError(f"Gemini transport error: {e!r}")

        if resp.status_code == 429:
            raise LLMRateLimitError(f"Gemini Rate Limit Exceeded: {resp.text}")
        if resp.status_code == 404:
            raise LLMModelUnavailableError(
                f"Gemini model '{self.model_name}' not found (404). "
                f"모델 이름이 바뀌었거나 은퇴했다: {resp.text}"
            )
        if resp.status_code >= 500:
            # 503 "This model is currently experiencing high demand" 가 여기다.
            raise LLMTransientError(f"Gemini {resp.status_code}: {resp.text}")
        if resp.status_code != 200:
            raise LLMGenerationError(f"Gemini API Error ({resp.status_code}): {resp.text}")

        try:
            return resp.json()
        except ValueError as e:
            raise LLMGenerationError(f"Gemini returned non-JSON body: {e} / {resp.text[:300]}")

    @staticmethod
    def _text_of(data: dict[str, Any]) -> str:
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise LLMGenerationError(f"Unexpected response format: {data}")

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        payload: dict[str, Any] = {"contents": [{"parts": [{"text": prompt}]}]}
        if json_mode:
            payload["generationConfig"] = {"responseMimeType": "application/json"}
        return self._text_of(await self._post(payload))

    async def generate_structured(self, prompt: str, schema: Type[T]) -> T:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.0,
                "responseMimeType": "application/json"
                # responseSchema는 중첩된 Pydantic 모델의 $ref를 지원하지 않으므로 제외
            },
        }
        data = await self._post(payload)
        text = self._text_of(data)
        try:
            return schema.model_validate_json(text)
        except Exception as e:
            # 모양이 어긋난 것이다. temperature 0 이라 다시 물어도 같은 답이 온다 —
            # 재시도 대신 다른 Provider 로 넘기는 편이 낫다(factory 가 그렇게 한다).
            raise LLMGenerationError(f"Gemini Structured Generation Error: {e}\nRaw Response: {text[:500]}")

    async def classify(self, text: str, labels: list[str]) -> str:
        prompt = f"Classify the following text into exactly one of these categories: {labels}\n\nText: {text}\n\nCategory:"
        response_text = await self.generate(prompt)
        result = response_text.strip().strip("'\"")
        if result not in labels:
            for label in labels:
                if label.lower() in result.lower():
                    return label
        return result
