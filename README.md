# HI! ISSUE! - 이슈 브리핑 서비스

AI가 최신 이슈를 자세하게 설명해드리는 이슈 브리핑 서비스입니다.

## 프로젝트 설명

구글 트렌드 RSS 피드에서 최근 이슈와 관련 뉴스를 수집하고, AI가 이를 분석하여 쉽고 자세하게 설명하는 이슈 브리핑 서비스입니다.

## 설치 방법

1. 의존성 설치
```bash
npm install
```

2. 데이터베이스 초기화
```bash
npm run init-db
```

3. 환경변수 설정
`.env` 파일을 생성하세요:
```bash
cp .env.example .env
nano .env
```

다음 값들을 설정하세요:
- `GEMINI_API_KEY`: [Google AI Studio](https://makersuite.google.com/app/apikey)에서 발급
- `ADMIN_CODE`: 관리자 페이지 접속 비밀번호
- `SESSION_SECRET`: 세션 보안을 위한 임의의 문자열

## 실행 방법

### 서버 실행
```bash
npm start
```

### RSS 수집 실행
```bash
npm run collect
```

## Crontab 설정

매일 정기적으로 RSS를 수집하려면:
```bash
crontab -e
```

다음 라인 추가:
```
0 7,19 * * * cd /프로젝트경로 && node scripts/collect-rss.js >> logs/collect.log 2>&1
```

## 주요 기능

- 구글 트렌드 RSS 피드 자동 수집
- Gemini AI를 통한 이슈 상세 설명 생성
- 키워드 검색 기능
- 조회수 기반 인기 콘텐츠 정렬
- 관리자 페이지 (콘텐츠 수정/삭제)
- SEO 최적화 (sitemap.xml, robots.txt 자동 생성)

## 관리자 페이지 접속

`/admin` 경로로 접속 후 관리자 코드 입력

## 보안 사항

- `.env` 파일은 절대 git에 커밋하지 마세요
- 관리자 코드는 주기적으로 변경하세요
- HTTPS 환경에서 운영을 권장합니다