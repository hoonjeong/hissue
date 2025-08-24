require('dotenv').config();
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const cookieParser = require('cookie-parser');

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
            
            const totalPages = Math.ceil(countRow.total / limit);
            res.render('index', { 
                contents: rows, 
                currentPage: page, 
                totalPages: totalPages,
                search: search,
                sort: req.query.sort || 'recent'
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
});