const crypto = require('crypto');
const axios = require('axios');
const moment = require('moment');

class CoupangAPI {
    constructor() {
        this.domain = 'https://api-gateway.coupang.com';
        this.accessKey = process.env.COUPANG_ACCESS_KEY;
        this.secretKey = process.env.COUPANG_SECRET_KEY;
    }

    generateHmac(method, url) {
        const parts = url.split(/\?/);
        const [path, query = ''] = parts;

        const datetime = moment.utc().format('YYMMDD[T]HHmmss[Z]');
        const message = datetime + method + path + query;

        const signature = crypto.createHmac('sha256', this.secretKey)
            .update(message)
            .digest('hex');

        return `CEA algorithm=HmacSHA256, access-key=${this.accessKey}, signed-date=${datetime}, signature=${signature}`;
    }

    async getBestProducts(categoryId = '1016', limit = 100) {
        const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/bestcategories/' + categoryId;
        const queryParams = new URLSearchParams({
            limit: limit,
            subId: 'digitalbest',
            imageSize: '512x512'
        });
        
        const url = path + '?' + queryParams.toString();
        const method = 'GET';

        try {
            const authorization = this.generateHmac(method, url);
            
            const response = await axios.request({
                method: method,
                url: this.domain + url,
                headers: { 
                    Authorization: authorization,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('Coupang API Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = CoupangAPI;