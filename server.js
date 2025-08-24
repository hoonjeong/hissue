require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cron = require('node-cron');
const collectCoupangProducts = require('./scripts/collect-coupang-products');

const app = express();
const PORT = process.env.PORT || 3000;

const dbPath = path.join(__dirname, 'hissue.db');
const db = new sqlite3.Database(dbPath);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
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
    const sort = req.query.sort === 'score' ? 'score DESC' : 'insert_time DESC';
    const search = req.query.search || '';
    
    let query = `SELECT id, keyword, subject, content, score, insert_time, news_item_picture_1 
                 FROM HS_CONTENT_TB`;
    let countQuery = `SELECT COUNT(*) as total FROM HS_CONTENT_TB`;
    let params = [];
    let countParams = [];
    
    if (search) {
        query += ` WHERE subject LIKE ? OR content LIKE ?`;
        countQuery += ` WHERE subject LIKE ? OR content LIKE ?`;
        params = [`%${search}%`, `%${search}%`];
        countParams = [`%${search}%`, `%${search}%`];
    }
    
    query += ` ORDER BY ${sort} LIMIT ? OFFSET ?`;
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
    const sort = req.query.sort || 'price_desc';
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
                query += ` ORDER BY priceGap DESC`;
                break;
            default:
                query += ` ORDER BY productPrice DESC`;
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
    
    // 쿠팡 상품 수집 스케줄러 시작
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
});