/**
 * product-fetcher.js
 * 根据 E01 查询产品信息，返回所有唯一的 productBarcode(E2)
 */

import { Logger } from './logger.js';   // 注意路径：和 api-client.js 一致，放在 common
const log = new Logger({ scope: 'product-fetcher' });

export class ProductFetcher {
    /**
     * 根据 E01 查询产品列表，返回所有唯一的 E2 (productBarcode)
     * @param {string} referenceNo - 产品关联编码（例如条码 ZP075MS05）
     * @returns {Promise<Array<string>>} - 唯一的产品编码数组
     */
    async fetchProductBarcodes(referenceNo) {
        if (!referenceNo) throw new Error('referenceNo 参数不能为空');

        const url = 'http://yzt.wms.yunwms.com/product/product/list/page/1/pageSize/20';

        // === 用 FormData 构造表单参数 ===
        const formData = new FormData();
        formData.append('skuType', '1');
        formData.append('referenceType', '1');
        formData.append('E01', referenceNo);
        formData.append('cat_lang', 'zh');
        formData.append('attr_type', '1');
        formData.append('product_style', 'weight');

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,          // 使用 FormData 作为请求体
                credentials: 'include'   // 携带 cookie
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (data.state !== 1) {
                throw new Error(`接口返回错误: ${data.message || '未知错误'}`);
            }

            console.info('-------产品查询------');
            console.info(data);

            // 提取所有 E2，并做去重
            const productBarcodes = Array.from(
                new Set(
                    (data.data || []).map(item => item.E2).filter(Boolean)
                )
            );

            log.info(
                `[ProductFetcher] 获取到 ${productBarcodes.length} 个 productBarcode`,
                productBarcodes
            );
            return productBarcodes;
        } catch (err) {
            log.error('[ProductFetcher] 请求出错', err);
            throw err;
        }
    }
}

// 挂到全局，供其它脚本访问（和 ApiClient 一样）
if (typeof window !== 'undefined') {
    window.ProductFetcher = ProductFetcher;
    window.xAI = window.xAI || {};
    window.xAI.ProductFetcher = ProductFetcher;
}

// Node 环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProductFetcher;
}