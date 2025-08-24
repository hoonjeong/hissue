require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const CoupangAPI = require('../utils/coupangApi');

const dbPath = path.join(__dirname, '..', 'hissue.db');
const db = new sqlite3.Database(dbPath);

async function collectProducts() {
    console.log(`[${new Date().toISOString()}] 쿠팡 베스트 상품 수집 시작`);
    
    const coupangAPI = new CoupangAPI();
    
    try {
        const response = await coupangAPI.getBestProducts('1016', 100);
        
        if (response.rCode === '0' && response.data) {
            await processProducts(response.data);
            console.log(`[${new Date().toISOString()}] 상품 수집 완료: ${response.data.length}개`);
        } else {
            console.error('API 응답 오류:', response.rMessage);
        }
    } catch (error) {
        console.error('상품 수집 실패:', error);
    }
}

async function processProducts(products) {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // 현재 최대 update_number 조회
                const maxUpdateNumber = await new Promise((resolve, reject) => {
                    db.get('SELECT MAX(update_number) as max_num FROM CP_PRODUCT_TB', (err, row) => {
                        if (err) reject(err);
                        else resolve(row?.max_num || -1);
                    });
                });
                
                const newUpdateNumber = maxUpdateNumber + 1;
                
                // 10개 이상의 update_number가 있으면 가장 오래된 것 삭제
                if (newUpdateNumber >= 10) {
                    const deleteUpdateNumber = newUpdateNumber - 10;
                    db.run('DELETE FROM CP_PRODUCT_TB WHERE update_number = ?', [deleteUpdateNumber], (err) => {
                        if (err) console.error('오래된 데이터 삭제 실패:', err);
                        else console.log(`update_number ${deleteUpdateNumber} 데이터 삭제 완료`);
                    });
                }
                
                // 각 상품 처리
                for (const product of products) {
                    await processProduct(product, newUpdateNumber);
                }
                
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function processProduct(product, updateNumber) {
    return new Promise((resolve) => {
        // 동일한 productId와 update_number로 기존 데이터 조회
        db.get(
            'SELECT productPrice FROM CP_PRODUCT_TB WHERE productId = ? AND update_number = ? ORDER BY insert_time DESC LIMIT 1',
            [product.productId, updateNumber],
            (err, existingRow) => {
                if (err) {
                    console.error('기존 상품 조회 실패:', err);
                    resolve();
                    return;
                }
                
                // 같은 update_number에 이미 있고 가격이 더 비싸면 패스
                if (existingRow && existingRow.productPrice <= product.productPrice) {
                    resolve();
                    return;
                }
                
                // 이전 가격 조회 (다른 update_number에서)
                db.get(
                    'SELECT productPrice FROM CP_PRODUCT_TB WHERE productId = ? AND update_number < ? ORDER BY update_number DESC LIMIT 1',
                    [product.productId, updateNumber],
                    (err, prevRow) => {
                        if (err) {
                            console.error('이전 가격 조회 실패:', err);
                        }
                        
                        let priceGap = 0;
                        if (prevRow && prevRow.productPrice) {
                            priceGap = ((product.productPrice - prevRow.productPrice) / prevRow.productPrice) * 100;
                        }
                        
                        if (existingRow) {
                            // 업데이트
                            db.run(
                                `UPDATE CP_PRODUCT_TB SET 
                                    categoryName = ?,
                                    isRocket = ?,
                                    isFreeShipping = ?,
                                    productImage = ?,
                                    productName = ?,
                                    productPrice = ?,
                                    productUrl = ?,
                                    priceGap = ?,
                                    insert_time = CURRENT_TIMESTAMP
                                WHERE productId = ? AND update_number = ?`,
                                [
                                    product.categoryName || '',
                                    product.isRocket ? 1 : 0,
                                    product.isFreeShipping ? 1 : 0,
                                    product.productImage || '',
                                    product.productName || '',
                                    product.productPrice || 0,
                                    product.productUrl || '',
                                    priceGap,
                                    product.productId,
                                    updateNumber
                                ],
                                (err) => {
                                    if (err) console.error('상품 업데이트 실패:', err);
                                    resolve();
                                }
                            );
                        } else {
                            // 삽입
                            db.run(
                                `INSERT INTO CP_PRODUCT_TB (
                                    categoryName, isRocket, isFreeShipping, productId,
                                    productImage, productName, productPrice, productUrl,
                                    priceGap, update_number
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [
                                    product.categoryName || '',
                                    product.isRocket ? 1 : 0,
                                    product.isFreeShipping ? 1 : 0,
                                    product.productId,
                                    product.productImage || '',
                                    product.productName || '',
                                    product.productPrice || 0,
                                    product.productUrl || '',
                                    priceGap,
                                    updateNumber
                                ],
                                (err) => {
                                    if (err) console.error('상품 삽입 실패:', err);
                                    resolve();
                                }
                            );
                        }
                    }
                );
            }
        );
    });
}

// 스크립트 직접 실행
if (require.main === module) {
    collectProducts().then(() => {
        console.log('수집 완료');
        db.close();
    }).catch((error) => {
        console.error('수집 중 오류:', error);
        db.close();
        process.exit(1);
    });
}

module.exports = collectProducts;