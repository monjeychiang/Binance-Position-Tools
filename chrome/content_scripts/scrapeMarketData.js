// scrapeMarketData.js
function scrapeMarketData() {
    try {
        // 抓取最新價格
        const priceElement = document.querySelector('div.contractPrice div.mr-\\[4px\\]');
        if (!priceElement) {
            throw new Error('找不到最新價格元素');
        }
        const latestPriceText = priceElement.textContent.trim();
        const latestPrice = parseFloat(latestPriceText);
        if (isNaN(latestPrice)) {
            throw new Error('無法解析最新價格');
        }

        // 抓取槓桿倍數 - 嘗試多種可能的選擇器
        let leverageElement = null;
        let leverageText = '';
        
        // 嘗試第一種選擇器 - 使用完整的類名包括所有類
        leverageElement = document.querySelector('button.bn-button.bn-button__secondary.data-size-tiny.w-\\[70px\\].mr-0.draggableCancel');
        
        // 嘗試第二種選擇器 - 使用部分類名
        if (!leverageElement) {
            leverageElement = document.querySelector('button.bn-button.bn-button__secondary.data-size-tiny.w-\\[70px\\]');
        }
        
        // 嘗試第三種選擇器 - 使用包含文字內容的方式，並確保文字是數字+x格式
        if (!leverageElement) {
            const buttons = document.querySelectorAll('button.bn-button');
            for (const btn of buttons) {
                const text = btn.textContent.trim();
                // 確保文字是數字+x格式，排除「全倉」等文字
                if (text.match(/^\d+x$/i)) {
                    leverageElement = btn;
                    break;
                }
            }
        }
        
        // 如果還是找不到，嘗試查找任何包含數字+x的按鈕
        if (!leverageElement) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const text = btn.textContent.trim();
                if (text.match(/\d+x/i) && text !== '全倉') {
                    leverageElement = btn;
                    break;
                }
            }
        }
        
        // 如果還是找不到
        if (!leverageElement) {
            throw new Error('找不到槓桿倍數元素');
        }
        
        leverageText = leverageElement.textContent.trim();
        console.log('找到槓桿元素, 文字內容:', leverageText);
        
        const leverageMatch = leverageText.match(/(\d+)x/i);
        if (!leverageMatch) {
            throw new Error('無法解析槓桿倍數，文字內容: ' + leverageText);
        }
        const leverage = parseInt(leverageMatch[1], 10);

        // 將結果發送回擴充功能
        chrome.runtime.sendMessage({
            action: 'marketDataResult',
            data: {
                latestPrice,
                leverage
            }
        });

        return {
            latestPrice,
            leverage
        };
    } catch (error) {
        console.error('抓取市場數據失敗:', error);
        chrome.runtime.sendMessage({
            action: 'marketDataError',
            error: error.message
        });
        throw error;
    }
}

// 考慮頁面可能還沒完全載入，使用更長的延遲執行
setTimeout(scrapeMarketData, 2000); 