// popup.js
// 獲取 DOM 元素
const balanceElement = document.getElementById('balance');
const tradeDirectionSelect = document.getElementById('tradeDirection');
const entryPriceInput = document.getElementById('entryPrice');
const takeProfitPriceInput = document.getElementById('takeProfitPrice');
const stopLossPriceInput = document.getElementById('stopLossPrice');
const riskTypeRadios = document.getElementsByName('riskType');
const fixedRiskInput = document.getElementById('fixedRiskInput');
const percentageRiskInput = document.getElementById('percentageRiskInput');
const riskAmountInput = document.getElementById('riskAmount');
const riskPercentageInput = document.getElementById('riskPercentage');
const tradeResultElement = document.getElementById('tradeResult');

// 獲取賬戶資金
async function getAccountBalance() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                reject(new Error('無法找到活動標籤頁'));
                return;
            }

            const tabId = tabs[0].id;
            // 检查是否在幣安网站上
            if (!tabs[0].url.includes('binance.com')) {
                reject(new Error('請在幣安網站上使用此插件'));
                return;
            }

            chrome.runtime.sendMessage({ action: 'getBalance', tabId }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response && response.balance) {
                    resolve(response.balance);
                } else if (response && response.error) {
                    // 显示具体的错误信息
                    reject(new Error(response.error));
                } else {
                    reject(new Error('無法從頁面獲取資金數據'));
                }
            });
        });
    });
}

// 獲取最新價格和槓桿倍數
async function getMarketData() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                reject(new Error('無法找到活動標籤頁'));
                return;
            }

            const tabId = tabs[0].id;
            // 检查是否在幣安网站上
            if (!tabs[0].url.includes('binance.com')) {
                reject(new Error('請在幣安網站上使用此插件'));
                return;
            }
            
            chrome.runtime.sendMessage({ action: 'getMarketData', tabId }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response && response.marketData) {
                    resolve(response.marketData);
                } else if (response && response.error) {
                    // 显示具体的错误信息
                    reject(new Error(response.error));
                } else {
                    reject(new Error('無法從頁面獲取市場數據'));
                }
            });
        });
    });
}

// 計算交易參數
function calculateTradeParameters(entryPrice, takeProfitPrice, stopLossPrice, riskAmount, leverage, direction) {
    let profitDistance, lossDistance;

    if (direction === 'long') {
        profitDistance = takeProfitPrice - entryPrice;
        lossDistance = entryPrice - stopLossPrice;
    } else {
        profitDistance = entryPrice - takeProfitPrice;
        lossDistance = stopLossPrice - entryPrice;
    }

    const riskRewardRatio = profitDistance / lossDistance;
    const lossPercentage = lossDistance / entryPrice;
    const positionSize = riskAmount / (leverage * lossPercentage);
    const positionValue = positionSize * leverage;
    const actualLoss = positionValue * lossPercentage;

    return {
        riskRewardRatio,
        positionSize,
        positionValue,
        actualLoss,
        leverage
    };
}

// 更新 UI 顯示賬戶資金
async function updateBalanceUI() {
    try {
        const balance = await getAccountBalance();
        balanceElement.innerHTML = `
            <div>總資金: ${balance.totalBalance.toFixed(2)} USDT</div>
            <div>可用資金: ${balance.availableBalance.toFixed(2)} USDT</div>
        `;
        return balance.totalBalance;
    } catch (error) {
        balanceElement.textContent = '無法加載資金數據';
        document.getElementById('errorMsg').textContent = error.message || '請確保已登錄幣安並刷新頁面';
        console.error('加載資金數據出錯:', error);
        throw error;
    }
}

// 自動填充最新價格並設置止盈止損預設值
async function autoFillMarketData() {
    try {
        const marketData = await getMarketData();
        const latestPrice = marketData.latestPrice;
        entryPriceInput.value = latestPrice.toFixed(6);

        // 根據交易方向設置止盈止損預設值
        const direction = tradeDirectionSelect.value;
        if (direction === 'long') {
            // 做多：止盈價格高於入場價格，止損價格低於入場價格
            const takeProfitDefault = latestPrice * 1.05;
            const stopLossDefault = latestPrice * 0.95;
            takeProfitPriceInput.value = takeProfitDefault.toFixed(6);
            stopLossPriceInput.value = stopLossDefault.toFixed(6);
        } else {
            // 做空：止盈價格低於入場價格，止損價格高於入場價格
            const takeProfitDefault = latestPrice * 0.95;
            const stopLossDefault = latestPrice * 1.05;
            takeProfitPriceInput.value = takeProfitDefault.toFixed(6);
            stopLossPriceInput.value = stopLossDefault.toFixed(6);
        }

        // 重置用戶修改標記
        takeProfitPriceInput.dataset.userModified = '';
        stopLossPriceInput.dataset.userModified = '';

        return marketData.leverage;
    } catch (error) {
        document.getElementById('errorMsg').textContent = error.message || '無法加載市場數據';
        throw error;
    }
}

