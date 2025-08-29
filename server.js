require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const cookieParser = require('cookie-parser');
// const cron = require('node-cron'); // 시스템 crontab 사용으로 비활성화
// const collectCoupangProducts = require('./scripts/collect-coupang-products'); // 시스템 crontab 사용으로 비활성화

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, 'hissue.db');
const db = new sqlite3.Database(dbPath);

// 랜덤 한글 닉네임 생성 함수
function generateRandomNickname() {
    const first = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
    const middle = ['람', '림', '롬', '룸', '렘', '밤', '빔', '봄', '붐', '뱀', '샘', '심', '솜', '숨', '슴'];
    const last = ['비', '디', '기', '니', '리', '미', '시', '이', '지', '치', '키', '티', '피', '히', '위'];
    
    const randomFirst = first[Math.floor(Math.random() * first.length)];
    const randomMiddle = middle[Math.floor(Math.random() * middle.length)];
    const randomLast = last[Math.floor(Math.random() * last.length)];
    
    return `익명의${randomFirst}${randomMiddle}${randomLast}`;
}

// 세션별 닉네임 가져오기 또는 생성
async function getUserNickname(sessionId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT nickname FROM USER_NICKNAME WHERE session_id = ?', [sessionId], (err, row) => {
            if (err) {
                reject(err);
            } else if (row) {
                resolve(row.nickname);
            } else {
                const nickname = generateRandomNickname();
                db.run('INSERT INTO USER_NICKNAME (session_id, nickname) VALUES (?, ?)', 
                    [sessionId, nickname], 
                    (err) => {
                        if (err) reject(err);
                        else resolve(nickname);
                    }
                );
            }
        });
    });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'hissue-secret-key-2024',
    resave: false,
    saveUninitialized: true,  // 세션이 항상 저장되도록 변경
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000  // 30일로 연장
    }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'views'));

function getIpAddress(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           req.connection.socket.remoteAddress;
}

app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const sortType = req.query.sort;
    
    let query, countQuery, params, countParams;
    
    if (sortType === 'score') {
        // 최근 2일간의 조회수 순으로 정렬
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
        
        query = `
            SELECT c.id, c.keyword, c.subject, c.content, c.score, c.insert_time, c.news_item_picture_1,
                   COALESCE(v.recent_views, 0) as recent_views
            FROM HS_CONTENT_TB c
            LEFT JOIN (
                SELECT content_id, COUNT(*) as recent_views
                FROM VIEW_LOG
                WHERE view_date >= ?
                GROUP BY content_id
            ) v ON c.id = v.content_id`;
        
        countQuery = `SELECT COUNT(*) as total FROM HS_CONTENT_TB`;
        params = [twoDaysAgoStr];
        countParams = [];
        
        if (search) {
            query += ` WHERE c.subject LIKE ? OR c.content LIKE ?`;
            countQuery += ` WHERE subject LIKE ? OR content LIKE ?`;
            params.push(`%${search}%`, `%${search}%`);
            countParams = [`%${search}%`, `%${search}%`];
        }
        
        query += ` ORDER BY recent_views DESC, c.insert_time DESC LIMIT ? OFFSET ?`;
    } else {
        // 기본 정렬 (최신순)
        query = `SELECT id, keyword, subject, content, score, insert_time, news_item_picture_1 
                 FROM HS_CONTENT_TB`;
        countQuery = `SELECT COUNT(*) as total FROM HS_CONTENT_TB`;
        params = [];
        countParams = [];
        
        if (search) {
            query += ` WHERE subject LIKE ? OR content LIKE ?`;
            countQuery += ` WHERE subject LIKE ? OR content LIKE ?`;
            params = [`%${search}%`, `%${search}%`];
            countParams = [`%${search}%`, `%${search}%`];
        }
        
        query += ` ORDER BY insert_time DESC LIMIT ? OFFSET ?`;
    }
    
    params.push(limit, offset);
    
    db.get(countQuery, countParams, (err, countRow) => {
        if (err) {
            return res.status(500).send('서버 오류');
        }
        
        db.all(query, params, (err, rows) => {
            if (err) {
                return res.status(500).send('서버 오류');
            }
            
            // 최신 콘텐츠의 시간 가져오기
            db.get(`SELECT insert_time FROM HS_CONTENT_TB ORDER BY insert_time DESC LIMIT 1`, (err, latestRow) => {
                let lastUpdate = '';
                if (!err && latestRow && latestRow.insert_time) {
                    const date = new Date(latestRow.insert_time);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    lastUpdate = `${year}.${month}.${day} ${hours}:${minutes}`;
                }
                
                const totalPages = Math.ceil(countRow.total / limit);
                res.render('index', { 
                    contents: rows, 
                    currentPage: page, 
                    totalPages: totalPages,
                    search: search,
                    sort: req.query.sort || 'recent',
                    lastUpdate: lastUpdate
                });
            });
        });
    });
});

