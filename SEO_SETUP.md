# SEO 설정 가이드 - HI! ISSUE!

## 🎯 구글 검색 최적화 파일 설정 완료

### 1. robots.txt ✅
- 위치: `/robots.txt`
- 검색 엔진 크롤링 규칙 설정
- 관리자 페이지 차단
- 사이트맵 위치 명시

### 2. sitemap.xml ✅
- 동적 생성: `/sitemap.xml`
- 모든 콘텐츠 페이지 자동 포함
- 최신 업데이트 날짜 반영
- 수동 생성: `node scripts/generate-sitemap.js`

### 3. SEO 메타 태그 ✅
- Open Graph 태그 (Facebook, LinkedIn)
- Twitter Card 태그
- Canonical URL
- 구조화된 데이터

## 📝 Google Search Console 등록 방법

### Step 1: Search Console 접속
1. https://search.google.com/search-console 접속
2. Google 계정으로 로그인

### Step 2: 속성 추가
1. "속성 추가" 클릭
2. URL 접두어 선택
3. `https://hissue.kr` 입력

### Step 3: 소유권 확인
여러 방법 중 하나 선택:

#### 방법 1: HTML 파일 업로드 (권장)
1. Google에서 제공하는 HTML 파일 다운로드
2. 파일명 예시: `googleXXXXXXXX.html`
3. EC2 서버에 업로드:
```bash
# 로컬에서
scp -i your-key.pem googleXXXXXXXX.html ubuntu@서버IP:~/hissue/public/

# 또는 서버에서 직접 생성
nano ~/hissue/public/googleXXXXXXXX.html
# Google에서 제공한 내용 붙여넣기
```

#### 방법 2: HTML 태그 (대체 방법)
views/index.html의 <head>에 추가:
```html
<meta name="google-site-verification" content="제공된_코드" />
```

### Step 4: 사이트맵 제출
1. Search Console에서 "사이트맵" 메뉴 클릭
2. 사이트맵 URL 입력: `sitemap.xml`
3. 제출

## 🔍 네이버 서치어드바이저 등록

### Step 1: 서치어드바이저 접속
1. https://searchadvisor.naver.com 접속
2. 네이버 계정으로 로그인

### Step 2: 사이트 등록
1. "사이트 등록" 클릭
2. `https://hissue.kr` 입력

### Step 3: 소유권 확인
HTML 파일 업로드 또는 메타태그 추가

### Step 4: 사이트맵 제출
1. "요청" → "사이트맵 제출"
2. `https://hissue.kr/sitemap.xml` 입력

## 📊 추가 SEO 최적화 팁

### 1. 콘텐츠 최적화
- 제목에 키워드 포함
- 메타 설명 최적화 (150자 이내)
- 이미지 alt 태그 추가

### 2. 성능 최적화
- 페이지 로딩 속도 개선
- 모바일 반응형 디자인
- HTTPS 사용 (SSL 인증서)

### 3. 구조화된 데이터 (선택사항)
```javascript
// server.js에 추가 가능한 JSON-LD 예시
const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "HI! ISSUE!",
    "url": "https://hissue.kr",
    "description": "이슈 브리핑 서비스",
    "potentialAction": {
        "@type": "SearchAction",
        "target": "https://hissue.kr/?search={search_term_string}",
        "query-input": "required name=search_term_string"
    }
};
```

## ✅ 체크리스트

- [x] robots.txt 생성
- [x] sitemap.xml 동적 생성
- [x] Open Graph 메타 태그
- [x] Twitter Card 메타 태그
- [x] Canonical URL 설정
- [ ] Google Search Console 등록
- [ ] 네이버 서치어드바이저 등록
- [ ] 구글 애널리틱스 설치 (선택)
- [ ] 페이지 속도 최적화

## 🚀 서버 적용 명령어

```bash
# EC2 서버에서
cd ~/hissue
git pull
pm2 restart hissue

# 사이트맵 확인
curl https://hissue.kr/sitemap.xml

# robots.txt 확인
curl https://hissue.kr/robots.txt
```

## 📈 모니터링

등록 후 확인사항:
- Google Search Console에서 색인 상태 확인
- 검색 성능 리포트 확인
- 크롤링 오류 모니터링
- 모바일 사용성 확인