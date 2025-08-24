# AWS EC2 배포 가이드

## 1. EC2 인스턴스 접속

### Windows에서 접속 (PuTTY 사용)
1. PuTTY 다운로드: https://www.putty.org/
2. PEM 키를 PPK로 변환 (PuTTYgen 사용)
3. PuTTY에서 접속:
   - Host Name: `ubuntu@3.39.192.37` (또는 `ec2-user@3.39.192.37`)
   - Connection > SSH > Auth에서 PPK 파일 선택
   - Open 클릭

### Mac/Linux에서 접속
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@3.39.192.37
# 또는 Amazon Linux의 경우
ssh -i your-key.pem ec2-user@3.39.192.37
```

## 2. 서버 초기 설정

EC2에 접속한 후 다음 명령어를 순서대로 실행하세요:

### 2.1 시스템 업데이트
```bash
# Ubuntu의 경우
sudo apt update
sudo apt upgrade -y

# Amazon Linux의 경우
sudo yum update -y
```

### 2.2 Node.js 18.x 설치
```bash
# Ubuntu의 경우
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Amazon Linux의 경우
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 2.3 Git 설치
```bash
# Ubuntu의 경우
sudo apt install git -y

# Amazon Linux의 경우
sudo yum install git -y
```

### 2.4 PM2 설치 (프로세스 관리자)
```bash
sudo npm install -g pm2
```

### 2.5 Nginx 설치 (웹서버/리버스 프록시)
```bash
# Ubuntu의 경우
sudo apt install nginx -y

# Amazon Linux의 경우
sudo yum install nginx -y
```

## 3. 애플리케이션 배포

### 3.1 프로젝트 클론
```bash
cd /home/ubuntu  # 또는 /home/ec2-user
git clone https://github.com/hoonjeong/hissue.git
cd hissue
```

### 3.2 의존성 설치
```bash
npm install
```

### 3.3 환경변수 파일 생성
```bash
nano .env
```

다음 내용을 입력하고 저장 (Ctrl+X, Y, Enter):
```
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
ADMIN_CODE=YOUR_ADMIN_CODE_HERE
SESSION_SECRET=YOUR_RANDOM_SECRET_HERE
PORT=3000
```

**중요**: 
- `YOUR_GEMINI_API_KEY_HERE`를 실제 Gemini API 키로 교체하세요
- Gemini API 키 받기: https://makersuite.google.com/app/apikey
- `YOUR_ADMIN_CODE_HERE`를 원하는 관리자 비밀번호로 변경하세요
- `YOUR_RANDOM_SECRET_HERE`를 임의의 긴 문자열로 변경하세요

### 3.4 데이터베이스 초기화
```bash
npm run init-db
```

### 3.5 첫 데이터 수집 (선택사항)
```bash
npm run collect
```

## 4. PM2로 애플리케이션 실행

### 4.1 PM2 설정 파일 생성
```bash
nano ecosystem.config.js
```

다음 내용 입력:
```javascript
module.exports = {
  apps: [{
    name: 'hissue',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### 4.2 PM2로 앱 시작
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# 위 명령어 실행 후 나오는 sudo 명령어를 복사해서 실행
```

### 4.3 PM2 상태 확인
```bash
pm2 status
pm2 logs
```

## 5. Nginx 설정

### 5.1 Nginx 설정 파일 생성
```bash
sudo nano /etc/nginx/sites-available/hissue
```

다음 내용 입력:
```nginx
server {
    listen 80;
    server_name 3.39.192.37;  # 나중에 도메인으로 변경 가능

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.2 설정 활성화
```bash
# Ubuntu의 경우
sudo ln -s /etc/nginx/sites-available/hissue /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # 기본 설정 제거

# Amazon Linux의 경우 (sites-available이 없는 경우)
sudo nano /etc/nginx/conf.d/hissue.conf
# 위의 server 블록 내용을 입력
```

### 5.3 Nginx 재시작
```bash
sudo nginx -t  # 설정 테스트
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 6. 방화벽 설정

EC2 보안 그룹에서 다음 포트를 열어야 합니다:
- **인바운드 규칙**:
  - HTTP (80) - 모든 IP (0.0.0.0/0)
  - HTTPS (443) - 모든 IP (0.0.0.0/0) (SSL 사용시)
  - SSH (22) - 관리자 IP만

AWS 콘솔에서:
1. EC2 > 인스턴스 > 보안 그룹 클릭
2. 인바운드 규칙 편집
3. 규칙 추가:
   - Type: HTTP, Port: 80, Source: 0.0.0.0/0
   - Type: HTTPS, Port: 443, Source: 0.0.0.0/0

## 7. Crontab 설정 (자동 RSS 수집)

```bash
crontab -e
```

다음 라인 추가:
```bash
0 7,19 * * * cd /home/ubuntu/hissue && /usr/bin/node scripts/collect-rss.js >> logs/collect.log 2>&1
```

로그 디렉토리 생성:
```bash
mkdir -p /home/ubuntu/hissue/logs
```

## 8. 접속 테스트

브라우저에서 접속:
```
http://3.39.192.37
```

## 9. 유용한 명령어

### 서버 상태 확인
```bash
pm2 status
pm2 logs
pm2 restart hissue
```

### Nginx 관리
```bash
sudo systemctl status nginx
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log
```

### 애플리케이션 업데이트
```bash
cd /home/ubuntu/hissue
git pull
npm install
pm2 restart hissue
```

## 10. 문제 해결

### 포트 3000이 이미 사용 중인 경우
```bash
sudo lsof -i :3000
sudo kill -9 [PID]
```

### PM2 프로세스 재시작
```bash
pm2 delete all
pm2 start ecosystem.config.js
```

### Nginx 에러 확인
```bash
sudo tail -f /var/log/nginx/error.log
```

## 11. SSL 인증서 설정 (선택사항)

도메인이 있는 경우 Let's Encrypt 무료 SSL:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

---

## 주의사항
- `.env` 파일의 API 키는 절대 GitHub에 올리지 마세요
- 정기적으로 서버를 업데이트하세요
- PM2 로그를 주기적으로 확인하세요
- 데이터베이스는 주기적으로 백업하세요