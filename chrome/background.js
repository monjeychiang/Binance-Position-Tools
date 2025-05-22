// background.js
// 在幣安頁面點擊插件圖標時觸發
chrome.action.onClicked.addListener((tab) => {
    if (tab.url.includes('binance.com')) {
        console.log('插件圖標被點擊，等待 popup.js 發送訊息');
    }
});

// 存储回调函数的映射
const pendingCallbacks = {};

// 检查URL是否为受限制的URL（chrome:// 或 edge:// 等浏览器内部页面）
function isRestrictedUrl(url) {
    if (!url) return true;
    return url.startsWith('chrome://') || 
           url.startsWith('edge://') || 
           url.startsWith('about:') || 
           url.startsWith('chrome-extension://') ||
           url.startsWith('devtools://');
}

// 处理来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getBalance') {
        const tabId = request.tabId;
        if (!tabId) {
            sendResponse({ error: '未提供 tabId' });
            return;
        }

        // 获取当前标签页的URL
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            if (isRestrictedUrl(tab.url)) {
                sendResponse({ error: '无法在此页面上注入脚本，请打开幣安网站' });
                return;
            }

            // 存储回调函数
            pendingCallbacks[`balance_${tabId}`] = sendResponse;

            // 注入内容脚本
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content_scripts/scrapeBalance.js']
            }).catch(error => {
                console.error('注入脚本失败:', error);
                sendResponse({ error: '注入脚本失败: ' + error.message });
                delete pendingCallbacks[`balance_${tabId}`];
            });
        });

        return true; // 保持消息通道開放以進行異步響應
    }

    if (request.action === 'getMarketData') {
        const tabId = request.tabId;
        if (!tabId) {
            sendResponse({ error: '未提供 tabId' });
            return;
        }

        // 获取当前标签页的URL
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            if (isRestrictedUrl(tab.url)) {
                sendResponse({ error: '无法在此页面上注入脚本，请打开幣安网站' });
                return;
            }

            // 存储回调函数
            pendingCallbacks[`marketData_${tabId}`] = sendResponse;

            // 注入内容脚本
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content_scripts/scrapeMarketData.js']
            }).catch(error => {
                console.error('注入脚本失败:', error);
                sendResponse({ error: '注入脚本失败: ' + error.message });
                delete pendingCallbacks[`marketData_${tabId}`];
            });
        });

        return true; // 保持消息通道開放以進行異步響應
    }

    if (request.action === 'setPositionSize') {
        const tabId = request.tabId;
        const value = request.value;
        
        if (!tabId) {
            sendResponse({ error: '未提供 tabId' });
            return;
        }

        // 获取当前标签页的URL
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
                return;
            }

            if (isRestrictedUrl(tab.url)) {
                sendResponse({ error: '无法在此页面上注入脚本，请打开幣安网站' });
                return;
            }

            // 存储回调函数
            pendingCallbacks[`setPositionSize_${tabId}`] = sendResponse;

            // 首先注入内容脚本
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content_scripts/setPositionSize.js']
            }).then(() => {
                // 然后发送消息给内容脚本
                chrome.tabs.sendMessage(tabId, {
                    action: 'setPositionSize',
                    value: value
                });
            }).catch(error => {
                console.error('注入脚本失败:', error);
                sendResponse({ error: '注入脚本失败: ' + error.message });
                delete pendingCallbacks[`setPositionSize_${tabId}`];
            });
        });

        return true; // 保持消息通道開放以進行異步響應
    }

    // 处理来自内容脚本的结果
    if (request.action === 'balanceResult') {
        const tabId = sender.tab.id;
        const callback = pendingCallbacks[`balance_${tabId}`];
        
        if (callback) {
            callback({ balance: request.data });
            delete pendingCallbacks[`balance_${tabId}`];
        }
    }

    if (request.action === 'balanceError') {
        const tabId = sender.tab.id;
        const callback = pendingCallbacks[`balance_${tabId}`];
        
        if (callback) {
            callback({ error: request.error });
            delete pendingCallbacks[`balance_${tabId}`];
        }
    }

    if (request.action === 'marketDataResult') {
        const tabId = sender.tab.id;
        const callback = pendingCallbacks[`marketData_${tabId}`];
        
        if (callback) {
            callback({ marketData: request.data });
            delete pendingCallbacks[`marketData_${tabId}`];
        }
    }

    if (request.action === 'marketDataError') {
        const tabId = sender.tab.id;
        const callback = pendingCallbacks[`marketData_${tabId}`];
        
        if (callback) {
            callback({ error: request.error });
            delete pendingCallbacks[`marketData_${tabId}`];
        }
    }

    if (request.action === 'setPositionSizeResult') {
        const tabId = sender.tab.id;
        const callback = pendingCallbacks[`setPositionSize_${tabId}`];
        
        if (callback) {
            if (request.success) {
                callback({ success: true });
            } else {
                callback({ error: request.error });
            }
            delete pendingCallbacks[`setPositionSize_${tabId}`];
        }
    }

    return true;
});