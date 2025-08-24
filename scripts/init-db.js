const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS HS_CONTENT_TB (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword VARCHAR(100),
        news_item_title_1 VARCHAR(500),
        news_item_title_2 VARCHAR(500),
        news_item_title_3 VARCHAR(500),
        news_item_picture_1 VARCHAR(500),
        news_item_picture_2 VARCHAR(500),
        news_item_picture_3 VARCHAR(500),
        news_item_source_1 VARCHAR(100),
        news_item_source_2 VARCHAR(100),
        news_item_source_3 VARCHAR(100),
        prompt TEXT,
        subject VARCHAR(500),
        content TEXT,
        score INTEGER DEFAULT 0,
        insert_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('테이블 생성 실패:', err);
        } else {
            console.log('HS_CONTENT_TB 테이블 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_keyword ON HS_CONTENT_TB(keyword)`, (err) => {
        if (err) {
            console.error('keyword 인덱스 생성 실패:', err);
        } else {
            console.log('keyword 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_subject ON HS_CONTENT_TB(subject)`, (err) => {
        if (err) {
            console.error('subject 인덱스 생성 실패:', err);
        } else {
            console.log('subject 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_insert_time ON HS_CONTENT_TB(insert_time DESC)`, (err) => {
        if (err) {
            console.error('insert_time 인덱스 생성 실패:', err);
        } else {
            console.log('insert_time 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_score ON HS_CONTENT_TB(score DESC)`, (err) => {
        if (err) {
            console.error('score 인덱스 생성 실패:', err);
        } else {
            console.log('score 인덱스 생성 완료');
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS VIEW_LOG (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER,
        ip_address VARCHAR(50),
        view_date DATE DEFAULT (DATE('now')),
        UNIQUE(content_id, ip_address, view_date)
    )`, (err) => {
        if (err) {
            console.error('VIEW_LOG 테이블 생성 실패:', err);
        } else {
            console.log('VIEW_LOG 테이블 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_view_log ON VIEW_LOG(content_id, ip_address, view_date)`, (err) => {
        if (err) {
            console.error('view_log 인덱스 생성 실패:', err);
        } else {
            console.log('view_log 인덱스 생성 완료');
        }
    });
});

db.close();