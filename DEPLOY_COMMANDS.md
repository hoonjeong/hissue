# 🚀 EC2 빠른 배포 명령어

## 1. EC2 접속 후 복사-붙여넣기 명령어

### Step 1: 초기 설정 스크립트 다운로드 및 실행
```bash
wget https://raw.githubusercontent.com/hoonjeong/hissue/main/ec2-setup.sh
chmod +x ec2-setup.sh
./ec2-setup.sh
```

### Step 2: 환경변수 설정
```bash
cd ~/hissue
cat > .env << EOF
GEMINI_API_KEY=YOUR_API_KEY_HERE
ADMIN_CODE=admin123
SESSION_SECRET=$(openssl rand -base64 32)
PORT=3000
EOF
```

### Step 3: 데이터베이스 초기화 및 앱 시작
```bash
npm run init-db
pm2 start server.js --name hissue
pm2 save
pm2 startup
```

### Step 4: Nginx 설정 (Ubuntu)
```bash
sudo wget https://raw.githubusercontent.com/hoonjeong/hissue/main/nginx-config.conf -O /etc/nginx/sites-available/hissue
sudo ln -s /etc/nginx/sites-available/hissue /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 4: Nginx 설정 (Amazon Linux)
```bash
sudo wget https://raw.githubusercontent.com/hoonjeong/hissue/main/nginx-config.conf -O /etc/nginx/conf.d/hissue.conf
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Step 5: Crontab 설정 (자동 RSS 수집)
```bash
(crontab -l 2>/dev/null; echo "0 7,19 * * * cd ~/hissue && /usr/bin/node scripts/collect-rss.js >> logs/collect.log 2>&1") | crontab -
mkdir -p ~/hissue/logs
```

## 2. AWS 보안 그룹 설정

AWS 콘솔에서 다음 인바운드 규칙 추가:
- HTTP (80) : 0.0.0.0/0
- HTTPS (443) : 0.0.0.0/0 (SSL 사용 시)
- SSH (22) : 내 IP

## 3. 접속 확인
```
http://3.39.192.37
```

## 4. 관리자 페이지
```
http://3.39.192.37/admin
비밀번호: admin123 (또는 .env에 설정한 ADMIN_CODE)
```

## 5. 유용한 관리 명령어

### 앱 상태 확인
```bash
pm2 status
pm2 logs hissue
```

### 앱 재시작
```bash
pm2 restart hissue
```

### 앱 업데이트
```bash
cd ~/hissue
git pull
npm install
pm2 restart hissue
```

### 수동 RSS 수집
```bash
cd ~/hissue
node scripts/collect-rss.js
```

### 로그 확인
```bash
# PM2 로그
pm2 logs hissue --lines 50

# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log

# 수집 로그
tail -f ~/hissue/logs/collect.log
```

## ⚠️ 중요 사항

1. **API 키 설정**: `.env` 파일의 `GEMINI_API_KEY`를 실제 API 키로 변경하세요
   - Gemini API 키 받기: https://makersuite.google.com/app/apikey

2. **관리자 비밀번호 변경**: `.env` 파일의 `ADMIN_CODE`를 안전한 비밀번호로 변경하세요

3. **보안 그룹**: AWS 콘솔에서 80번 포트를 반드시 열어주세요

4. **백업**: 정기적으로 데이터베이스 백업을 수행하세요
   ```bash
   cp ~/hissue/hissue.db ~/hissue/backup/hissue_$(date +%Y%m%d).db
   ```