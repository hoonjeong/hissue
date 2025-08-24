require('dotenv').config();
const cron = require('node-cron');
const collectProducts = require('./collect-coupang-products');

console.log('쿠팡 상품 수집 스케줄러 시작');

// 매일 오전 6시와 오후 6시에 실행
cron.schedule('0 6,18 * * *', async () => {
    console.log(`[${new Date().toISOString()}] 스케줄된 수집 작업 시작`);
    try {
        await collectProducts();
    } catch (error) {
        console.error('스케줄된 수집 작업 실패:', error);
    }
});

// 서버 시작 시 즉시 한 번 실행
(async () => {
    console.log('서버 시작 시 초기 수집 실행');
    try {
        await collectProducts();
    } catch (error) {
        console.error('초기 수집 실패:', error);
    }
})();

console.log('스케줄러가 활성화되었습니다. 매일 오전 6시와 오후 6시에 수집이 실행됩니다.');