app.get('/content/:id', (req, res) => {
    const contentId = req.params.id;
    const ipAddress = getIpAddress(req);
    const today = new Date().toISOString().split('T')[0];
    
    // 먼저 오늘 이미 조회했는지 확인
    db.get(`SELECT 1 FROM VIEW_LOG WHERE content_id = ? AND ip_address = ? AND view_date = ?`,
        [contentId, ipAddress, today], (err, exists) => {
        
        if (!exists) {
            // 조회 기록이 없으면 INSERT하고 score 증가
            db.run(`INSERT INTO VIEW_LOG (content_id, ip_address, view_date) VALUES (?, ?, ?)`,
                [contentId, ipAddress, today], (insertErr) => {
                if (!insertErr) {
                    db.run(`UPDATE HS_CONTENT_TB SET score = score + 1 WHERE id = ?`, [contentId], (updateErr) => {
                        // 업데이트 완료 후 페이지 로드
                        loadContentPage();
                    });
                } else {
                    loadContentPage();
                }
            });
        } else {
            // 이미 조회한 경우 바로 페이지 로드
            loadContentPage();
        }
    });
    
    function loadContentPage() {
        db.get(`SELECT * FROM HS_CONTENT_TB WHERE id = ?`, [contentId], (err, row) => {
            if (err || !row) {
                return res.status(404).send('콘텐츠를 찾을 수 없습니다');
            }
            
            db.get(`SELECT id FROM HS_CONTENT_TB WHERE id < ? ORDER BY id DESC LIMIT 1`, 
                [contentId], (err, prevRow) => {
                db.get(`SELECT id FROM HS_CONTENT_TB WHERE id > ? ORDER BY id ASC LIMIT 1`, 
                    [contentId], (err, nextRow) => {
                    res.render('content', {
                        content: row,
                        prevId: prevRow ? prevRow.id : null,
                        nextId: nextRow ? nextRow.id : null
                    });
                });
            });
        });
    }
});

// Sitemap 동적 생성
app.get('/sitemap.xml', async (req, res) => {
    try {
        const { generateSitemap } = require('./scripts/generate-sitemap');
        const xml = await generateSitemap();
        res.header('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) {
        console.error('Sitemap generation error:', err);
        res.status(500).send('Error generating sitemap');
    }
});

app.get('/admin', (req, res) => {
    if (req.session.isAdmin) {
        return res.redirect('/admin/list');
    }
    res.render('admin-login');
});

app.post('/admin/login', (req, res) => {
    if (req.body.adminCode === process.env.ADMIN_CODE) {
        req.session.isAdmin = true;
        return res.redirect('/admin/list');
    }
    res.redirect('/admin?error=1');
});

app.get('/admin/list', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }
    
    const search = req.query.search || '';
    let query = `SELECT id, subject, insert_time FROM HS_CONTENT_TB`;
    let params = [];
    
    if (search) {
        query += ` WHERE subject LIKE ?`;
        params.push(`%${search}%`);
    }
    
    query += ` ORDER BY insert_time DESC`;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).send('서버 오류');
        }
        res.render('admin-list', { contents: rows, search: search });
    });
});

