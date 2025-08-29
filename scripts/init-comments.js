const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 사용자 닉네임 테이블
    db.run(`CREATE TABLE IF NOT EXISTS USER_NICKNAME (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id VARCHAR(100) UNIQUE NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('USER_NICKNAME 테이블 생성 실패:', err);
        } else {
            console.log('USER_NICKNAME 테이블 생성 완료');
        }
    });

    // 댓글 테이블
    db.run(`CREATE TABLE IF NOT EXISTS COMMENTS (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER NOT NULL,
        content_type VARCHAR(20) DEFAULT 'news',
        session_id VARCHAR(100) NOT NULL,
        nickname VARCHAR(50) NOT NULL,
        comment_text TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        dislikes INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY (content_id) REFERENCES HS_CONTENT_TB(id)
    )`, (err) => {
        if (err) {
            console.error('COMMENTS 테이블 생성 실패:', err);
        } else {
            console.log('COMMENTS 테이블 생성 완료');
        }
    });

    // 댓글 좋아요/싫어요 기록 테이블
    db.run(`CREATE TABLE IF NOT EXISTS COMMENT_VOTES (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        session_id VARCHAR(100) NOT NULL,
        vote_type VARCHAR(10) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, session_id),
        FOREIGN KEY (comment_id) REFERENCES COMMENTS(id)
    )`, (err) => {
        if (err) {
            console.error('COMMENT_VOTES 테이블 생성 실패:', err);
        } else {
            console.log('COMMENT_VOTES 테이블 생성 완료');
        }
    });

    // 인덱스 생성
    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_content_id ON COMMENTS(content_id, content_type)`, (err) => {
        if (err) {
            console.error('comments content_id 인덱스 생성 실패:', err);
        } else {
            console.log('comments content_id 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_created_at ON COMMENTS(created_at DESC)`, (err) => {
        if (err) {
            console.error('comments created_at 인덱스 생성 실패:', err);
        } else {
            console.log('comments created_at 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_comments_likes ON COMMENTS(likes DESC)`, (err) => {
        if (err) {
            console.error('comments likes 인덱스 생성 실패:', err);
        } else {
            console.log('comments likes 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_user_nickname_session ON USER_NICKNAME(session_id)`, (err) => {
        if (err) {
            console.error('user_nickname session_id 인덱스 생성 실패:', err);
        } else {
            console.log('user_nickname session_id 인덱스 생성 완료');
        }
    });

    db.run(`CREATE INDEX IF NOT EXISTS idx_comment_votes ON COMMENT_VOTES(comment_id, session_id)`, (err) => {
        if (err) {
            console.error('comment_votes 인덱스 생성 실패:', err);
        } else {
            console.log('comment_votes 인덱스 생성 완료');
        }
    });
});

db.close();