// 交接班数据抓取模块
const HandoverOrderFetcher = {
    /**
     * 获取拣货类型名称
     * @param {string} pickingType - 拣货类型代码
     * @returns {string} - 拣货类型名称
     */
    getPickingTypeName(pickingType) {
        switch (pickingType) {
            case '0':
                return '一票一件';
            case '1':
                return '一票一件多个';
            case '2':
                return '一票多件';
            default:
                return `未知类型[${pickingType}]`;
        }
    },

    /**
     * 处理交接班数据
     * @param {Array} data - 原始数据数组
     * @param {string} pickingType - 订单类别
     * @returns {Array} - 处理后的数据数组
     */
    processHandoverData(data, pickingType) {
        console.log('---------------------' + pickingType);
        if (pickingType === '' || pickingType == null) {
            return data.map(item => ({
                id: item.E0 || 0,
                pickingCode: item.picking_code || '',
                pickingType: item.E16 || '',
                pickingTypeName: this.getPickingTypeName(item.E16 || ''),
                orderProduct: (item.order_product || []).map(product => ({
                    orderId: product.order_id || '',
                    quantity: product.op_quantity || '',
                    productBarcode: product.product_barcode || ''
                }))
            }));
        } else {
            return data
                .filter(item => item.E16 === pickingType)
                .map(item => ({
                id: item.E0 || 0,
                pickingCode: item.picking_code || '',
                pickingType: item.E16 || '',
                pickingTypeName: this.getPickingTypeName(item.E16 || ''),
                orderProduct: (item.order_product || []).map(product => ({
                    orderId: product.order_id || '',
                    quantity: product.op_quantity || '',
                    productBarcode: product.product_barcode || ''
                }))
            }));
        }
    },

    /**
     * 获取交接班数据
     * @param {string} dateFor - 日期，格式：YYYY-MM-DD HH:mm:ss
     * @param {string} warehouseCode - 仓储编码
     * @param {string} orderType - 订单状态 空是所有；1、未打包；2、未签出
     * @param {string} pickingType - 拣货单类别：空是所有，0：一票一件；1：一票一件多个; 2：一票多件
     * @param {string} pickingCode - 拣货单编号
     * @param {string} productSku - 产品编码
     * @returns {Promise<Array>} - 处理后的交接班数据数组
     */
    async fetchHandoverData(pickingCode = '', productSku = '', warehouseCode = '1', pickingType = '1', dateFor = '', orderType = '0') {
        if (dateFor == null || dateFor === '') {
            dateFor = Utils.getCurrentDate();
        }

        console.log(`开始获取 ${dateFor} 的交接班数据...`);

        const url = 'https://yzt.wms.yunwms.com/shipment/close-report/list/page/1/pageSize/100';

        // 构建请求参数（使用 URLSearchParams，确保 urlencoded 格式）
        const params = new URLSearchParams();
        params.append('E16', orderType);  // 订单状态：空是所有；0、未打包；1、未签出
        params.append('E4', warehouseCode);   // 仓库：1是一号仓，2是二号仓
        if (pickingType !== '') {
            if (pickingType === '0')
                params.append('E016', '0')   // 拣货单类别：空是所有，0：一票一件；1：一票一件多个和一票多件
            else
                params.append('E016', '1')
        }
        params.append('pickingCodeSearchType', '1');    // 拣货单搜索方式：1、精准匹配；2、模糊匹配
        params.append('picking_code', pickingCode);
        params.append('searchDateType', 'createDate');
        params.append('dateFor', dateFor);
        params.append('sort_type', 'add_time');
        params.append('has_tracking_number', '0');
        if (productSku != null) {
            params.append('product_sku', productSku);
        }
        // 添加 Postman 中包含的所有参数（即使为空）
        params.append('searchCode', '');
        params.append('dateTo', '');
        params.append('customerCode', '');
        params.append('E5', '');
        params.append('special_platform', '');
        params.append('special_platform_number', '');

        // 打印请求参数日志
        console.log('=== 交接班数据请求参数 ===');
        console.log('请求URL:', url);
        console.log('请求方法:', 'POST');
        console.log('请求参数:', params.toString());
        console.log('========================');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                    'Origin': 'https://yzt.wms.yunwms.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    'X-Requested-With': 'XMLHttpRequest',
                    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"macOS"',
                    'Accept-Encoding': 'gzip, deflate, br, zstd',
                    // Cookie 需动态获取（见注释）
                    // 'Cookie': 'LANGUAGE=zh_CN; PHPSESSID=jveu4tt91gjnpgrb9dgke37e9b; ...'  // 动态获取
                },
                body: params.toString(),
                credentials: 'include'  // 保留 cookie 认证
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }

            let responseData;
            try {
                responseData = await response.json();
            } catch (error) {
                console.error('响应不是有效的JSON格式:', error);
                const responseText = await response.text();
                console.log('响应内容:', responseText.substring(0, 200) + '...');
                throw new Error(`服务器返回的不是JSON格式，可能是登录页面或错误页面`);
            }

            // 检查接口返回状态
            if (responseData.state !== 1) {
                console.log(`接口返回状态: ${responseData.state}, 消息: ${responseData.message || '无数据'}`);
                return [];
            }

            console.log(`成功获取 ${dateFor} 的交接班数据:`, responseData);

            // 处理数据并返回
            const processedData = this.processHandoverData(responseData.data || [], pickingType);
            console.log(`处理后的交接班数据:`, processedData);
            return processedData;
        } catch (error) {
            console.error(`获取 ${dateFor} 的交接班数据失败:`, error);
            throw error;
        }
    },

    /**
     * 获取当天的交接班数据
     * @returns {Promise<Array>} - 当天的交接班数据
     */
    async fetchTodayHandoverData() {
        const dateFor = Utils.getCurrentDate();
        return this.fetchHandoverData(dateFor);
    },

    /**
     * 根据产品条码查找一票一件多个拣货单中的订单信息（返回最新的一条）
     * @param {string} productBarcode - 产品条码
     * @param {string} warehouseCode - 仓库编码， '2'
     * @param {string} pickingType - 订单类别，取一票一件多个 '1'
     * @returns {Promise<Object|null>} - 找到的最新订单信息，如果没找到返回null
     */
    async findLatestOrderByProductBarcode(productBarcode, warehouseCode = '2', pickingType = '1') {
        if (!productBarcode) {
            throw new Error('产品条码不能为空');
        }

        console.log(`=== findLatestOrderByProductBarcode 调用参数 ===`);
        console.log(`产品条码: ${productBarcode}`);
        console.log(`仓库编码: ${warehouseCode}`);
        console.log(`拣货类型: ${pickingType}`);
        console.log(`==========================================`);
        console.log(`开始查找产品条码 ${productBarcode} 的最新订单信息`);

        try {

            // 直接调用fetchHandoverData获取所有数据
            const allHandoverData = await this.fetchHandoverData('', productBarcode, warehouseCode, pickingType);

            if (allHandoverData == null || allHandoverData.length === 0) {
                console.log(`未找到产品条码 ${productBarcode} 的订单信息`);
                return null;
            }

            // 根据id倒序排序，取最上面（最新）的一条
            allHandoverData.sort((a, b) => b.id - a.id);
            const latestOrder = allHandoverData[0];

            console.log(`找到 ${allHandoverData.length} 条匹配记录，返回最新的:`, latestOrder);
            return latestOrder;
        } catch (error) {
            console.error(`查找产品条码 ${productBarcode} 的订单信息失败:`, error);
            throw error;
        }
    }
};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandoverOrderFetcher;
} 