#!/bin/bash

# RSS 수집 스크립트를 매일 오전 7시와 오후 7시에 실행
# crontab에 추가할 내용:

echo "다음 라인을 crontab -e 명령어로 crontab에 추가하세요:"
echo ""
echo "# 하이 이슈 RSS 수집 (매일 오전 7시, 오후 7시)"
echo "0 7,19 * * * cd /home/user/hissue_project && /usr/bin/node scripts/collect-rss.js >> logs/collect.log 2>&1"
echo ""
echo "참고: /home/user/hissue_project 경로를 실제 프로젝트 경로로 변경하세요"
echo "참고: node 경로는 'which node' 명령어로 확인 가능합니다"