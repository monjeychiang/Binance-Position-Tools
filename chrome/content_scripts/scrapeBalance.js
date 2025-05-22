// scrapeBalance.js
function scrapeBalanceWithRetry() {
    const balanceKeywords = {
        total: ['保證金餘額', 'Margin Balance'],
        available: ['可用', 'Available', '可用餘額', 'Free Balance']
    };

    const maxRetries = 5;
    const retryInterval = 1000;

    return new Promise((resolve, reject) => {
        let attempts = 0;

        const tryScrape = () => {
            try {
                let totalBalance = 0;
                let availableBalance = 0;
                let foundTotal = false;
                let foundAvailable = false;

                const allDivs = document.querySelectorAll('div');
                for (const div of allDivs) {
                    const text = div.textContent.trim();
                    if (!text) continue;

                    // 抓取總資金
                    if (
                        div.classList.contains('flex') &&
                        div.classList.contains('justify-between') &&
                        div.classList.contains('mt-[4px]') &&
                        div.classList.contains('leading-[18px]')
                    ) {
                        const flexDivs = div.querySelectorAll('div.flex');
                        if (flexDivs.length !== 2) continue;

                        const labelDiv = flexDivs[0].querySelector('div.text-TertiaryText');
                        if (labelDiv && balanceKeywords.total.some(keyword => labelDiv.textContent.trim() === keyword)) {
                            const tooltipWrap = flexDivs[0].querySelector('div.bn-tooltips-wrap.bn-tooltips-web.max-w-full.cursor-help');
                            if (tooltipWrap) {
                                const tooltipEle = tooltipWrap.querySelector('div.bn-tooltips-ele');
                                if (tooltipEle && tooltipEle.querySelector('div.text-TertiaryText') === labelDiv) {
                                    const valueDiv = flexDivs[1];
                                    const childDivs = valueDiv.querySelectorAll('div.text-PrimaryText');
                                    if (childDivs.length === 2) {
                                        const valueText = childDivs[0].textContent.trim();
                                        const currencyText = childDivs[1].textContent.trim();
                                        if (currencyText === 'USDT') {
                                            const valueMatch = valueText.match(/([0-9,]+\.?[0-9]*)/);
                                            if (valueMatch) {
                                                const parseNumber = (str) => parseFloat(str.replace(/,/g, ''));
                                                totalBalance = parseNumber(valueMatch[1]);
                                                foundTotal = true;
                                                console.log('抓取到的總資金:', totalBalance);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // 抓取可用資金
                    if (div.classList.contains('flex') && div.classList.contains('gap-[4px]') && div.classList.contains('items-center')) {
                        const spans = div.querySelectorAll('span');
                        if (spans.length < 2) continue;

                        const hasAvailableKeyword = balanceKeywords.available.some(keyword => text.includes(keyword));
                        if (hasAvailableKeyword) {
                            const valueSpan = spans[1];
                            if (!valueSpan) continue;

                            const valueText = valueSpan.textContent.trim();
                            const valueMatch = valueText.match(/([0-9,]+\.?[0-9]*)\s*(USD|USDT)/i);
                            if (!valueMatch) continue;

                            const parseNumber = (str) => parseFloat(str.replace(/,/g, ''));
                            availableBalance = parseNumber(valueMatch[1]);
                            foundAvailable = true;
                            console.log('抓取到的可用資金:', availableBalance);
                        }
                    }

                    if (foundTotal && foundAvailable) break;
                }

                if (foundTotal && !foundAvailable) {
                    availableBalance = totalBalance;
                    foundAvailable = true;
                    console.log('未找到可用資金，假設等於總資金:', availableBalance);
                }

                if (!foundTotal) {
                    throw new Error('無法解析總資金數據，請檢查頁面語言或格式');
                }

                // 将结果发送回扩展
                chrome.runtime.sendMessage({
                    action: 'balanceResult',
                    data: {
                        totalBalance,
                        availableBalance
                    }
                });
                
                resolve({
                    totalBalance,
                    availableBalance
                });
            } catch (error) {
                attempts++;
                if (attempts >= maxRetries) {
                    console.error('抓取失敗:', error);
                    chrome.runtime.sendMessage({
                        action: 'balanceError',
                        error: error.message
                    });
                    reject(error);
                } else {
                    setTimeout(tryScrape, retryInterval);
                }
            }
        };

        tryScrape();
    });
}

// 立即执行抓取
scrapeBalanceWithRetry(); 