// 쿠팡 베스트 상품 리스트 페이지
app.get('/coupang', (req, res) => {
    const sort = req.query.sort || 'gap';  // 기본 정렬을 가격변동순으로 변경
    const search = req.query.search || '';
    const isRocket = req.query.rocket === 'true';
    const isFreeShipping = req.query.free === 'true';
    
    // 최신 update_number 조회
    db.get('SELECT MAX(update_number) as max_num FROM CP_PRODUCT_TB', (err, row) => {
        if (err || !row || row.max_num === null) {
            return res.render('coupang-list', { 
                products: [], 
                search, 
                sort, 
                isRocket, 
                isFreeShipping 
            });
        }
        
        const latestUpdateNumber = row.max_num;
        
        let query = `SELECT * FROM CP_PRODUCT_TB WHERE update_number = ?`;
        let params = [latestUpdateNumber];
        
        if (search) {
            query += ` AND productName LIKE ?`;
            params.push(`%${search}%`);
        }
        
        if (isRocket) {
            query += ` AND isRocket = 1`;
        }
        
        if (isFreeShipping) {
            query += ` AND isFreeShipping = 1`;
        }
        
        // 정렬 조건
        switch(sort) {
            case 'price_asc':
                query += ` ORDER BY productPrice ASC`;
                break;
            case 'price_desc':
                query += ` ORDER BY productPrice DESC`;
                break;
            case 'name':
                query += ` ORDER BY productName ASC`;
                break;
            case 'gap':
                query += ` ORDER BY priceGap ASC`;  // 많이 내린순(음수가 더 작은 값)
                break;
            default:
                query += ` ORDER BY priceGap ASC`;  // 기본값도 가격변동순(많이 내린순)
        }
        
        db.all(query, params, (err, products) => {
            if (err) {
                console.error('상품 조회 오류:', err);
                products = [];
            }
            
            res.render('coupang-list', { 
                products: products || [], 
                search, 
                sort, 
                isRocket, 
                isFreeShipping 
            });
        });
    });
});

// 쿠팡 상품 상세 페이지
app.get('/coupang/product/:productId', (req, res) => {
    const productId = req.params.productId;
    
    // 최신 상품 정보 조회
    db.get(`
        SELECT * FROM CP_PRODUCT_TB 
        WHERE productId = ? 
        ORDER BY update_number DESC 
        LIMIT 1
    `, [productId], (err, product) => {
        if (err || !product) {
            return res.status(404).send('상품을 찾을 수 없습니다');
        }
        
        // 가격 변동 이력 조회 (최근 10개)
        db.all(`
            SELECT productPrice, insert_time 
            FROM CP_PRODUCT_TB 
            WHERE productId = ? 
            ORDER BY update_number DESC 
            LIMIT 10
        `, [productId], (err, priceHistory) => {
            if (err) {
                priceHistory = [];
            }
            
            res.render('coupang-detail', { 
                product, 
                priceHistory: priceHistory || []
            });
        });
    });
});

