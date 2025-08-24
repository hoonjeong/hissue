-- CP_PRODUCT_TB 테이블 생성
CREATE TABLE IF NOT EXISTS CP_PRODUCT_TB (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoryName VARCHAR(100),
    isRocket BOOLEAN DEFAULT 0,
    isFreeShipping BOOLEAN DEFAULT 0,
    productId INTEGER NOT NULL,
    productImage VARCHAR(500),
    productName VARCHAR(500),
    productPrice INTEGER,
    productUrl VARCHAR(500),
    priceGap REAL DEFAULT 0,
    update_number INTEGER DEFAULT 0,
    insert_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_productId ON CP_PRODUCT_TB(productId);
CREATE INDEX IF NOT EXISTS idx_update_number ON CP_PRODUCT_TB(update_number);
CREATE INDEX IF NOT EXISTS idx_insert_time ON CP_PRODUCT_TB(insert_time);