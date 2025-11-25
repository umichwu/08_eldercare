/**
 * 全域快捷鍵管理模組
 * 提供統一的鍵盤快捷鍵管理功能
 */

(function() {
    'use strict';

    // 快捷鍵配置
    const shortcuts = {
        'h': {
            key: 'h',
            ctrl: true,
            description: '返回主頁',
            url: 'index.html',
            icon: '🏠'
        },
        'm': {
            key: 'm',
            ctrl: true,
            description: '用藥管理',
            url: 'medications.html',
            icon: '💊'
        },
        'd': {
            key: 'd',
            ctrl: true,
            description: '監控面板',
            url: 'family-dashboard.html',
            icon: '📊'
        },
        'c': {
            key: 'c',
            ctrl: true,
            description: '對話紀錄',
            url: 'conversation.html',
            icon: '💬'
        },
        'l': {
            key: 'l',
            ctrl: true,
            description: '位置追蹤',
            url: 'geolocation.html',
            icon: '📍'
        },
        '?': {
            key: '?',
            ctrl: false,
            shift: true,
            description: '快捷鍵說明',
            action: 'showHelp',
            icon: '❓'
        }
    };

    // 當前頁面
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 快捷鍵提示狀態
    let helpVisible = false;

    // 初始化快捷鍵
    function init() {
        // 監聽鍵盤事件
        document.addEventListener('keydown', handleKeyPress);

        // 添加快捷鍵提示按鈕
        addHelpButton();

        console.log('✅ 全域快捷鍵已啟用');
        console.log('💡 按 Shift+? 查看所有快捷鍵');
    }

    // 處理按鍵事件
    function handleKeyPress(event) {
        // 如果在輸入框中，不處理快捷鍵
        const target = event.target;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        // 檢查每個快捷鍵
        for (const shortcut of Object.values(shortcuts)) {
            const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;

            if (keyMatch && ctrlMatch && shiftMatch) {
                event.preventDefault();

                if (shortcut.action === 'showHelp') {
                    toggleHelp();
                } else if (shortcut.url) {
                    // 檢查是否已在目標頁面
                    if (currentPage !== shortcut.url) {
                        console.log(`✅ 快捷鍵觸發: ${shortcut.description} (${getShortcutDisplay(shortcut)})`);
                        window.location.href = shortcut.url;
                    } else {
                        console.log(`ℹ️ 已在 ${shortcut.description} 頁面`);
                        showToast(`已在 ${shortcut.description} 頁面`, 'info');
                    }
                }
                break;
            }
        }
    }

    // 獲取快捷鍵顯示文字
    function getShortcutDisplay(shortcut) {
        let keys = [];
        if (shortcut.ctrl) keys.push('Ctrl');
        if (shortcut.shift) keys.push('Shift');
        keys.push(shortcut.key.toUpperCase());
        return keys.join('+');
    }

    // 添加快捷鍵說明按鈕
    function addHelpButton() {
        const button = document.createElement('button');
        button.id = 'keyboard-shortcuts-help-btn';
        button.innerHTML = '⌨️';
        button.title = '快捷鍵說明 (Shift+?)';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
            z-index: 9998;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.1)';
            this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
        });

        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
            this.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
        });

        button.addEventListener('click', toggleHelp);

        document.body.appendChild(button);
    }

    // 切換快捷鍵說明
    function toggleHelp() {
        if (helpVisible) {
            hideHelp();
        } else {
            showHelp();
        }
    }

    // 顯示快捷鍵說明
    function showHelp() {
        if (helpVisible) return;

        const overlay = document.createElement('div');
        overlay.id = 'keyboard-shortcuts-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.3s ease;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease;
        `;

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #667eea; display: flex; align-items: center; gap: 10px;">
                    ⌨️ 鍵盤快捷鍵
                </h2>
                <button id="close-shortcuts-help" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #999; line-height: 1;">
                    ×
                </button>
            </div>

            <p style="color: #666; margin-bottom: 25px; font-size: 14px;">
                使用快捷鍵快速導航到不同頁面，提升使用效率
            </p>

            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${Object.values(shortcuts).map(shortcut => `
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; transition: all 0.3s ease;"
                         onmouseover="this.style.background='linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; this.style.color='white';"
                         onmouseout="this.style.background='linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'; this.style.color='inherit';">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 24px;">${shortcut.icon}</div>
                            <div>
                                <div style="font-weight: 600; font-size: 15px;">${shortcut.description}</div>
                                ${shortcut.url && currentPage === shortcut.url ?
                                    '<div style="font-size: 12px; opacity: 0.7;">目前頁面</div>' :
                                    ''
                                }
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            ${getShortcutDisplay(shortcut).split('+').map(key => `
                                <kbd style="background: white; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-weight: bold; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); min-width: 35px; text-align: center;">
                                    ${key}
                                </kbd>
                            `).join('<span style="opacity: 0.5; margin: 0 2px;">+</span>')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 25px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px;">
                <div style="font-weight: 600; color: #856404; margin-bottom: 5px;">💡 提示</div>
                <div style="color: #856404; font-size: 13px;">
                    • 在輸入框中時，快捷鍵將被停用<br>
                    • Mac 使用者可以使用 Cmd 代替 Ctrl<br>
                    • 按 ESC 或點擊外部區域可關閉此視窗
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 關閉按鈕事件
        document.getElementById('close-shortcuts-help').addEventListener('click', hideHelp);

        // 點擊外部關閉
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                hideHelp();
            }
        });

        // ESC 關閉
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                hideHelp();
            }
        };
        document.addEventListener('keydown', escHandler);
        overlay.dataset.escHandler = 'attached';

        helpVisible = true;
    }

    // 隱藏快捷鍵說明
    function hideHelp() {
        const overlay = document.getElementById('keyboard-shortcuts-overlay');
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
        helpVisible = false;
    }

    // Toast 通知（如果頁面有的話使用，沒有就創建簡單版本）
    function showToast(message, type = 'info') {
        // 嘗試使用頁面現有的 toast 函數
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }

        // 簡單的 toast 實現
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // 添加必要的 CSS 動畫
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100px);
            }
        }
    `;
    document.head.appendChild(style);

    // 頁面載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露到全域（可選）
    window.KeyboardShortcuts = {
        show: showHelp,
        hide: hideHelp,
        toggle: toggleHelp
    };

})();
