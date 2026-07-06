# Comein AI Engine

AI Workspace Engine — Router → Intent Classifier → Agent 라우팅 → Memory → LLM.
상세: [`../docs/07_AI_SYSTEM.md`](../docs/07_AI_SYSTEM.md), [`../docs/08_AI_AGENTS.md`](../docs/08_AI_AGENTS.md)

## 구조

```
ai/
├── router.py            # AI Router — 의도 파악 후 Agent 라우팅
├── agents/              # Agent 15종 (MVP: intent, parser, schedule, todo, memo)
│   ├── base.py          # BaseAgent — 공통 인터페이스
│   ├── intent.py
│   ├── parser.py
│   ├── schedule.py
│   ├── todo.py
│   └── memo.py
├── llm/                 # Provider 교체 가능한 LLM 추상화 레이어
│   ├── base.py          # LLMProvider 인터페이스
│   ├── gemini.py        # 생성/파싱 (품질 우선)
│   ├── groq.py          # 분류 (초고속)
│   └── factory.py       # 쿼터 이원화 라우팅
├── prompts/             # Prompt 템플릿 (docs/13_PROMPT.md)
└── memory/              # Short/Long Memory, Embedding/RAG (docs/11_MEMORY.md)
```

## 설계 원칙

- **LLM 추상화**: Gemini(파싱·요약) / Groq(분류) 이원화로 무료 쿼터 분산. Provider 교체 가능.
- **Agent 계약**: 각 Agent는 역할/입력/출력/Prompt/JSON Schema/Validation/Confidence/Retry/Error 정의.
- **AI↔백엔드 경계**: API JSON Schema로 고정(docs/10_API.md) → 병렬 개발.
