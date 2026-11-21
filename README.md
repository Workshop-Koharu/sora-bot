# Sora (소라) — KCS 공식 디스코드 봇 & 웹 서비스

**KCS (Koharu Coding Server)** 전용 차세대 **Discord Components V2** 기반 올인원 디스코드 봇 및 Vercel 웹 관리 플랫폼입니다.

---

## 🌟 주요 특징 및 기술 스택

- **엔진 & 프레임워크:** Node.js 24 + TypeScript + Discord.js v14
- **UI 아키텍처:** **Discord Components V2 (Flag 32768)**
  - 최신 `Container(17)`, `Separator(14)`, `TextDisplay(10)`, `MediaGallery(12)`, `Section(9)`, `ActionRow(1)` 레이아웃 적용
- **커스텀 이모지 버튼 규격:**
  - `list.txt` 공식 KCS 블랙 커스텀 이모지 적용 (`다음`, `이전`, `설정`, `추가`, `필터`, `물음표`, `느낌표`, `검색`, `체크`, `취소`, `아래`, `공유`, `휴지통`, `리로드`)
  - 검은색 이모지의 가시성을 위해 버튼 스타일은 **Secondary (Discord 그레이)** 적용 및 라벨 텍스트 완전 배제
- **서버별 데이터 격리:** Guild ID 기준 분리 저장 (`data/guilds/{guildId}.json`) 및 원자적(Atomic) 트랜잭션 파일 I/O
- **다중 인증 시스템:**
  - 📱 **Sendwich SMS 인증:** `api.sendwich.kr` 직접 API 연동, `discover` 모드로 무료(Free) 플랜 완벽 지원
  - ✉️ **Resend 이메일 인증:** `admin@koharu.live` 발신 공식 6자리 코드 인증
  - ✅ **버튼 간편 인증 & 🤖 캡챠 왜곡 이미지 인증**
  - **스마트 역할 규칙:** 동일 역할 분기 시 택1 완료, 상이 역할 시 복수 인증 허용
- **웹 관리 플랫폼:** Next.js 14 + Tailwind CSS 기반 Vercel 즉시 배포형 대시보드 (`sora/web`)

---

## 📋 슬래시 명령어 명세 (1 ~ 69 전체 지원)

### 1. 보안 & 인증 (`!!` 관리자 전용)
- `/인증구성` — 다단계 마법사(수단 선택 ➡️ 채널 선택 ➡️ 역할 지정 ➡️ 최종 확인 ➡️ 전송)
- `/채널잠금` — 채널 지정 잠금/해제 토글 (이미 잠김/해제 상태 감지)
- `/채널삭제` — 영구 삭제 대상 및 영향 범위 경고 후 재확인
- `/채널설정` — 채널 역할별 권한 및 채널명 모달 변경

### 2. 서버 및 멤버 관리 (`!!` 관리자 전용)
- `/서버정보` — 서버 ID, 상태, 생성시각, 연결된 모듈 조회
- `/서버설정목록` — 분류별 조건부 페이징 설정 조회
- `/가입안내설정` — 새 멤버 환영 채널 및 활성화 설정
- `/가입환영문구` — `{user}`, `{server}`, `{count}` 템플릿 변경
- `/퇴장안내설정` — 퇴장 안내 채널 및 활성화 설정
- `/멤버정보` — 계정 생성일, 가입일, 역할, 경고 이력 조회
- `/봇상태` — 메모리, 업타임, 핑, Node.js 버전 실시간 조회

### 3. 제재 및 보안 로그 (`!!` 관리자 전용)
- `/경고` — 멤버 경고 부여 및 누적 카운트
- `/경고제거` — 경고 ID 지정 취소 및 취소 결과 보존
- `/경고목록` — 활성/비활성 페이징 경고 목록
- `/타임아웃` — 분 단위 대화 및 반응 제한
- `/타임아웃해제` — 타임아웃 수동 해제
- `/킥` — 멤버 추방 재확인 후 실행
- `/밴` — 멤버 영구 차단 재확인 후 실행
- `/밴해제` — 밴 ID 차단 해제
- `/차단목록` — 차단된 유저 목록 조회

