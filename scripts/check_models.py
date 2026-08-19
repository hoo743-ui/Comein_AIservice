"""데모 전 사전 점검 — 우리가 부르는 그 모델이 오늘도 있는가.

전에는 Gemini 의 모델 **목록**만 찍어 줬다. 목록은 눈으로 읽어야 하고, 눈은 자기가
찾는 이름이 없다는 것을 잘 못 본다. 그리고 Groq 은 아예 확인 대상이 아니었다 —
폴백이 살아 있는지 아무도 묻지 않았다는 뜻이다.

이제 **코드가 실제로 쓰는 이름**을 두 Provider 에서 각각 확인하고, 하나라도 없으면
0이 아닌 값으로 끝난다. 데모 전에 이것 하나만 돌리면 된다:

    python scripts/check_models.py

값은 backend/.env 에서 읽는다(커밋되지 않는 파일). 배포본은 Render 대시보드의
환경변수를 쓰므로, 여기서 통과했다고 배포본이 통과하는 것은 아니다 — 키가 다르면
결과도 다를 수 있다.
"""
import json
import os
import sys
import urllib.error
import urllib.request

from dotenv import load_dotenv

# 한국어 Windows 의 콘솔은 cp949 다. 이 파일의 안내문에는 '—' 와 '·' 가 들어 있어서,
# 그냥 print 하면 UnicodeEncodeError 로 **점검 자체가 죽었다** — 모델이 사라졌는지
# 알려 주라고 만든 도구가 팀 PC 에서 한 번도 끝까지 돈 적이 없었다는 뜻이다.
# 출력만 UTF-8 로 돌려 둔다(못 그리는 글자는 대체 문자로).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)
load_dotenv(os.path.join(ROOT, "backend", ".env"))

# 코드가 실제로 쓰는 이름을 그대로 가져온다 — 여기에 이름을 또 적으면 언젠가 갈린다.
from ai.llm.gemini import DEFAULT_MODEL as GEMINI_MODEL  # noqa: E402
from ai.llm.groq import DEFAULT_MODEL as GROQ_MODEL  # noqa: E402

OK, FAIL, SKIP = "[ok]  ", "[FAIL]", "[skip]"


def check_gemini(model_name: str) -> bool:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        print(f"{SKIP} gemini — GEMINI_API_KEY 가 backend/.env 에 없다")
        return True  # 없는 것은 실패가 아니다. Groq 단독으로도 돈다.
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url), timeout=20) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"{FAIL} gemini — 모델 목록을 못 받았다: {e.code} {e.read().decode()[:200]}")
        return False
    except Exception as e:
        print(f"{FAIL} gemini — {e}")
        return False

    usable = [
        m["name"].removeprefix("models/")
        for m in data.get("models", [])
        if "generateContent" in m.get("supportedGenerationMethods", [])
    ]
    if model_name in usable:
        print(f"{OK} gemini — '{model_name}' 있음 (generateContent 가능 모델 {len(usable)}개)")
        return True

    print(f"{FAIL} gemini — '{model_name}' 이(가) 목록에 없다. 이름이 바뀌었거나 은퇴했다.")
    near = [m for m in usable if "flash" in m][:8]
    if near:
        print("        비슷한 것들: " + ", ".join(near))
    print("        고칠 곳: ai/llm/gemini.py 의 GeminiProvider(model_name=...)")
    return False


def check_groq(model_name: str) -> bool:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        # 이건 경고다. 폴백이 없어도 Gemini 단독으로 돌지만, 흔들릴 때 받을 곳이 없다.
        print(f"{SKIP} groq — GROQ_API_KEY 가 없다. 폴백 없이 Gemini 단독으로 돈다.")
        return True
    # SDK 로 묻는다. urllib 로 직접 부르면 Cloudflare 가 403(1010)으로 막는다 —
    # 그리고 어차피 실제 호출도 SDK 를 지나므로, 같은 길로 확인하는 편이 맞다.
    try:
        from groq import Groq

        usable = [m.id for m in Groq(api_key=key).models.list().data]
    except Exception as e:
        print(f"{FAIL} groq   — 모델 목록을 못 받았다: {type(e).__name__} {str(e)[:200]}")
        return False
    if model_name in usable:
        print(f"{OK} groq   — '{model_name}' 있음 (모델 {len(usable)}개)")
        return True

    print(f"{FAIL} groq   — '{model_name}' 이(가) 없다. Groq 은 낡은 모델을 실제로 내린다.")
    # 예전에는 'llama' 가 든 이름만 골라 보여 줬다. 그런데 실제로 벌어진 일은
    # **llama 계열이 통째로 사라진 것**이라, 그 필터로는 한 줄도 못 보여 준다 —
    # 갈아 끼울 이름을 찾으라면서 후보를 감추는 셈이었다.
    # 대화가 되는 것만 남기고 전부 보여 준다(음성·안전성 모델은 갈아 끼울 대상이 아니다).
    skip = ("whisper", "orpheus", "guard", "tts", "embed")
    near = [m for m in usable if not any(k in m for k in skip)]
    if near:
        print("        쓸 수 있는 대화 모델: " + ", ".join(sorted(near)))
    print("        고칠 곳: ai/llm/groq.py 의 DEFAULT_MODEL")
    return False


def main() -> int:
    print("=== 데모 전 모델 점검 ===")
    gemini_ok = check_gemini(GEMINI_MODEL)
    groq_ok = check_groq(GROQ_MODEL)

    if gemini_ok and groq_ok:
        print("\n둘 다 살아 있다. 흔들려도 받을 곳이 있다.")
        return 0
    print("\n하나 이상이 사라졌다. 이대로 데모하면 그 자리에서 알게 된다.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