app.get('/admin/edit/:id', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }
    
    db.get(`SELECT * FROM HS_CONTENT_TB WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) {
            return res.status(404).send('콘텐츠를 찾을 수 없습니다');
        }
        res.render('admin-edit', { content: row });
    });
});

app.post('/admin/update/:id', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }
    
    const { subject, content } = req.body;
    db.run(`UPDATE HS_CONTENT_TB SET subject = ?, content = ? WHERE id = ?`,
        [subject, content, req.params.id], (err) => {
        if (err) {
            return res.status(500).send('업데이트 실패');
        }
        res.redirect('/admin/list');
    });
});

app.post('/admin/delete/:id', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin');
    }
    
    db.run(`DELETE FROM HS_CONTENT_TB WHERE id = ?`, [req.params.id], (err) => {
        if (err) {
            return res.status(500).send('삭제 실패');
        }
        res.redirect('/admin/list');
    });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/admin/force-update', async (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(401).json({ success: false, error: '권한이 없습니다' });
    }
    
    try {
        // collect-rss.js 스크립트를 실행
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        console.log('강제 업데이트 시작...');
        const { stdout, stderr } = await execPromise('node scripts/collect-rss.js', {
            cwd: __dirname,
            timeout: 300000 // 5분 타임아웃
        });
        
        if (stderr) {
            console.error('업데이트 에러:', stderr);
        }
        
        console.log('업데이트 결과:', stdout);
        
        // 결과에서 숫자 추출
        const newMatch = stdout.match(/새로운 콘텐츠 (\d+)개/);
        const updateMatch = stdout.match(/업데이트된 콘텐츠 (\d+)개/);
        
        const newCount = newMatch ? parseInt(newMatch[1]) : 0;
        const updatedCount = updateMatch ? parseInt(updateMatch[1]) : 0;
        
        res.json({ 
            success: true, 
            newCount: newCount,
            updatedCount: updatedCount,
            message: stdout 
        });
    } catch (error) {
        console.error('강제 업데이트 실패:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || '업데이트 실행 중 오류가 발생했습니다' 
        });
    }
});

// 댓글 API 엔드포인트들

// 댓글 목록 가져오기
app.get('/api/comments/:contentId', async (req, res) => {
    const contentId = req.params.contentId;
    const contentType = req.query.type || 'news';
    const sortType = req.query.sort || 'latest';
    const sessionId = req.sessionID;
    
    try {
        // 베스트 댓글 3개 가져오기
        const bestComments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.*, 
                       (SELECT vote_type FROM COMMENT_VOTES WHERE comment_id = c.id AND session_id = ?) as user_vote
                FROM COMMENTS c
                WHERE c.content_id = ? AND c.content_type = ? AND c.deleted_at IS NULL
                ORDER BY c.likes DESC
                LIMIT 3
            `, [sessionId, contentId, contentType], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // 정렬 기준 설정
        let orderBy = 'c.created_at DESC';
        if (sortType === 'likes') {
            orderBy = 'c.likes DESC, c.created_at DESC';
        } else if (sortType === 'dislikes') {
            orderBy = 'c.dislikes DESC, c.created_at DESC';
        }
        
        // 일반 댓글 가져오기
        const comments = await new Promise((resolve, reject) => {
            db.all(`
                SELECT c.*,
                       (SELECT vote_type FROM COMMENT_VOTES WHERE comment_id = c.id AND session_id = ?) as user_vote
                FROM COMMENTS c
                WHERE c.content_id = ? AND c.content_type = ? AND c.deleted_at IS NULL
                ORDER BY ${orderBy}
            `, [sessionId, contentId, contentType], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // 댓글 총 개수
        const totalCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM COMMENTS WHERE content_id = ? AND content_type = ? AND deleted_at IS NULL', 
                [contentId, contentType], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        res.json({
            success: true,
            bestComments,
            comments,
            totalCount,
            sessionId
        });
    } catch (error) {
        console.error('댓글 조회 실패:', error);
        res.status(500).json({ success: false, error: '댓글 조회 실패' });
    }
});

// 댓글 작성
app.post('/api/comments', async (req, res) => {
    const { contentId, contentType, commentText } = req.body;
    const sessionId = req.sessionID;
    
    if (!commentText || commentText.trim().length === 0) {
        return res.status(400).json({ success: false, error: '댓글 내용을 입력해주세요.' });
    }
    
    try {
        const nickname = await getUserNickname(sessionId);
        
        db.run(`
            INSERT INTO COMMENTS (content_id, content_type, session_id, nickname, comment_text)
            VALUES (?, ?, ?, ?, ?)
        `, [contentId, contentType || 'news', sessionId, nickname, commentText.trim()], function(err) {
            if (err) {
                console.error('댓글 작성 실패:', err);
                res.status(500).json({ success: false, error: '댓글 작성 실패' });
            } else {
                res.json({ 
                    success: true, 
                    commentId: this.lastID,
                    nickname 
                });
            }
        });
    } catch (error) {
        console.error('댓글 작성 실패:', error);
        res.status(500).json({ success: false, error: '댓글 작성 실패' });
    }
});

// 댓글 삭제
app.delete('/api/comments/:commentId', (req, res) => {
    const commentId = req.params.commentId;
    const sessionId = req.sessionID;
    
    // 본인 댓글인지 확인
    db.get('SELECT session_id FROM COMMENTS WHERE id = ?', [commentId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: '서버 오류' });
        }
        
        if (!row) {
            return res.status(404).json({ success: false, error: '댓글을 찾을 수 없습니다.' });
        }
        
        if (row.session_id !== sessionId) {
            return res.status(403).json({ success: false, error: '삭제 권한이 없습니다.' });
        }
        
        // 소프트 삭제
        db.run('UPDATE COMMENTS SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [commentId], (err) => {
            if (err) {
                res.status(500).json({ success: false, error: '댓글 삭제 실패' });
            } else {
                res.json({ success: true });
            }
        });
    });
});

