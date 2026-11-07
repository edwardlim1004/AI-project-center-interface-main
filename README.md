# AI Project Center Interface Main

**기존 부동산 분석 저장소와 완전히 분리되는 독립 GitHub Pages 프로젝트 관리 UI**입니다.

> 목표 전용 저장소: `edwardlim1004/AI-project-center-interface-main`
>
> 공개 배포 주소(배포 이후): `https://edwardlim1004.github.io/AI-project-center-interface-main/`
>
> **중요**: 위 주소는 해당 독립 저장소를 만들고 GitHub Pages 배포가 성공하기 전까지 활성화된 주소가 아닙니다. 기존 저장소에는 어떠한 파일도 작성할 필요가 없습니다.

## 독립 구조

```
AI-project-center-interface-main/
  index.html                         # 단독 정적 웹앱 엔트리
  assets/styles.css                  # 메인/모바일 UI 디자인
  assets/app.js                      # 화면/모듈 flow chart/상세/증거 링크/조회전용 새로고침
  assets/favicon.svg                 # 로고
  data/snapshot.json                 # 원본 GitHub에 기록된 2026-11-01 확인 스냅샷
  docs/ARCHITECTURE.md               # 데이터 흐름, 보안, 표시 정책
  docs/SOURCES.md                    # 논문·공식통계 문헌, 원본 PR 위치
  tests/validate.mjs                 # 파일 및 데이터 계약 검증
  .github/workflows/pages.yml        # 독립 GitHub Pages 자동 배포
  .nojekyll                          # GitHub Pages 정적 파일 처리
```

## 별도 GitHub 저장소 만들기 / 배포하기

1. GitHub에서 [새 저장소 생성](https://github.com/new?name=AI-project-center-interface-main&description=Real%20Estate%20AI%20Project%20Center) → Owner `edwardlim1004`, Repository name `AI-project-center-interface-main`, visibility `Public`. **README / .gitignore / 라이선스 자동 생성은 체크하지 않는 빈 저장소**를 만듭니다.
2. 이 프로젝트 ZIP을 압축 해제한 뒤, 폴더 안에서 아래 명령어로 **새로 만든 저장소로만** push합니다. 기존 `realestate_AI_anysis_20260927`를 remote로 지정하지 마세요.

```bash
cd AI-project-center-interface-main
git init
git add .
git commit -m "feat: standalone real estate AI project center dashboard"
git branch -M main
git remote add origin https://github.com/edwardlim1004/AI-project-center-interface-main.git
git push -u origin main
```

3. 새 저장소의 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택합니다. `.github/workflows/pages.yml`은 `main` push 또는 수동 `workflow_dispatch`에서 자동 배포를 시도합니다. Settings의 Pages 최초 활성화가 필요할 수 있습니다.
4. Actions의 `Deploy independent AI Project Center` 성공을 확인하고 위 별도 주소로 접속합니다.

**대안: 원본 저장소를 직접 건드리지 않고 GitHub 웹 `Add file → Upload files`로 ZIP 압축 해제 내용 전체를 새 저장소에 업로드**할 수도 있습니다. 숨김 `.github` 및 `.nojekyll` 파일도 포함하세요.

## 로컬 테스트

Node.js (테스트), 최신 Chrome/Edge (UI). npm 패키지 설치 불필요. 서드파티 런타임 의존성/비밀키 없음.

```bash
node --check assets/app.js
node --test tests/validate.mjs
python -m http.server 8765
# http://localhost:8765
```

## 구현된 기능

- 디자인 참조 기반 **메인 대시보드** 및 10개 모듈 현황, 위험 상태와 원본/과거판 링크.
- **10개 노드 SVG 플로우차트**. 클릭/키보드 Enter·Space로 모듈 담당 역할/파일 위치/검증 근거/참고 논문 표시.
- **PR #36 ↔ PR #37** 시각적 비교, PR #37 개선항목 개별 상세 화면, 원본 Draft 문서로 이동.
- **모형 등록부**: 유동성 SHADOW, GSADF/HaR 연구, 5년 가격평가 빌드 정상 복구(2026-11-07 서울 25개 구 갱신), 단 미래 가격예측 검증과 구분하는 상태.
- **데이터 카탈로그**: R2/Drive scope 수치와 지역별 합계 차이의 위험 알림.
- **이론·논문 목록**: OECD, BIS, IMF HaR, Phillips·Shi·Yu GSADF.
- **실제 GitHub 코드 위치**는 기존 저장소의 읽기 전용 외부 링크로 연결.
- **공개 status.json 새로고침**: 실행 버튼을 누를 때 GitHub 공개 원본을 재조회. 실패 시 내장 스냅샷 유지.
- **조회된 상태 보고서 다운로드**: JSON을 브라우저에서 생성, 원본 서버 수정 없음.
- 스마트폰/태블릿/데스크톱 반응형 레이아웃, 키보드 접근 가능 버튼, 콘텐츠 유형별 일관된 색상 + 문구.

## 주요 제한 · 안전

- `status.json` 외 모듈/모형/워크플로 상태는 **2026-11-01 기준의 검증 스냅샷**입니다. 운영 성공률/업데이트율/진척도를 새로 계산하지 않았습니다.
- 수집기·저장소·원시 R2/Drive에 직접 접근하지 않습니다. GitHub API 인증/쓰기/원격 Actions 실행도 사용하지 않습니다.
- 새 GitHub 저장소의 배포 성공은 **기존 PR #37 병합/모형 승격/기존 사이트 수정과 무관**합니다.
- 전체 원본/실거래 데이터, GitHub Secrets, 사용자 금융/개인정보는 새 저장소에 포함되어 있지 않습니다.
- 문제 상태는 원본 GitHub 근거가 갱신되고 검증되기 전 임의로 정상 변경하지 않습니다.
- GitHub Pages가 공개 사이트인 이상 **공개 가능한 프로젝트 상태만 게시**해야 합니다. 비공개 원천은 절대 업로드하지 마세요.

## 출처

[프로젝트 문서 및 원본 PR](docs/SOURCES.md) · [구조/데이터 계약](docs/ARCHITECTURE.md)