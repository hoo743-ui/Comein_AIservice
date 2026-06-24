# Comein_AIservice
# 📢 GitHub 협업 공지

### 1️⃣ 저장소 Clone

```bash
git clone <Repository_URL>
```

### 2️⃣ 작업 시작 전

항상 최신 코드를 받은 후 본인 브랜치를 생성해주세요.

```bash
git switch main
git pull origin main
git switch -c feature/기능명
```

브랜치 예시

* feature/frontend
* feature/backend-api
* feature/ai-model
* feature/preprocessing

---

### 3️⃣ 작업 후

```bash
git add .
git commit -m "feat: 기능 설명"
git push origin feature/기능명
```

---

### 4️⃣ Pull Request(PR)

* 작업 완료 후 GitHub에서 PR 생성
* 리뷰 후 Merge
* **main 브랜치 직접 Push 금지**

---

### 5️⃣ Commit Message 규칙

* feat : 기능 추가
* fix : 버그 수정
* refactor : 리팩토링
* docs : 문서 수정
* style : 코드 스타일 수정
* chore : 기타 작업

---

### ⚠️ 협업 규칙

* main 브랜치에서 직접 작업 ❌
* 작업 전 `git pull`
* 기능 하나당 브랜치 하나 생성
* 작업 완료 후 PR 생성
* Merge 후 다시 `main`으로 이동하여 최신 코드 Pull 후 새 브랜치 생성

```
git switch main
git pull origin main
```
