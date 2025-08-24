#!/bin/bash

# AWS EC2 자동 배포 스크립트
# 이 스크립트를 EC2 서버에서 실행하세요

echo "========================================"
echo "하이 이슈 배포 스크립트 시작"
echo "========================================"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# OS 감지
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo -e "${RED}OS를 감지할 수 없습니다${NC}"
    exit 1
fi

echo -e "${GREEN}감지된 OS: $OS${NC}"

# 1. 시스템 업데이트
echo -e "${YELLOW}1. 시스템 업데이트 중...${NC}"
if [ "$OS" = "ubuntu" ]; then
    sudo apt update
    sudo apt upgrade -y
elif [ "$OS" = "amzn" ]; then
    sudo yum update -y
fi

# 2. Node.js 설치
echo -e "${YELLOW}2. Node.js 설치 중...${NC}"
if ! command -v node &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ "$OS" = "amzn" ]; then
        curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    fi
else
    echo -e "${GREEN}Node.js가 이미 설치되어 있습니다${NC}"
fi

# 3. Git 설치
echo -e "${YELLOW}3. Git 설치 중...${NC}"
if ! command -v git &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        sudo apt install git -y
    elif [ "$OS" = "amzn" ]; then
        sudo yum install git -y
    fi
else
    echo -e "${GREEN}Git이 이미 설치되어 있습니다${NC}"
fi

# 4. PM2 설치
echo -e "${YELLOW}4. PM2 설치 중...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo -e "${GREEN}PM2가 이미 설치되어 있습니다${NC}"
fi

# 5. Nginx 설치
echo -e "${YELLOW}5. Nginx 설치 중...${NC}"
if ! command -v nginx &> /dev/null; then
    if [ "$OS" = "ubuntu" ]; then
        sudo apt install nginx -y
    elif [ "$OS" = "amzn" ]; then
        sudo yum install nginx -y
    fi
else
    echo -e "${GREEN}Nginx가 이미 설치되어 있습니다${NC}"
fi

# 6. 프로젝트 클론
echo -e "${YELLOW}6. 프로젝트 클론 중...${NC}"
cd ~
if [ ! -d "hissue" ]; then
    git clone https://github.com/hoonjeong/hissue.git
    cd hissue
else
    echo -e "${GREEN}프로젝트가 이미 존재합니다. 업데이트 중...${NC}"
    cd hissue
    git pull
fi

# 7. 의존성 설치
echo -e "${YELLOW}7. npm 패키지 설치 중...${NC}"
npm install

# 8. .env 파일 생성
echo -e "${YELLOW}8. 환경변수 설정...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}================================${NC}"
    echo -e "${RED}중요: .env 파일을 생성해야 합니다${NC}"
    echo -e "${RED}================================${NC}"
    echo ""
    echo "다음 내용으로 .env 파일을 생성하세요:"
    echo ""
    echo "nano .env"
    echo ""
    echo "그리고 다음 내용을 입력:"
    echo "GEMINI_API_KEY=your_gemini_api_key_here"
    echo "ADMIN_CODE=your_admin_code_here"
    echo "SESSION_SECRET=your_random_secret_here"
    echo "PORT=3000"
    echo ""
    echo -e "${YELLOW}Gemini API 키 받기: https://makersuite.google.com/app/apikey${NC}"
    echo ""
    echo ".env 파일 생성 후 다시 이 스크립트를 실행하세요."
    exit 1
else
    echo -e "${GREEN}.env 파일이 이미 존재합니다${NC}"
fi

# 9. 데이터베이스 초기화
echo -e "${YELLOW}9. 데이터베이스 초기화 중...${NC}"
npm run init-db

# 10. PM2 설정
echo -e "${YELLOW}10. PM2 설정 중...${NC}"
if [ ! -f ecosystem.config.js ]; then
    cat > ecosystem.config.js << 'EOF'
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
EOF
fi

# PM2 시작
pm2 delete hissue 2>/dev/null
pm2 start ecosystem.config.js
pm2 save

# 11. Nginx 설정
echo -e "${YELLOW}11. Nginx 설정 중...${NC}"
sudo tee /etc/nginx/sites-available/hissue > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

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
EOF

# Nginx 설정 활성화
if [ "$OS" = "ubuntu" ]; then
    sudo ln -sf /etc/nginx/sites-available/hissue /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
elif [ "$OS" = "amzn" ]; then
    sudo cp /etc/nginx/sites-available/hissue /etc/nginx/conf.d/hissue.conf
fi

# Nginx 재시작
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 12. 로그 디렉토리 생성
echo -e "${YELLOW}12. 로그 디렉토리 생성 중...${NC}"
mkdir -p ~/hissue/logs

# 13. Crontab 설정
echo -e "${YELLOW}13. Crontab 설정 중...${NC}"
(crontab -l 2>/dev/null | grep -v "collect-rss.js"; echo "0 7,19 * * * cd $HOME/hissue && /usr/bin/node scripts/collect-rss.js >> logs/collect.log 2>&1") | crontab -

# 14. 첫 데이터 수집
echo -e "${YELLOW}14. 첫 RSS 데이터 수집 중...${NC}"
cd ~/hissue
node scripts/collect-rss.js

echo "========================================"
echo -e "${GREEN}배포가 완료되었습니다!${NC}"
echo "========================================"
echo ""
echo "접속 주소: http://$(curl -s ifconfig.me)"
echo "관리자 페이지: http://$(curl -s ifconfig.me)/admin"
echo "관리자 코드: hi2025issue"
echo ""
echo "PM2 상태 확인: pm2 status"
echo "PM2 로그 확인: pm2 logs"
echo "Nginx 상태 확인: sudo systemctl status nginx"
echo ""
echo -e "${YELLOW}보안 그룹에서 80번 포트가 열려있는지 확인하세요!${NC}"