// 動態顯示止損金額輸入欄位
function toggleRiskInput() {
    const riskType = Array.from(riskTypeRadios).find(radio => radio.checked).value;
    if (riskType === 'fixed') {
        fixedRiskInput.classList.remove('hidden');
        percentageRiskInput.classList.add('hidden');
    } else {
        fixedRiskInput.classList.add('hidden');
        percentageRiskInput.classList.remove('hidden');
    }
}

// 填充倉位價值到頁面
async function fillPositionSize(positionValue) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) {
                reject(new Error('無法找到活動標籤頁'));
                return;
            }

            const tabId = tabs[0].id;
            // 检查是否在幣安网站上
            if (!tabs[0].url.includes('binance.com')) {
                reject(new Error('請在幣安網站上使用此插件'));
                return;
            }
            
            // 將倉位價值四捨五入到2位小數
            const roundedValue = Math.round(positionValue * 100) / 100;
            console.log('準備填充倉位價值到 tab:', tabId, '值:', roundedValue);
            
            // 发送消息给 background.js
            chrome.runtime.sendMessage({
                action: 'setPositionSize',
                tabId: tabId,
                value: roundedValue
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('發送消息失敗:', chrome.runtime.lastError.message);
                    reject(new Error('發送消息失敗: ' + chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    resolve();
                } else if (response && response.error) {
                    // 显示具体的错误信息
                    console.error('填充失敗:', response.error);
                    reject(new Error(response.error));
                } else {
                    reject(new Error('填充失敗，未知錯誤'));
                }
            });
        });
    });
}

// 刷新所有數據
async function refreshAllData() {
    try {
        document.getElementById('errorMsg').textContent = '';
        await updateBalanceUI();
        
        // 只更新入場價格，不更新止盈止損
        try {
            const marketData = await getMarketData();
            const latestPrice = marketData.latestPrice;
            entryPriceInput.value = latestPrice.toFixed(6);
            return marketData.leverage;
        } catch (error) {
            console.error('獲取市場數據失敗:', error);
            document.getElementById('errorMsg').textContent = error.message || '無法加載市場數據';
            throw error;
        }
    } catch (error) {
        console.error('刷新數據失敗:', error);
        const errorMsg = error.message || '發生未知錯誤';
        document.getElementById('errorMsg').textContent = '刷新失敗: ' + errorMsg;
        // 在错误情况下，显示一个更具体的UI提示
        balanceElement.innerHTML = `
            <div style="color: #FF4D4F;">無法獲取資金數據</div>
            <div style="font-size: 12px; margin-top: 5px;">原因: ${errorMsg}</div>
            <div style="font-size: 12px; margin-top: 5px;">請確保:</div>
            <ul style="font-size: 12px; margin: 5px 0; padding-left: 20px;">
                <li>您已登錄幣安網站</li>
                <li>您正在幣安合約頁面</li>
                <li>頁面已完全加載</li>
            </ul>
        `;
    }
}