### 4. 문의(티켓) & 집계 요약
- `/문의구성` (!!) — 초고도화 카테고리별 티켓 패널, 전용 채널 생성 및 접수(Claim)/닫기/로그
- `/일일요약` (!!) — 최근 24시간 핵심 운영 수치 요약
- `/주간요약` (!!) — 최근 7일간 운영 추세 집계
- `/월간요약` (!!) — 최근 30일간 운영 현황 집계
- `/명령어통계` (!!!) — **개발자 전용 (`1339604814631534667`)** 호출 건수, 성공률, 평균 응답속도 분석

### 5. 자동화 기능 (`!!` 관리자 전용)
- `/자동역할설정` — 신규 가입자(전체/유저/봇) 자동 역할 등록
- `/자동역할목록` — 등록된 자동 역할 규칙 페이징
- `/자동역할삭제` — 영향 범위 확인 후 삭제
- `/자동메시지설정` — 주기별 자동 공지 메시지 등록
- `/자동메시지목록` — 등록된 자동 메시지 목록
- `/자동메시지중지` — 자동 메시지 일시 중지/재개
- `/도움말` — 인터랙티브 카테고리별 전체 안내서

### 6. 서버 지식 위키 엔진
- `/위키문서작성` (!!) — 문서 슬러그, 제목, 마크다운 본문, 분류, 태그 저장
- `/위키문서편집` (!!) — 버전 충돌 감지 및 수정 이력 기록
- `/위키문서검색` — 제목/본문/태그 검색
- `/위키문서목록` — 전체 위키 문서 열람
- `/위키문서이동` (!!) — 슬러그 변경 및 상호 참조 트랜잭션 유지
- `/위키문서분류` — 분류 체계 및 문서 수 현황
- `/위키문서태그` — 태그 빈도 색인 조회
- `/위키문서연결` (!!) — 순환 참조 차단 문서 간 상호 링크
- `/위키문서링크` — 웹 영구 링크 URL 생성

### 7. 유틸리티 & 생활 도구
- `/계산기` — 괄호, 사칙연산, %, 거듭제곱 연산
- `/단위변환` — 길이, 무게, 온도, 속도 변환
- `/진법변환` — 2, 8, 10, 16진수 상호 변환
- `/날짜계산` — 날짜 간격 계산 및 일수 덧셈
- `/시간대변환` — KST, UTC, EST, PST, JST 변환
- `/타임스탬프변환` — Unix 타임스탬프와 Discord 포맷 변환
- `/초읽기` — 개인 타이머 및 종료 알림
- `/스톱워치` — 랩(Lap) 기록 지원 스톱워치
- `/d데이` — D-Day 및 경과일 계산
- `/확률계산` — 조합(nCr), 순열(nPr), 가챠 확률
- `/날씨` — 실시간 전세계 도시 날씨 및 기온
- `/환율` — 통화별 최신 환율 환산
- `/qr생성` — 텍스트/URL ➡️ 고해상도 QR 이미지
- `/qr읽기` — 첨부 이미지 QR 코드 디코딩
- `/파일정보` — 첨부 파일 포맷, 용량, MIME 분석
- `/이미지정보` — 가로x세로 해상도 및 포맷 분석

### 8. 미니게임 & 인터랙티브
- `/랜덤추첨` — **실시간 회전 룰렛 GIF 애니메이션** 및 중복 없는 추첨
- `/업다운` — 1~N 숫자 추측 업다운 게임
- `/타자연습` — 랜덤 한글 문장 속도/정확도 챌린지

