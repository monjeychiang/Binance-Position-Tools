// setPositionSize.js
function setPositionSize(value) {
    try {
        // 获取传递的值
        const positionValue = parseFloat(value);
        if (isNaN(positionValue)) {
            throw new Error('無效的倉位價值');
        }
        
        console.log('開始尋找輸入欄位，準備填入值:', positionValue);
        
        // 使用更多选择器尝试找到输入字段
        let inputField = null;
        
        // 尝试方法1: 直接查找带有特定类的数字输入
        if (!inputField) {
            inputField = document.querySelector('.bn-textField-input[type="number"]');
            if (inputField) console.log('方法1找到輸入欄位:', inputField.id || '無ID');
        }
        
        // 尝试方法2: 查找包含unitAmount的ID
        if (!inputField) {
            const inputs = document.querySelectorAll('input[type="number"]');
            for (const input of inputs) {
                if (input.id && input.id.includes('unitAmount')) {
                    inputField = input;
                    console.log('方法2找到輸入欄位:', input.id);
                    break;
                }
            }
        }
        
        // 尝试方法3: 查找所有数字输入并检查其父元素
        if (!inputField) {
            const numberInputs = document.querySelectorAll('input[type="number"]');
            for (const input of numberInputs) {
                if (input.closest('.bn-textField')) {
                    inputField = input;
                    console.log('方法3找到輸入欄位:', input.id || '無ID');
                    break;
                }
            }
        }
        
        // 尝试方法4: 查找所有数字输入并检查其标签或占位符
        if (!inputField) {
            const numberInputs = document.querySelectorAll('input[type="number"]');
            for (const input of numberInputs) {
                const placeholder = input.getAttribute('placeholder') || '';
                const label = input.getAttribute('aria-label') || '';
                if (placeholder.includes('数量') || label.includes('数量') || 
                    placeholder.includes('amount') || label.includes('amount') ||
                    placeholder.includes('quantity') || label.includes('quantity')) {
                    inputField = input;
                    console.log('方法4找到輸入欄位:', input.id || '無ID');
                    break;
                }
            }
        }
        
        // 尝试方法5: 查找所有输入字段并检查其周围的文本
        if (!inputField) {
            const allInputs = document.querySelectorAll('input');
            for (const input of allInputs) {
                const parent = input.parentElement;
                if (parent && parent.textContent) {
                    const text = parent.textContent.toLowerCase();
                    if (text.includes('数量') || text.includes('amount') || text.includes('quantity')) {
                        inputField = input;
                        console.log('方法5找到輸入欄位:', input.id || '無ID');
                        break;
                    }
                }
            }
        }

        if (inputField) {
            console.log('找到目標輸入欄位，準備填入值:', positionValue.toFixed(6));
            
            // 保存原始值
            const originalValue = inputField.value;
            
            // 设置新值
            inputField.value = positionValue.toFixed(6);
            
            // 触发输入事件
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
            
            // 触发change事件
            inputField.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 检查值是否已更改
            setTimeout(() => {
                if (inputField.value !== positionValue.toFixed(6) && inputField.value === originalValue) {
                    console.log('值未更改，尝试其他方法');
                    
                    // 尝试使用直接操作DOM的方式
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(inputField, positionValue.toFixed(6));
                    
                    // 触发更多事件
                    const events = ['input', 'change', 'blur', 'focus'];
                    events.forEach(eventType => {
                        inputField.dispatchEvent(new Event(eventType, { bubbles: true }));
                    });
                    
                    // 发送成功消息
                    chrome.runtime.sendMessage({
                        action: 'setPositionSizeResult',
                        success: true,
                        message: '使用替代方法填充成功'
                    });
                } else {
                    // 发送成功消息
                    chrome.runtime.sendMessage({
                        action: 'setPositionSizeResult',
                        success: true
                    });
                }
            }, 100);
            
            return true;
        } else {
            console.log('未找到匹配的輸入欄位，嘗試點擊交易面板');
            
            // 尝试点击交易面板，可能会显示输入字段
            const tradePanelButtons = document.querySelectorAll('button');
            let clicked = false;
            
            for (const button of tradePanelButtons) {
                if (button.textContent && (
                    button.textContent.includes('买入') || 
                    button.textContent.includes('卖出') || 
                    button.textContent.includes('Buy') || 
                    button.textContent.includes('Sell')
                )) {
                    console.log('找到交易按钮，尝试点击:', button.textContent);
                    button.click();
                    clicked = true;
                    break;
                }
            }
            
            if (clicked) {
                // 等待面板打开后再次尝试
                setTimeout(() => {
                    setPositionSize(value);
                }, 500);
                return true;
            }
            
            // 发送失败消息
            chrome.runtime.sendMessage({
                action: 'setPositionSizeResult',
                success: false,
                error: '未找到匹配的輸入欄位'
            });
            
            return false;
        }
    } catch (error) {
        console.error('設置倉位價值失敗:', error);
        
        // 发送错误消息
        chrome.runtime.sendMessage({
            action: 'setPositionSizeResult',
            success: false,
            error: error.message
        });
        
        return false;
    }
}

// 监听来自扩展的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setPositionSize') {
        console.log('收到設置倉位價值請求:', request.value);
        setPositionSize(request.value);
        sendResponse({success: true});
    }
    return true;
});

// 通知扩展脚本已加载
chrome.runtime.sendMessage({
    action: 'contentScriptLoaded',
    script: 'setPositionSize'
});

console.log('setPositionSize.js 已加載'); 