// 初始化事件監聽器
function setupEventListeners() {
    riskTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleRiskInput);
    });

    // 添加用戶修改跟踪
    setupUserModificationTracking();

    document.getElementById('calculateTrade').addEventListener('click', async () => {
        const direction = tradeDirectionSelect.value;
        const entryPrice = parseFloat(entryPriceInput.value);
        const takeProfitPrice = parseFloat(takeProfitPriceInput.value);
        const stopLossPrice = parseFloat(stopLossPriceInput.value);
        const riskType = Array.from(riskTypeRadios).find(radio => radio.checked).value;

        let leverage;
        try {
            leverage = await autoFillMarketData();
            if (!leverage) {
                tradeResultElement.textContent = '無法獲取槓桿倍數，請檢查頁面';
                return;
            }
        } catch (error) {
            tradeResultElement.textContent = '無法獲取市場數據: ' + error.message;
            return;
        }

        let totalBalance;
        try {
            totalBalance = await updateBalanceUI();
        } catch (error) {
            tradeResultElement.textContent = '無法獲取資金數據: ' + error.message;
            return;
        }

        let riskAmount;
        if (riskType === 'fixed') {
            riskAmount = parseFloat(riskAmountInput.value);
        } else {
            const riskPercentage = parseFloat(riskPercentageInput.value);
            if (!riskPercentage || riskPercentage <= 0 || riskPercentage > 100) {
                tradeResultElement.textContent = '請輸入有效的總資金百分比 (0-100)';
                return;
            }
            riskAmount = (totalBalance * riskPercentage) / 100;
        }

        if (!entryPrice || entryPrice <= 0) {
            tradeResultElement.textContent = '請輸入有效的開倉價格 (> 0)';
            return;
        }
        if (!takeProfitPrice || takeProfitPrice <= 0) {
            tradeResultElement.textContent = '請輸入有效的止盈點位 (> 0)';
            return;
        }
        if (!stopLossPrice || stopLossPrice <= 0) {
            tradeResultElement.textContent = '請輸入有效的止損點位 (> 0)';
            return;
        }
        if (!riskAmount || riskAmount <= 0) {
            tradeResultElement.textContent = '請輸入有效的單筆虧損價值 (> 0)';
            return;
        }

        if (direction === 'long') {
            if (stopLossPrice >= entryPrice) {
                tradeResultElement.textContent = '止損點位必須低於開倉價格（做多）';
                return;
            }
            if (takeProfitPrice <= entryPrice) {
                tradeResultElement.textContent = '止盈點位必須高於開倉價格（做多）';
                return;
            }
        } else {
            if (stopLossPrice <= entryPrice) {
                tradeResultElement.textContent = '止損點位必須高於開倉價格（做空）';
                return;
            }
            if (takeProfitPrice >= entryPrice) {
                tradeResultElement.textContent = '止盈點位必須低於開倉價格（做空）';
                return;
            }
        }

        try {
            const { riskRewardRatio, positionSize, positionValue, actualLoss, leverage: returnedLeverage } = calculateTradeParameters(
                entryPrice,
                takeProfitPrice,
                stopLossPrice,
                riskAmount,
                leverage,
                direction
            );

            const balance = await getAccountBalance();
            if (positionSize > balance.availableBalance) {
                tradeResultElement.textContent = '可用資金不足！';
                return;
            }

            tradeResultElement.innerHTML = `
                <div>槓桿倍數: ${returnedLeverage}x</div>
                <div>盈虧比: 1:${riskRewardRatio.toFixed(2)}</div>
                <div>開倉金額: ${positionSize.toFixed(2)} USDT</div>
                <div>倉位價值: ${positionValue.toFixed(2)} USDT</div>
                <div>實際止損損失: ${actualLoss.toFixed(2)} USDT</div>
                <button id="fillPositionBtn" style="margin-top: 10px;">填入倉位價值</button>
            `;

            document.getElementById('fillPositionBtn').addEventListener('click', async () => {
                try {
                    await fillPositionSize(positionValue);
                    tradeResultElement.innerHTML += '<div style="color: #00FF00;">倉位價值已成功填入！</div>';
                } catch (error) {
                    tradeResultElement.innerHTML += '<div style="color: #FF4D4F;">填充失敗: ' + error.message + '</div>';
                }
            });

        } catch (error) {
            tradeResultElement.textContent = '計算失敗: ' + error.message;
        }
    });

    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await refreshAllData();
    });
}

// 初始化插件並設置自動刷新
async function init() {
    // 初始化時完整更新一次，包括止盈止損
    try {
        await updateBalanceUI();
        await autoFillMarketData();
        document.getElementById('errorMsg').textContent = '';
    } catch (error) {
        document.getElementById('errorMsg').textContent = '初始化失敗: ' + error.message;
    }
    
    toggleRiskInput();
    setupEventListeners();

    // 每3秒更新賬戶資金和入場價格
    setInterval(async () => {
        try {
            await updateBalanceUI();
            // 只更新入場價格，不更新止盈止損
            const marketData = await getMarketData();
            const latestPrice = marketData.latestPrice;
            entryPriceInput.value = latestPrice.toFixed(6);
        } catch (error) {
            console.error('更新資金和入場價格失敗:', error);
        }
    }, 3000);
    
    // 每60秒更新止盈止損預設值
    setInterval(async () => {
        try {
            const marketData = await getMarketData();
            const latestPrice = marketData.latestPrice;
            const direction = tradeDirectionSelect.value;
            
            // 只有當用戶未手動修改止盈止損值時才更新
            if (!takeProfitPriceInput.dataset.userModified) {
                const takeProfitDefault = direction === 'long' ? 
                    latestPrice * 1.05 : latestPrice * 0.95;
                takeProfitPriceInput.value = takeProfitDefault.toFixed(6);
            }
            
            if (!stopLossPriceInput.dataset.userModified) {
                const stopLossDefault = direction === 'long' ? 
                    latestPrice * 0.95 : latestPrice * 1.05;
                stopLossPriceInput.value = stopLossDefault.toFixed(6);
            }
        } catch (error) {
            console.error('更新止盈止損失敗:', error);
        }
    }, 60000);
}

// 添加事件監聽器以標記用戶修改
function setupUserModificationTracking() {
    takeProfitPriceInput.addEventListener('input', function() {
        this.dataset.userModified = 'true';
    });
    
    stopLossPriceInput.addEventListener('input', function() {
        this.dataset.userModified = 'true';
    });
    
    // 當交易方向改變時，重置用戶修改標記並更新止盈止損預設值
    tradeDirectionSelect.addEventListener('change', async function() {
        takeProfitPriceInput.dataset.userModified = '';
        stopLossPriceInput.dataset.userModified = '';
        
        try {
            await autoFillMarketData();
        } catch (error) {
            console.error('交易方向變更後更新止盈止損失敗:', error);
        }
    });
}

init();