"""폴백과 재시도 — 네트워크 없이, 정책만 검증한다.

이 자리에는 테스트가 하나도 없었다. 그런데 실제로 도는 요청의 상당수가 여기를 지난다
(Gemini 가 흔들리면 Groq 이 받는다). 층이 늘어날수록 "무엇이 언제 열리는가" 는
읽어서 알기 어려워지므로, 가짜 Provider 로 각 경우를 하나씩 세워 둔다.

가짜를 쓰는 이유는 속도가 아니라 **재현**이다. 429·503·모델 은퇴는 실제 API 로는
원할 때 만들 수 없다 — 그래서 지금까지 한 번도 확인되지 않았다.
"""
import os
import sys

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import pytest
from pydantic import BaseModel

from ai.llm.base import (
    LLMGenerationError,
    LLMModelUnavailableError,
    LLMProvider,
    LLMRateLimitError,
    LLMTransientError,
)
from ai.llm.factory import FallbackProvider


class Shape(BaseModel):
    ok: bool = True


class Fake(LLMProvider):
    """정해진 각본대로 답하거나 실패하는 Provider.

    outcomes 의 각 원소는 예외이거나 돌려줄 값이다. 부른 횟수는 calls 에 쌓인다.
    """

    def __init__(self, name: str, *outcomes):
        self.name = name
        self.outcomes = list(outcomes)
        self.calls = 0

    def _next(self):
        self.calls += 1
        outcome = self.outcomes[min(self.calls - 1, len(self.outcomes) - 1)]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    async def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        return self._next()

    async def generate_structured(self, prompt, schema):
        return self._next()

    async def classify(self, text, labels):
        return self._next()


@pytest.fixture(autouse=True)
def _no_waiting(monkeypatch):
    """재시도 사이의 쉼은 정책이 아니라 예의다 — 테스트에서는 기다리지 않는다."""
    monkeypatch.setattr(FallbackProvider, "RETRY_PAUSE_SECONDS", 0)


async def test_the_primary_answers_and_nobody_else_is_bothered():
    primary, secondary = Fake("primary", Shape()), Fake("secondary", Shape())
    await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert (primary.calls, secondary.calls) == (1, 0)


async def test_a_wobble_is_asked_again_at_the_same_door():
    # 503 high demand 가 이 경우다. 예전에는 곧바로 사용자에게 오류로 갔다.
    primary = Fake("primary", LLMTransientError("503 high demand"), Shape())
    secondary = Fake("secondary", Shape())
    await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert primary.calls == 2, "흔들림에는 같은 곳에 한 번 더 물어야 한다"
    assert secondary.calls == 0, "다시 물어 답을 받았으면 넘길 이유가 없다"


async def test_a_wobble_twice_moves_on():
    primary = Fake("primary", LLMTransientError("503"), LLMTransientError("503"))
    secondary = Fake("secondary", Shape())
    await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert (primary.calls, secondary.calls) == (2, 1)


async def test_a_rate_limit_does_not_knock_twice():
    # 쿼터를 넘었는데 같은 문을 다시 두드리는 것은 시간만 버리는 일이다.
    primary = Fake("primary", LLMRateLimitError("429"))
    secondary = Fake("secondary", Shape())
    await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert primary.calls == 1
    assert secondary.calls == 1


async def test_a_shape_mismatch_moves_on_instead_of_repeating():
    # temperature 0 이라 같은 프롬프트에 같은 답이 온다. 다른 모델은 다르게 쓸 수 있다.
    primary = Fake("primary", LLMGenerationError("schema"))
    secondary = Fake("secondary", Shape())
    await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert primary.calls == 1
    assert secondary.calls == 1


async def test_the_fallback_gets_its_own_second_chance():
    primary = Fake("primary", LLMGenerationError("schema"))
    secondary = Fake("secondary", LLMTransientError("503"), Shape())
    await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert secondary.calls == 2


async def test_a_retired_primary_model_still_falls_back():
    # 사람이 이름을 갈아야 하는 일이지만, 그동안 서비스가 멈추지는 않는다.
    primary = Fake("primary", LLMModelUnavailableError("gemini-... is gone"))
    secondary = Fake("secondary", Shape())
    result = await FallbackProvider(primary, secondary).generate_structured("p", Shape)
    assert isinstance(result, Shape)
    assert secondary.calls == 1


async def test_when_both_are_gone_the_error_says_so():
    # 갈 곳이 없을 때는 삼키지 않는다 — 마지막 예외가 그대로 올라와야 원인을 찾는다.
    primary = Fake("primary", LLMModelUnavailableError("gemini gone"))
    secondary = Fake("secondary", LLMModelUnavailableError("groq gone"))
    with pytest.raises(LLMModelUnavailableError, match="groq gone"):
        await FallbackProvider(primary, secondary).generate_structured("p", Shape)


async def test_the_last_failure_is_not_swallowed():
    primary = Fake("primary", LLMRateLimitError("429 gemini"))
    secondary = Fake("secondary", LLMRateLimitError("429 groq"))
    with pytest.raises(LLMRateLimitError, match="429 groq"):
        await FallbackProvider(primary, secondary).generate_structured("p", Shape)


async def test_plain_generate_and_classify_take_the_same_road():
    for call, kwargs in (("generate", {}), ("classify", {})):
        primary = Fake("primary", LLMTransientError("503"), "answer")
        secondary = Fake("secondary", "unused")
        fb = FallbackProvider(primary, secondary)
        out = await (fb.generate("p") if call == "generate" else fb.classify("t", ["a"]))
        assert out == "answer"
        assert (primary.calls, secondary.calls) == (2, 0), call
