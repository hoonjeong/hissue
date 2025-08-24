const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 데이터베이스 연결
const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

// 도메인 설정
const DOMAIN = process.env.DOMAIN || 'https://hissue.kr';

function generateSitemap() {
    return new Promise((resolve, reject) => {
        // 모든 콘텐츠 가져오기
        const query = `
            SELECT id, insert_time, update_time 
            FROM HS_CONTENT_TB 
            ORDER BY insert_time DESC
        `;
        
        db.all(query, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            // XML 시작
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
            xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
            
            // 메인 페이지
            xml += '  <url>\n';
            xml += `    <loc>${DOMAIN}/</loc>\n`;
            xml += '    <changefreq>hourly</changefreq>\n';
            xml += '    <priority>1.0</priority>\n';
            xml += '  </url>\n';
            
            // 각 콘텐츠 페이지
            rows.forEach(row => {
                const lastmod = row.update_time || row.insert_time;
                const date = new Date(lastmod).toISOString().split('T')[0];
                
                xml += '  <url>\n';
                xml += `    <loc>${DOMAIN}/content/${row.id}</loc>\n`;
                xml += `    <lastmod>${date}</lastmod>\n`;
                xml += '    <changefreq>weekly</changefreq>\n';
                xml += '    <priority>0.8</priority>\n';
                xml += '  </url>\n';
            });
            
            // XML 종료
            xml += '</urlset>';
            
            resolve(xml);
        });
    });
}

// 동적 생성용 내보내기
module.exports = { generateSitemap };

// 직접 실행 시 파일 생성
if (require.main === module) {
    generateSitemap()
        .then(xml => {
            const outputPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
            fs.writeFileSync(outputPath, xml);
            console.log('Sitemap generated successfully:', outputPath);
            process.exit(0);
        })
        .catch(err => {
            console.error('Error generating sitemap:', err);
            process.exit(1);
        });
}