### 9. 포인트 경제 시스템 (59 ~ 69)
- `/출석체크` — 1일 1회 포인트 + 연속 출석 스트릭 보너스
- `/포인트잔액` — 내 포인트 지갑 및 서버 순위
- `/포인트송금` — 다른 멤버에게 포인트 이체
- `/포인트도박` — 동전 던지기(2배) & 주사위(1.8배) 베팅
- `/포인트랭킹` — 명예의 전당 TOP 10
- `/포인트상점` — 등록된 역할 및 아이템 카탈로그
- `/포인트구매` — 상점 상품 포인트 즉시 구매
- `/포인트인벤토리` — 내 보유 아이템 목록
- `/포인트선물` — 인벤토리 아이템을 타 유저에게 선물
- `/포인트복권` — 500P 즉석 스크래치 복권 (최대 10,000P 잭팟)
- `/포인트관리` (!!) — 관리자 포인트 지급/차감/초기화

---

## 🚀 빠른 시작 및 웹 대시보드 연동 가이드

### 1. 환경 변수 설정 ([.env](file:///c:/Users/L/Downloads/Koharu/KCS/sora/.env))
```dotenv
# Discord Developer Portal 애플리케이션 정보
DISCORD_TOKEN=YOUR_BOT_TOKEN
DISCORD_CLIENT_ID=YOUR_APPLICATION_ID
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET

# Discord OAuth2 Redirect URI (웹 대시보드 로그인용)
# 개발 환경: http://localhost:3000/api/auth/callback
# Vercel 배포: https://sora.koharu.live/api/auth/callback
DISCORD_REDIRECT_URI=https://sora.koharu.live/api/auth/callback

# 개발자 ID (!!! 명령어 접근권한)
DEVELOPER_ID=1339604814631534667

# Phone Verification: Sendwich API (https://sendwich.kr)
SENDWICH_API_KEY=YOUR_SENDWICH_API_KEY

# Email Verification: Resend API (admin@koharu.live)
RESEND_API_KEY=YOUR_RESEND_API_KEY
RESEND_SENDER_EMAIL=admin@koharu.live

# Web Dashboard (Vercel)
PORT=3000
NEXT_PUBLIC_APP_URL=https://sora.koharu.live
JWT_SECRET=koharu_sora_super_secret_jwt_key_2026
```

> **📌 길드 ID(`DISCORD_GUILD_ID`)가 필요 없는 이유:**
> Sora는 글로벌 슬래시 커맨드(`Routes.applicationCommands(clientId)`)로 등록되므로 특정 서버 ID에 종속되지 않고, 봇이 초대된 전 세계 모든 디스코드 서버에서 즉시 작동합니다.

### 2. Discord Developer Portal 설정 (중요)
1. **OAuth2 ➡️ Redirects:**
   - `https://sora.koharu.live/api/auth/callback` 추가
   - 로컬 테스트 시: `http://localhost:3000/api/auth/callback` 추가
2. **봇 초대 링크 (Permissions: Administrator):**
   ```text
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&integration_type=0&scope=bot%20applications.commands
   ```

### 3. 법적 준수 문서 (법률 리스크 완벽 차단)
- 📜 **개인정보처리방침:** [web/src/app/privacy/page.tsx](file:///c:/Users/L/Downloads/Koharu/KCS/sora/web/src/app/privacy/page.tsx) (`/privacy`)
  - **휴대폰 번호 (Sendwich 연동):** 수집 목적, 수집 항목, 인증 후 원본 즉시 파기 및 단방향 해시(SHA-256) 최소 보관, (주)샌드위치 제3자 제공 고지
  - **이메일 주소 (Resend 연동):** 수집 목적, 1회용 인증 코드(OTP 5분 유효) 즉시 파기, Resend Inc. 발송 대행 제3자 제공 고지
  - **책임자:** `admin@koharu.live`
- ⚖️ **서비스 이용약관:** [web/src/app/terms/page.tsx](file:///c:/Users/L/Downloads/Koharu/KCS/sora/web/src/app/terms/page.tsx) (`/terms`)

### 2. 디스코드 봇 실행
```bash
cd sora
npm install
npm run build
npm start
```

### 3. Vercel 웹 대시보드 배포
```bash
cd sora/web
npm install
npm run build
# Vercel CLI 또는 GitHub 연동 배포
vercel --prod
```
