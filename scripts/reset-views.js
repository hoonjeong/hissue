const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // VIEW_LOG 테이블 비우기
    db.run(`DELETE FROM VIEW_LOG`, (err) => {
        if (err) {
            console.error('VIEW_LOG 초기화 실패:', err);
        } else {
            console.log('VIEW_LOG 테이블 초기화 완료');
        }
    });

    // 모든 콘텐츠의 조회수를 0으로 초기화
    db.run(`UPDATE HS_CONTENT_TB SET score = 0`, (err) => {
        if (err) {
            console.error('조회수 초기화 실패:', err);
        } else {
            console.log('모든 콘텐츠 조회수 초기화 완료');
        }
    });
});

db.close();