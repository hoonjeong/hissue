#!/bin/bash

echo "========================================="
echo "하이 이슈 EC2 배포 스크립트"
echo "========================================="

# OS 감지
if [ -f /etc/lsb-release ]; then
    OS="ubuntu"
    echo "✓ Ubuntu 시스템 감지"
else
    OS="amazon"
    echo "✓ Amazon Linux 시스템 감지"
fi

# 1. 시스템 업데이트
echo "1. 시스템 업데이트 중..."
if [ "$OS" = "ubuntu" ]; then
    sudo apt update
    sudo apt upgrade -y
else
    sudo yum update -y
fi

# 2. Node.js 18.x 설치
echo "2. Node.js 18.x 설치 중..."
if [ "$OS" = "ubuntu" ]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
fi

# 3. Git 설치
echo "3. Git 설치 중..."
if [ "$OS" = "ubuntu" ]; then
    sudo apt install git -y
else
    sudo yum install git -y
fi

# 4. PM2 설치
echo "4. PM2 설치 중..."
sudo npm install -g pm2

# 5. Nginx 설치
echo "5. Nginx 설치 중..."
if [ "$OS" = "ubuntu" ]; then
    sudo apt install nginx -y
else
    sudo amazon-linux-extras install nginx1 -y
fi

# 6. 프로젝트 클론
echo "6. 프로젝트 클론 중..."
cd ~
git clone https://github.com/hoonjeong/hissue.git
cd hissue

# 7. 의존성 설치
echo "7. NPM 패키지 설치 중..."
npm install

# 8. 환경변수 파일 생성 안내
echo ""
echo "========================================="
echo "✅ 기본 설치 완료!"
echo "========================================="
echo ""
echo "다음 단계를 수동으로 진행해주세요:"
echo ""
echo "1. 환경변수 파일 생성:"
echo "   nano .env"
echo ""
echo "2. 다음 내용 입력 후 저장:"
echo "   GEMINI_API_KEY=your_actual_api_key"
echo "   ADMIN_CODE=your_admin_password"
echo "   SESSION_SECRET=random_long_string"
echo "   PORT=3000"
echo ""
echo "3. 데이터베이스 초기화:"
echo "   npm run init-db"
echo ""
echo "4. PM2로 앱 시작:"
echo "   pm2 start server.js --name hissue"
echo "   pm2 save"
echo "   pm2 startup"
echo ""
echo "5. Nginx 설정 후 재시작:"
echo "   sudo nano /etc/nginx/sites-available/hissue (Ubuntu)"
echo "   sudo nano /etc/nginx/conf.d/hissue.conf (Amazon Linux)"
echo "   sudo systemctl restart nginx"
echo ""
echo "========================================="