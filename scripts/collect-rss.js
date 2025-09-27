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
    const prompt = `### **[프롬프트 시작]**

**1. 역할 정의 (Role Assignment)**

당신은 구글의 **유용하고 신뢰할 수 있는 사용자 중심 콘텐츠 제작 가이드라인**을 철저히 이해하고, 최신 **E-E-A-T (경험, 전문성, 권위, 신뢰)** 품질 평가 기준에 따라 콘텐츠를 설계하는 **SEO 콘텐츠 전략가 및 전문 카피라이터**입니다.

**2. 목표 및 컨셉 (Goal & Concept)**

최종 목표는 사용자의 검색 의도를 완벽하게 만족시키고, 타겟 키워드에 대해 **검색 결과에서 상위 노출 및 높은 클릭률(CTR)**을 달성하는, **독창적이고 실질적인 인사이트**가 담긴 콘텐츠를 생성하는 것입니다.

**3. 필수 입력 정보 (Input Parameters)**

다음 정보를 바탕으로 콘텐츠를 생성하십시오:

- **메인 키워드 (K1, 구글 트렌드 추출):** \`${keyword}\`
- **보조/롱테일 키워드 (K2, K3):** \`${keyword} 이슈, ${keyword} 최신뉴스, ${keyword} 화제\` (검색 유입 및 클릭률 증대 목표)
- **타겟 독자의 검색 의도 (Intent):** \`최신 이슈에 관심있는 일반 대중, 해당 키워드에 대한 정보를 찾는 사용자\`
- **관련 뉴스 제목들:**
  - 제목 1: ${titles[0]}
  - 제목 2: ${titles[1]}
  - 제목 3: ${titles[2]}

**4. 콘텐츠 품질 및 구조화 지침 (Quality & Structure Guidelines)**

생성할 콘텐츠는 다음의 SEO 및 품질 원칙을 철저히 준수해야 합니다.

**A. E-E-A-T 및 독창성 강화:**

1. **경험 (Experience) 반영:** \`${keyword}\`에 대한 **실제 경험, 개인적인 사례, 고유한 생각 또는 직접적인 검증 과정**을 담는 섹션이나 문맥을 반드시 포함하도록 내용을 구체적으로 구성합니다. 단순히 정보를 나열하지 않고 독창적인 관점을 제시합니다.
2. **전문성 및 신뢰성 (Expertise & Trust):** 내용 전반에 걸쳐 **전문적인 분석 또는 실질적인 인사이트**를 포함하고, 정보의 신뢰도를 높이기 위해 관련 뉴스 기사 등을 3개 이상 제시합니다.

**B. SEO 기술 요소 및 UX:**

1. **가독성:** 콘텐츠는 읽기 쉽고 체계적으로 구성되어야 합니다. 긴 콘텐츠를 **단락과 섹션(H2, H3)**으로 나누고, 정보를 전달할 때 **리스트 형식**이나 **단계별 가이드**를 적극적으로 활용합니다.
2. **키워드 배치:** 메인 키워드 \`${keyword}\`와 보조 키워드들을 제목, 부제목(H2, H3), 그리고 본문 초반에 **자연스럽게** 포함하여 검색 엔진 최적화(SEO)를 수행합니다.
3. **링크 전략:** 콘텐츠의 권위를 높이기 위해 신뢰할 만한 **권위 있는 뉴스 기사**를 제안하고, 해당 링크를 삽입할 **맥락적인 위치**를 명시합니다.

**C. 시각적 요소 최적화 (이미지 포함):**

- **이미지 배치 및 Alt Text:** 구글 트렌드에서 가져온 이미지를 삽입할 **가장 효과적인 위치 3곳**을 본문 내에 표시합니다. 또한 검색 엔진이 이미지의 내용과 페이지의 맥락을 이해하도록, 해당 이미지에 대한 **상세하고 설명적인 대체 텍스트(Alt Text)**를 각각 작성합니다.

**5. 요청 출력 형식 (Desired Output Format)**

출력물은 다음의 구조를 따르며, **본문은 최소 1,500자 이상**으로 풍부하게 작성되어야 합니다.

다음 JSON 형식으로 정확히 출력해주세요:

{
  "title": "[K1을 포함하며, 명확하고 간결하며 CTR을 유도하는 제목 (최대 60자)]",
  "metaDescription": "[K1과 독자 의도를 반영하여 클릭을 유도하는 요약 설명 (최대 160자)]",
  "summary": "전체 내용 간략 소개",
  "sections": [
    {
      "subtitle": "문단 소제목1",
      "content": "문단 내용1 (E-E-A-T 요소 포함, 최소 300자 이상)"
    },
    {
      "subtitle": "문단 소제목2",
      "content": "문단 내용2 (전문적 분석 포함, 최소 300자 이상)"
    },
    {
      "subtitle": "문단 소제목3",
      "content": "문단 내용3 (실질적 인사이트 포함, 최소 300자 이상)"
    },
    {
      "subtitle": "문단 소제목4",
      "content": "문단 내용4 (신뢰도 높은 정보 포함, 최소 300자 이상)"
    },
    {
      "subtitle": "문단 소제목5",
      "content": "문단 내용5 (결론 및 전망, 최소 300자 이상)"
    }
  ],
  "imagePositions": [
    {
      "position": "첫 번째 문단 후",
      "context": "키워드 소개 후 시각적 이해를 돕기 위해",
      "altText": "${keyword} 관련 최신 이슈를 보여주는 대표 이미지"
    },
    {
      "position": "세 번째 문단 후",
      "context": "주요 내용 설명 후 구체적 사례 제시를 위해",
      "altText": "${keyword}의 핵심 포인트를 시각적으로 설명하는 이미지"
    },
    {
      "position": "마지막 문단 후",
      "context": "결론 부분에서 전체 내용을 정리하며",
      "altText": "${keyword} 이슈의 전망과 의미를 나타내는 이미지"
    }
  ],
  "externalLinks": [
    {
      "source": "주요 언론사 또는 공식 기관",
      "context": "두 번째 문단에서 팩트 검증을 위해 삽입",
      "description": "관련 뉴스 기사 또는 공식 발표 링크"
    },
    {
      "source": "전문 분석 기관 또는 전문가 의견",
      "context": "네 번째 문단에서 전문성 강화를 위해 삽입",
      "description": "전문가 분석 또는 심층 보고서 링크"
    }
  ]
}

### **중요 지침:**
- 확인된 사실만으로 구성하고 거짓정보는 절대 포함하지 마세요
- 각 문단은 최소 300자 이상으로 구성하여 총 1,500자 이상이 되도록 하세요
- 키워드를 자연스럽게 본문에 포함시키되 과도한 반복은 피하세요
- 전문지식보다는 일반 대중이 이해하기 쉬운 언어로 작성하세요
- 리스트, 볼드체 등을 활용하여 가독성을 높이세요

### **기계적 표현 금지 지침:**
- 대괄호 [...]로 둘러싸인 기계적 표현은 절대 사용하지 마세요 (예: [이미지 위치], [링크 설명], [키워드 삽입] 등)
- 모든 내용은 구체적이고 실제적인 표현으로 작성하세요
- "여기에 이미지를 삽입하세요", "링크를 추가하세요" 같은 지시문은 포함하지 마세요
- Alt text는 실제 이미지를 묘사하는 구체적인 설명으로 작성하세요
- 외부 링크는 실제 존재하는 언론사나 기관명을 명시하세요
- 모든 텍스트는 독자가 읽을 최종 콘텐츠 형태로 완성하여 작성하세요

### **[프롬프트 종료]**`;

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
                // 새로운 구조에 맞춰 검증 및 기본값 설정
                if (!parsed.metaDescription) parsed.metaDescription = parsed.summary || "최신 이슈 분석";
                if (!parsed.imagePositions) parsed.imagePositions = [];
                if (!parsed.externalLinks) parsed.externalLinks = [];

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
    const { title, summary, sections, imagePositions = [], externalLinks = [], metaDescription } = aiResponse;
    let html = `<div class="content-summary">${summary}</div>\n\n`;

    sections.forEach((section, index) => {
        html += `<h2>${section.subtitle}</h2>\n`;
        html += `<p>${section.content}</p>\n`;

        // 이미지 삽입 (AI 메타데이터는 노출하지 않고 간단하게 처리)
        if (index < 3 && pictures[index]) {
            const altText = `${title} 관련 이미지`;
            html += `<img src="${pictures[index]}" alt="${altText}" class="content-image">\n`;
            html += `<p class="image-source">이미지 출처: ${sources[index]}</p>\n`;
        }
    });

    return {
        subject: title,
        content: html,
        metaDescription: metaDescription || summary
    };
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

            if (aiResult && aiResult.json && aiResult.json.title && aiResult.json.sections && aiResult.json.sections.length > 0) {
                try {
                    const formatted = formatContent(aiResult.json, pictures, sources);

                    await saveToDatabase({
                        keyword,
                        titles,
                        pictures,
                        sources,
                        urls,
                        prompt: aiResult.prompt,
                        subject: formatted.subject,
                        content: formatted.content,
                        metaDescription: formatted.metaDescription
                    });

                    console.log(`✓ 저장 완료: ${keyword}`);
                } catch (dbError) {
                    console.error(`❌ DB 저장 실패 (${keyword}):`, dbError.message);
                    console.log(`⏭️ 다음 키워드로 이동: ${keyword}`);
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
                console.log(`❌ AI 콘텐츠 생성 실패: ${keyword} - 유효하지 않은 응답`);
                console.log(`⏭️ 다음 키워드로 이동: ${keyword}`);
            }
        } catch (error) {
            console.error(`❌ 항목 처리 실패 (${item.title ? item.title[0] : '알 수 없는 키워드'}):`, error.message);
            console.log(`⏭️ 다음 항목으로 이동`);
        }
    }

    console.log('RSS 수집 및 처리 완료');
    db.close();
}

processRSSItems().catch(console.error);