# Comein_AIservice

AI 기반 **Comein** 서비스 프로젝트입니다.

## ⚙️ Git 초기 설정 (최초 1회)

### 1. 저장소 클론
git clone https://github.com/hoo743-ui/Comein_AIservice.git //
cd Comein_AIservice

### 2. 사용자 정보 설정 (전역 설정 안 했다면)
git config user.name "본인 이름"
git config user.email "본인 이메일"

### 3. develop 브랜치로 전환
git switch develop
# 만약 로컬에 develop이 없다면
git switch -c develop origin/develop

### 4. 최신 상태 확인
git pull origin develop
git branch -a   # 원격/로컬 브랜치 확인

---

# 👥 Team

| Role              | Members |
| ----------------- | ------- |
| Frontend Engineer | 1 (TBD) |
| Backend Engineer  | 1       |
| AI Engineer       | 3       |

---

# 📂 Project Structure

```text
Comein_AIservice/
├── frontend/        # Frontend
├── backend/         # Backend API
├── ai/              # AI Model & Training
├── docs/            # Project Documents
├── .gitignore
└── README.md
```

---

# 🌿 Git Branch Strategy

### Branch

* **main**

  * 최종 제출 및 안정화 브랜치

* **develop**

  * 개발 통합 브랜치

* **feature/**

  * 기능 개발 브랜치

예시

```text
feature/frontend
feature/backend-api
feature/ai-model
feature/preprocessing
```

---

# 🔀 Git Workflow

### 1. develop 최신 코드 받기

```bash
git switch develop
git pull origin develop
```

### 2. 기능 브랜치 생성

```bash
git switch -c feature/기능명
```

### 3. 개발

각자의 역할에 맞는 폴더에서 작업합니다.

* Frontend → `frontend/`
* Backend → `backend/`
* AI → `ai/`

### 4. 작업 완료

```bash
git add .
git commit -m "feat: 기능 설명"
git push origin feature/기능명
```

### 5. Pull Request

```
feature/* → develop
```

으로 Pull Request 생성

### 6. 기능 통합 완료 후

```
develop → main
```

으로 Pull Request 생성

---

# 📝 Commit Convention

| Type     | Description |
| -------- | ----------- |
| feat     | 새로운 기능      |
| fix      | 버그 수정       |
| refactor | 코드 리팩토링     |
| docs     | 문서 수정       |
| style    | 코드 스타일 수정   |
| chore    | 기타 작업       |

예시

```bash
git commit -m "feat: 로그인 API 구현"
git commit -m "fix: AI 예측 오류 수정"
```

---

# 📌 Collaboration Rules

* main 브랜치 직접 작업 금지
* develop 브랜치를 기준으로 개발
* 기능마다 feature 브랜치 생성
* 작업 완료 후 Pull Request 생성
* Merge 후 develop 최신 코드로 갱신 후 새로운 브랜치 생성

---

# 📚 Repository

https://github.com/hoo743-ui/Comein_AIservice