// 댓글 좋아요/싫어요
app.post('/api/comments/:commentId/vote', (req, res) => {
    const commentId = req.params.commentId;
    const { voteType } = req.body;
    const sessionId = req.sessionID;
    
    if (!['like', 'dislike'].includes(voteType)) {
        return res.status(400).json({ success: false, error: '잘못된 투표 타입' });
    }
    
    // 이미 투표했는지 확인
    db.get('SELECT vote_type FROM COMMENT_VOTES WHERE comment_id = ? AND session_id = ?', 
        [commentId, sessionId], (err, row) => {
        if (err) {
            return res.status(500).json({ success: false, error: '서버 오류' });
        }
        
        if (row) {
            // 이미 투표한 경우
            if (row.vote_type === voteType) {
                // 같은 투표 취소
                db.run('DELETE FROM COMMENT_VOTES WHERE comment_id = ? AND session_id = ?', 
                    [commentId, sessionId], (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: '투표 취소 실패' });
                    }
                    
                    // 카운트 감소
                    const column = voteType === 'like' ? 'likes' : 'dislikes';
                    db.run(`UPDATE COMMENTS SET ${column} = ${column} - 1 WHERE id = ?`, [commentId], (err) => {
                        if (err) {
                            return res.status(500).json({ success: false, error: '카운트 업데이트 실패' });
                        }
                        res.json({ success: true, action: 'cancelled' });
                    });
                });
            } else {
                // 다른 투표로 변경
                db.run('UPDATE COMMENT_VOTES SET vote_type = ? WHERE comment_id = ? AND session_id = ?', 
                    [voteType, commentId, sessionId], (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: '투표 변경 실패' });
                    }
                    
                    // 카운트 업데이트
                    const increaseColumn = voteType === 'like' ? 'likes' : 'dislikes';
                    const decreaseColumn = voteType === 'like' ? 'dislikes' : 'likes';
                    db.run(`UPDATE COMMENTS SET ${increaseColumn} = ${increaseColumn} + 1, ${decreaseColumn} = ${decreaseColumn} - 1 WHERE id = ?`, 
                        [commentId], (err) => {
                        if (err) {
                            return res.status(500).json({ success: false, error: '카운트 업데이트 실패' });
                        }
                        res.json({ success: true, action: 'changed' });
                    });
                });
            }
        } else {
            // 새로운 투표
            db.run('INSERT INTO COMMENT_VOTES (comment_id, session_id, vote_type) VALUES (?, ?, ?)', 
                [commentId, sessionId, voteType], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, error: '투표 실패' });
                }
                
                // 카운트 증가
                const column = voteType === 'like' ? 'likes' : 'dislikes';
                db.run(`UPDATE COMMENTS SET ${column} = ${column} + 1 WHERE id = ?`, [commentId], (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, error: '카운트 업데이트 실패' });
                    }
                    res.json({ success: true, action: 'added' });
                });
            });
        }
    });
});

// 사용자 닉네임 가져오기
app.get('/api/user/nickname', async (req, res) => {
    const sessionId = req.sessionID;
    
    try {
        const nickname = await getUserNickname(sessionId);
        res.json({ success: true, nickname });
    } catch (error) {
        console.error('닉네임 조회 실패:', error);
        res.status(500).json({ success: false, error: '닉네임 조회 실패' });
    }
});

// 관리자용 최근 댓글 목록
app.get('/admin/api/recent-comments', (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
    }
    
    db.all(`
        SELECT c.*, h.subject as content_subject
        FROM COMMENTS c
        LEFT JOIN HS_CONTENT_TB h ON c.content_id = h.id
        WHERE c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 50
    `, (err, rows) => {
        if (err) {
            console.error('최근 댓글 조회 실패:', err);
            res.status(500).json({ success: false, error: '댓글 조회 실패' });
        } else {
            res.json({ success: true, comments: rows });
        }
    });
});

