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
     * @returns {Array} - 处理后的数据数组
     */
    processHandoverData(data) {
        return data.map(item => ({
            pickingCode: item.picking_code || '',
            pickingType: item.E16 || '',
            pickingTypeName: this.getPickingTypeName(item.E16 || ''),
            orderProduct: (item.order_product || []).map(product => ({
                orderId: product.order_id || '',
                quantity: product.op_quantity || '',
                skuCode: product.product_barcode || ''
            }))
        }));
    },

    /**
     * 获取交接班数据
     * @param {string} dateFor - 日期，格式：YYYY-MM-DD HH:mm:ss
     * @param {string} warehouseCode - 仓储编码
     * @param {string} orderType - 订单状态
     * @param {string} pickingType - 标签类别
     * @param {string} pickingCode - 拣货单编号
     * @returns {Promise<Array>} - 处理后的交接班数据数组
     */
    async fetchHandoverData(dateFor, warehouseCode = '1', orderType = '1',  pickingType = '1', pickingCode = '') {
        if (!dateFor) {
            throw new Error('日期参数不能为空');
        }

        console.log(`开始获取 ${dateFor} 的交接班数据...`);

        const url = 'http://yzt.wms.yunwms.com/shipment/close-report/list/page/1/pageSize/100000';
        
        // 构建请求参数
        const params = new URLSearchParams();
        params.append('E16', orderType);  //订单状态： 空是所有；1、未打包；2、未签出
        params.append('E4', warehouseCode);   //仓库：1是一号仓，2是二号仓
        params.append('E016', pickingType)   //拣货单类别：空是所有，0：一票一件；1：一票一件多个
        params.append('pickingCodeSearchType', '1');    //拣货单搜索方式： 1、精准匹配；2、模糊匹配
        params.append('picking_code', pickingCode);
        params.append('searchDateType', 'createDate');
        params.append('dateFor', dateFor);
        params.append('sort_type', 'add_time');
        params.append('has_tracking_number', '0');

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7'
                },
                body: params.toString(),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`请求失败: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            console.log(`成功获取 ${dateFor} 的交接班数据:`, responseData);
            
            // 检查接口返回状态
            if (responseData.state !== 1) {
                throw new Error(`接口返回错误: ${responseData.message || '未知错误'}`);
            }
            
            // 处理数据并返回
            const processedData = this.processHandoverData(responseData.data || []);
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
        const today = new Date();
        const dateFor = today.toISOString().slice(0, 19).replace('T', ' ');
        return this.fetchHandoverData(dateFor);
    }
};

// 如果在Node.js环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HandoverOrderFetcher;
} 