// SKU详情抓取模块
const WaitingSkuFetcher = {
    /**
     * 根据拣货单号获取SKU详情
     * @param {string} pickingCode - 拣货单号
     * @returns {Promise<Array>} - SKU详情数组，包含product_barcode、reference_no、waiting_qty
     */
    async fetchSkusByPickingCode(pickingCode) {
        if (!pickingCode) {
            throw new Error('拣货单号不能为空');
        }

        console.log(`开始获取拣货单 ${pickingCode} 未打印标签的SKU详情...`);

        const url = 'http://yzt.wms.yunwms.com/shipment/orders-pack/get-waiting-sku';
        const params = new URLSearchParams();
        params.append('pickingCode', pickingCode);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                },
                body: params.toString(),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            console.log(`成功获取拣货单 ${pickingCode} 的SKU详情:`, responseData);
            
            // 检查接口返回状态
            if (responseData.state !== 1) {
                throw new Error(`接口返回错误: ${responseData.message || '未知错误'}`);
            }
            
            // 提取需要的字段：product_barcode, reference_no, waiting_qty
            const skuList = (responseData.data || []).map(item => ({
                product_barcode: item.product_barcode || '',
                reference_no: item.reference_no || '',
                waiting_qty: item.waiting_qty || '0'
            }));
            
            console.log(`拣货单 ${pickingCode} 的未打印标签SKU列表:`, skuList);
            return skuList;
        } catch (error) {
            console.error(`获取拣货单 ${pickingCode} 的SKU详情失败:`, error);
            throw error;
        }
    }
};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WaitingSkuFetcher;
} 