// 관리자용 댓글 삭제
app.delete('/admin/api/comments/:commentId', (req, res) => {
    if (!req.session.isAdmin) {
        return res.status(403).json({ success: false, error: '권한이 없습니다.' });
    }
    
    const commentId = req.params.commentId;
    
    db.run('UPDATE COMMENTS SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [commentId], (err) => {
        if (err) {
            res.status(500).json({ success: false, error: '댓글 삭제 실패' });
        } else {
            res.json({ success: true });
        }
    });
});

// 댓글 수 가져오기 (여러 콘텐츠용)
app.post('/api/comments/counts', (req, res) => {
    const { contentIds } = req.body;
    
    if (!contentIds || !Array.isArray(contentIds)) {
        return res.status(400).json({ success: false, error: '잘못된 요청' });
    }
    
    const placeholders = contentIds.map(() => '?').join(',');
    db.all(`
        SELECT content_id, COUNT(*) as count 
        FROM COMMENTS 
        WHERE content_id IN (${placeholders}) AND deleted_at IS NULL
        GROUP BY content_id
    `, contentIds, (err, rows) => {
        if (err) {
            console.error('댓글 수 조회 실패:', err);
            res.status(500).json({ success: false, error: '댓글 수 조회 실패' });
        } else {
            const counts = {};
            rows.forEach(row => {
                counts[row.content_id] = row.count;
            });
            res.json({ success: true, counts });
        }
    });
});

app.get('/sitemap.xml', (req, res) => {
    db.all(`SELECT id, insert_time FROM HS_CONTENT_TB ORDER BY insert_time DESC`, (err, rows) => {
        if (err) {
            return res.status(500).send('서버 오류');
        }
        
        let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
        sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        sitemap += '  <url>\n';
        sitemap += `    <loc>http://${req.headers.host}/</loc>\n`;
        sitemap += '    <changefreq>daily</changefreq>\n';
        sitemap += '    <priority>1.0</priority>\n';
        sitemap += '  </url>\n';
        
        rows.forEach(row => {
            sitemap += '  <url>\n';
            sitemap += `    <loc>http://${req.headers.host}/content/${row.id}</loc>\n`;
            sitemap += `    <lastmod>${new Date(row.insert_time).toISOString()}</lastmod>\n`;
            sitemap += '    <changefreq>weekly</changefreq>\n';
            sitemap += '    <priority>0.8</priority>\n';
            sitemap += '  </url>\n';
        });
        
        sitemap += '</urlset>';
        
        res.header('Content-Type', 'application/xml');
        res.send(sitemap);
    });
});

app.get('/robots.txt', (req, res) => {
    const robots = `User-agent: *
Allow: /
Sitemap: http://${req.headers.host}/sitemap.xml`;
    
    res.header('Content-Type', 'text/plain');
    res.send(robots);
});

app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
    
    // 쿠팡 상품 수집 스케줄러 - 시스템 crontab으로 이동
    // crontab -e에서 다음 라인 추가:
    // 0 6,18 * * * cd /path/to/hissue && npm run collect:coupang >> logs/coupang.log 2>&1
    
    /* node-cron 스케줄러 비활성화 (시스템 crontab 사용)
    console.log('쿠팡 상품 수집 스케줄러 시작');
    
    // 매일 오전 6시와 오후 6시에 실행
    cron.schedule('0 6,18 * * *', async () => {
        console.log(`[${new Date().toISOString()}] 스케줄된 쿠팡 수집 작업 시작`);
        try {
            await collectCoupangProducts();
        } catch (error) {
            console.error('스케줄된 쿠팡 수집 작업 실패:', error);
        }
    });
    
    // 서버 시작 시 즉시 한 번 실행
    (async () => {
        console.log('서버 시작 시 초기 쿠팡 수집 실행');
        try {
            await collectCoupangProducts();
        } catch (error) {
            console.error('초기 쿠팡 수집 실패:', error);
        }
    })();
    
    console.log('쿠팡 스케줄러가 활성화되었습니다. 매일 오전 6시와 오후 6시에 수집이 실행됩니다.');
    */
});