const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('news_item_url 컬럼 추가 마이그레이션 시작...');

    // 컬럼이 이미 존재하는지 확인
    db.all("PRAGMA table_info(HS_CONTENT_TB)", (err, rows) => {
        if (err) {
            console.error('테이블 정보 조회 실패:', err);
            return;
        }

        const existingColumns = rows.map(row => row.name);
        const urlColumns = ['news_item_url_1', 'news_item_url_2', 'news_item_url_3'];

        urlColumns.forEach((column, index) => {
            if (!existingColumns.includes(column)) {
                db.run(`ALTER TABLE HS_CONTENT_TB ADD COLUMN ${column} VARCHAR(500)`, (err) => {
                    if (err) {
                        console.error(`${column} 컬럼 추가 실패:`, err);
                    } else {
                        console.log(`${column} 컬럼 추가 완료`);
                    }
                });
            } else {
                console.log(`${column} 컬럼이 이미 존재합니다.`);
            }
        });
    });
});

db.close(() => {
    console.log('마이그레이션 완료');
});