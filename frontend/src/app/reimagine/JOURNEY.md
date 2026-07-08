# Comein User Journey — Landing → Workspace

> **목표:** 사용자가 Comein을 *쓰기 전에 이해하게* 만든다.
> 이 문서는 **정보 구조(IA)와 페이지 전환**만 정의한다. 개별 화면 재디자인은 아직 하지 않는다.
> 철학은 `CLAUDE.md §0`, 시각 규격은 `DESIGN.md` 참고 — 여기서는 **흐름**을 설계한다.

---

## 설계 원칙 (이 여정에만 적용)

1. **한 화면 = 하나의 질문.** 각 순간은 사용자의 머릿속 질문 하나에만 답한다.
2. **점진적 공개(progressive disclosure).** 정체성 → 이해 → 입장 → 사용. 기능은 마지막에야 등장.
3. **연결 조직(connective tissue).** 두 요소가 모든 노드를 관통하며 연속성을 만든다:
   - **문 마크(Door mark)** — 브랜드 앵커.
   - **철학 한 줄** — *"생각은 흩어집니다. 질서는 만들어집니다."*
   이 둘이 노드 사이를 **이어받으며(handoff)** 이동해 "페이지 이동"이 아니라 "한 공간의 이동"처럼 느껴지게 한다.
4. **되돌아온 사용자는 건너뛴다.** 이해는 1회면 충분. 재방문은 최단 경로로 작업에 도달.

---

## 1. Information Architecture — 4개의 순간

| # | 순간 | 라우트 | 답하는 질문 | 유일한 목표 | 주 액션(하나) |
|---|------|--------|-------------|-------------|----------------|
| 1 | **Landing** | `/` | "Comein이 무엇인가?" | 정체성·철학을 각인 | **Come in** (→ Experience) · *"how it works"* 부가 |
| 2 | **Experience** | `/experience` | "내 생각이 어떻게 정리되지?" | 변환(transformation) 시연 | **Come in** (→ Enter) · Skip 허용 |
| 3 | **Enter** | `/enter` | "어떻게 들어가지?" | 문턱을 넘는다(소셜) | **Continue with …** (→ Workspace) |
| 4 | **Workspace** | `/workspace` | "지금 무엇을, 무엇을 할까?" | 일이 스스로 정리되게 | **캡처 바** (항상) |

> 현재 프로토타입 매핑: Landing=`/`(기존), Experience=`/reimagine/experience`, Enter=`/reimagine/enter`, Workspace=`/reimagine`.
> 정식 채택 시 위 표의 최상위 라우트로 승격한다.

### 노드별 정보 밀도 (점진적 공개)

```
Landing      ▁            정체성만. 기능 0.
Experience   ▁▁▁          변환 1개를 눈으로. 기능은 '결과'로만 암시.
Enter        ▁            입장 수단만. 정보 최소.
Workspace    ▁▁▁▁▁▁       비로소 전체 기능·데이터.
```

---

## 2. 흐름 & 분기 (Flow)

### 첫 방문 (모르는 사용자) — 이해가 목적
```
Landing ──Come in──▶ Experience ──Come in──▶ Enter ──Continue with──▶ Workspace
   │                     │
   └─ "how it works" ────┘   (Experience로 직행)
```

### 재방문 (아는 사용자) — 최단 경로
```
Landing ──Come in──▶ Enter ──▶ Workspace      (Experience 건너뜀; 세션/방문 플래그로 판단)
```

### 인증된 사용자 — 즉시 작업
```
(any) ──▶ Workspace        (세션 유효 시 Landing/Enter를 지나치지 않고 바로)
```

### 분기 규칙 (IA 레벨, 구현은 이후)
- `seen_experience` (localStorage): 있으면 Landing의 CTA는 Experience를 건너뛰고 Enter로.
- `session` (auth): 있으면 Enter를 건너뛰고 Workspace로.
- **딥링크 존중:** 특정 기능 URL로 들어오면 인증 후 **그 자리로 복귀**(Enter는 통과 지점일 뿐, 목적지를 가로채지 않음).
- **막다른 길 없음:** 모든 노드에서 앞으로 갈 단 하나의 명확한 길. 뒤로가기는 브라우저에 위임(별도 UI 뒤로가기 버튼 없음 — 조용함 유지).

---

## 3. 페이지 전환 (Page Transitions)

> 전환은 **장식이 아니라 설명**이다(모션은 확신을 전달). 공통: `700–900ms`, 디졸브 `cubic-bezier(0.4,0,0.2,1)`, 안착 `cubic-bezier(0.22,1,0.36,1)`. `prefers-reduced-motion`은 즉시 컷.

| 전환 | 모션 언어 | 이어받는 요소(연속성) |
|------|-----------|------------------------|
| Landing → Experience | 철학 한 줄만 남기고 주변이 페이드아웃 → 생각 문장으로 **모프** | **철학 줄** 위치 유지 후 변형 |
| Experience → Enter | 정리된 결과물이 뒤로 물러나며(scale↓·blur) **문 마크가 전면**으로 | **문 마크** 부상 |
| Enter → Workspace | **문턱 디졸브** — 문이 열리듯 화면이 밝아지며 확장(opacity+scale 1.04) 후 캔버스 등장 | **문 마크 → 슬림 레일**의 마크로 자리 이동 |
| Workspace 내부(뷰 전환) | 페이지 이동 없음. 중앙만 **크로스페이드**(레일·척추 고정) | 레일·캡처 바 상시 유지 |

**핵심:** Enter→Workspace의 "문턱"은 **별도 페이지가 아니라 전환 그 자체**다. 지금 워크스페이스 안에 있는 threshold 오버레이를 이 **연결 전환**으로 승격시킨다(입장 직후 1회 재생).

### 공유 앵커의 이동(모션 continuity)
```
[문 마크]  Landing 중앙 → Experience 상단 → Enter 중앙 → Workspace 레일 상단
[철학 줄]  Landing 히어로 → Experience 시작 문장 → (Enter 서브카피) → Workspace 진입 순간
```
같은 요소가 화면을 가로질러 **자리만 옮기므로**, 사용자는 "새 페이지"가 아니라 "같은 공간이 재구성"되는 것으로 인지한다.

---

## 4. 성공 기준 (이 여정이 맞는지 판단)

- Landing을 본 사람은 **철학**을 한 문장으로 말할 수 있다.
- Experience를 본 사람은 "**내가 정리 안 해도 정리된다**"를 이해한다.
- Enter는 **망설임 0** — 폼도, 선택 피로도 없다(소셜 3개, Sign in/up 구분 없음).
- Workspace 도달 후, 사용자는 **여정을 기억하지 못한다**. 그냥 자기 공간에 있다.

---

## 5. 구현 순서 (다음 단계 · 화면 재디자인 아님)

1. **라우팅/분기 로직** — 위 플래그(`seen_experience`, `session`, 딥링크 복귀)만 배선.
2. **전환 계층** — 노드 간 공통 트랜지션 컴포넌트(디졸브·앵커 이동) 1개.
3. **threshold를 Enter→Workspace 전환으로 이관.**
4. 이후에야 개별 화면 디테일을 다듬는다.
