require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RSS_URL = 'https://trends.google.co.kr/trending/rss?geo=KR';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

async function fetchRSSFeed() {
    try {
        const response = await axios.get(RSS_URL);
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        return result.rss.channel[0].item || [];
    } catch (error) {
        console.error('RSS 피드 가져오기 실패:', error);
        return [];
    }
}

async function generateContent(keyword, titles) {
    const prompt = `다음은 최근 구글 트렌드에서 화제가 된 키워드와 관련 뉴스 제목들입니다.

키워드: ${keyword}
관련 뉴스 제목 1: ${titles[0]}
관련 뉴스 제목 2: ${titles[1]}
관련 뉴스 제목 3: ${titles[2]}

위 정보를 바탕으로 해당 키워드가 최근 하루동안 이슈가 된 이유에 대해 자세하게 설명하는 글을 작성해주세요.

작성 지침:
1. 구글 검색엔진최적화(SEO)에 맞게 내용을 구성
2. 확인된 사실만으로 구성하고 거짓정보는 배제
3. 의견이나 견해보다는 팩트와 설명 위주로 구성
4. 최소 3문단 이상으로 구성하며, 내용은 많을수록 좋음
5. 각 문단 앞에는 소제목을 붙이고 그 다음에 문단 내용을 작성
6. 전문지식보다는 읽기 쉬운 재미있는 글로 작성
7. 다음 JSON 형식으로 출력:

{
  "title": "제목",
  "summary": "전체 내용 간략 소개",
  "sections": [
    {
      "subtitle": "문단 소제목1",
      "content": "문단 내용1"
    },
    {
      "subtitle": "문단 소제목2",
      "content": "문단 내용2"
    },
    {
      "subtitle": "문단 소제목3",
      "content": "문단 내용3"
    }
  ]
}

문단은 3개 이상이며 최대 개수 제한은 없습니다.`;

    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const generatedText = response.data.candidates[0].content.parts[0].text;
        
        // JSON 추출 (더 안전한 방법)
        const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                // 문제가 되는 문자 정리
                let cleanedJson = jsonMatch[0]
                    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 제어 문자 제거
                    .replace(/\r\n/g, '\\n') // 줄바꿈 처리
                    .replace(/\n/g, '\\n')
                    .replace(/\t/g, '\\t');
                
                const parsed = JSON.parse(cleanedJson);
                return { 
                    json: parsed, 
                    prompt: prompt 
                };
            } catch (parseError) {
                console.error('JSON 파싱 오류:', parseError);
                console.error('원본 텍스트:', generatedText);
                // 기본 구조 반환
                return {
                    json: {
                        title: titles[0] || "제목",
                        summary: "AI 요약 생성 실패",
                        sections: [
                            { subtitle: "내용", content: "콘텐츠 생성 중 오류가 발생했습니다." }
                        ]
                    },
                    prompt: prompt
                };
            }
        }
        throw new Error('JSON 형식을 찾을 수 없음');
    } catch (error) {
        console.error('AI 콘텐츠 생성 실패:', error);
        return null;
    }
}

function formatContent(aiResponse, pictures, sources) {
    const { title, summary, sections } = aiResponse;
    let html = `<div class="content-summary">${summary}</div>\n\n`;
    
    sections.forEach((section, index) => {
        html += `<h2>${section.subtitle}</h2>\n`;
        html += `<p>${section.content}</p>\n`;
        
        if (index < 3 && pictures[index]) {
            html += `<img src="${pictures[index]}" alt="${title}" class="content-image">\n`;
            html += `<p class="image-source">이미지 출처: ${sources[index]}</p>\n`;
        }
    });
    
    return { subject: title, content: html };
}

async function saveToDatabase(data) {
    return new Promise((resolve, reject) => {
        const query = `
            INSERT INTO HS_CONTENT_TB (
                keyword, 
                news_item_title_1, news_item_title_2, news_item_title_3,
                news_item_picture_1, news_item_picture_2, news_item_picture_3,
                news_item_source_1, news_item_source_2, news_item_source_3,
                prompt, subject, content
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(query, [
            data.keyword,
            data.titles[0], data.titles[1], data.titles[2],
            data.pictures[0], data.pictures[1], data.pictures[2],
            data.sources[0], data.sources[1], data.sources[2],
            data.prompt, data.subject, data.content
        ], function(err) {
            if (err) {
                console.error('데이터베이스 저장 실패:', err);
                reject(err);
            } else {
                console.log(`저장 완료: ${data.keyword} (ID: ${this.lastID})`);
                resolve(this.lastID);
            }
        });
    });
}

async function checkDuplicate(keyword) {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];
        const query = `
            SELECT COUNT(*) as count 
            FROM HS_CONTENT_TB 
            WHERE keyword = ? AND DATE(insert_time) = ?
        `;
        
        db.get(query, [keyword, today], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count > 0);
            }
        });
    });
}

async function processRSSItems() {
    const items = await fetchRSSFeed();
    console.log(`총 ${items.length}개의 RSS 항목을 가져왔습니다.`);
    
    for (const item of items) {
        try {
            const keyword = item.title[0];
            
            const isDuplicate = await checkDuplicate(keyword);
            if (isDuplicate) {
                console.log(`이미 처리된 키워드: ${keyword}`);
                continue;
            }
            
            const newsItems = item['ht:news_item'] || [];
            if (newsItems.length < 3) {
                console.log(`뉴스 항목 부족: ${keyword}`);
                continue;
            }
            
            const titles = [];
            const pictures = [];
            const sources = [];
            
            for (let i = 0; i < 3; i++) {
                titles.push(newsItems[i]['ht:news_item_title'][0]);
                pictures.push(newsItems[i]['ht:news_item_picture'] ? newsItems[i]['ht:news_item_picture'][0] : '');
                sources.push(newsItems[i]['ht:news_item_source'] ? newsItems[i]['ht:news_item_source'][0] : '');
            }
            
            console.log(`처리 중: ${keyword}`);
            const aiResult = await generateContent(keyword, titles);
            
            if (aiResult) {
                const formatted = formatContent(aiResult.json, pictures, sources);
                
                await saveToDatabase({
                    keyword,
                    titles,
                    pictures,
                    sources,
                    prompt: aiResult.prompt,
                    subject: formatted.subject,
                    content: formatted.content
                });
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`항목 처리 실패:`, error);
        }
    }
    
    console.log('RSS 수집 및 처리 완료');
    db.close();
}

processRSSItems().catch(console.error);