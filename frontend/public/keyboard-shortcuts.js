/**
 * 全域快捷鍵管理模組
 * 提供統一的鍵盤快捷鍵管理功能
 */

(function() {
    'use strict';

    // 預設快捷鍵配置
    const defaultShortcuts = {
        'h': {
            id: 'h',
            key: 'h',
            ctrl: true,
            description: '返回主頁',
            url: 'index.html',
            icon: '🏠'
        },
        'm': {
            id: 'm',
            key: 'm',
            ctrl: true,
            description: '用藥管理',
            url: 'medications.html',
            icon: '💊'
        },
        'd': {
            id: 'd',
            key: 'd',
            ctrl: true,
            description: '監控面板',
            url: 'family-dashboard.html',
            icon: '📊'
        },
        'c': {
            id: 'c',
            key: 'c',
            ctrl: true,
            description: '對話紀錄',
            url: 'conversation.html',
            icon: '💬'
        },
        'l': {
            id: 'l',
            key: 'l',
            ctrl: true,
            description: '位置追蹤',
            url: 'geolocation.html',
            icon: '📍'
        },
        's': {
            id: 's',
            key: 's',
            ctrl: true,
            description: '儲存當前狀態',
            action: 'save',
            icon: '💾'
        },
        'p': {
            id: 'p',
            key: 'p',
            ctrl: true,
            description: '列印當前頁面',
            action: 'print',
            icon: '🖨️'
        },
        'k': {
            id: 'k',
            key: 'k',
            ctrl: true,
            description: '搜尋功能',
            action: 'search',
            icon: '🔍'
        },
        '?': {
            id: 'help',
            key: '?',
            ctrl: false,
            shift: true,
            description: '快捷鍵說明',
            action: 'showHelp',
            icon: '❓'
        }
    };

    // 從 localStorage 載入或使用預設值
    let shortcuts = loadShortcuts();

    // 當前頁面
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 快捷鍵提示狀態
    let helpVisible = false;
    let editingShortcut = null;

    // 載入快捷鍵設定
    function loadShortcuts() {
        try {
            const saved = localStorage.getItem('keyboardShortcuts');
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('✅ 已載入自訂快捷鍵設定');
                return parsed;
            }
        } catch (e) {
            console.error('⚠️ 載入快捷鍵設定失敗:', e);
        }
        return JSON.parse(JSON.stringify(defaultShortcuts)); // Deep clone
    }

    // 儲存快捷鍵設定
    function saveShortcuts() {
        try {
            localStorage.setItem('keyboardShortcuts', JSON.stringify(shortcuts));
            console.log('✅ 快捷鍵設定已儲存');
            showToast('快捷鍵設定已儲存', 'success');
        } catch (e) {
            console.error('⚠️ 儲存快捷鍵設定失敗:', e);
            showToast('儲存失敗', 'error');
        }
    }

    // 重設為預設值
    function resetShortcuts() {
        if (confirm('確定要重設所有快捷鍵為預設值嗎？')) {
            shortcuts = JSON.parse(JSON.stringify(defaultShortcuts));
            saveShortcuts();
            hideHelp();
            setTimeout(() => showHelp(), 100);
        }
    }

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
                } else if (shortcut.action === 'save') {
                    handleSave();
                } else if (shortcut.action === 'print') {
                    handlePrint();
                } else if (shortcut.action === 'search') {
                    handleSearch();
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

    // 處理儲存動作
    function handleSave() {
        console.log('💾 儲存快捷鍵觸發');

        // 嘗試觸發頁面的儲存功能
        if (typeof window.savePage === 'function') {
            window.savePage();
        } else if (typeof window.saveData === 'function') {
            window.saveData();
        } else {
            // 預設行為：儲存當前狀態到 localStorage
            const pageState = {
                url: window.location.href,
                timestamp: new Date().toISOString(),
                scrollPosition: window.scrollY
            };
            localStorage.setItem('lastPageState', JSON.stringify(pageState));
            showToast('頁面狀態已儲存', 'success');
        }
    }

    // 處理列印動作
    function handlePrint() {
        console.log('🖨️ 列印快捷鍵觸發');
        window.print();
        showToast('開啟列印對話框', 'info');
    }

    // 處理搜尋動作
    function handleSearch() {
        console.log('🔍 搜尋快捷鍵觸發');

        // 嘗試觸發頁面的搜尋功能
        if (typeof window.openSearch === 'function') {
            window.openSearch();
        } else if (typeof window.showSearch === 'function') {
            window.showSearch();
        } else {
            // 預設行為：聚焦到搜尋輸入框
            const searchInput = document.querySelector('input[type="search"], input[name="search"], #search, .search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
                showToast('搜尋框已聚焦', 'info');
            } else {
                // 如果沒有搜尋框，顯示簡單的搜尋對話框
                showSearchDialog();
            }
        }
    }

    // 顯示搜尋對話框
    function showSearchDialog() {
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10001;
            min-width: 400px;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #667eea;">🔍 頁面搜尋</h3>
            <input type="text" id="page-search-input" placeholder="輸入搜尋關鍵字..." style="
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                box-sizing: border-box;
            ">
            <div style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.closest('div').parentElement.remove()" style="
                    padding: 10px 20px;
                    background: #e0e0e0;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">取消</button>
                <button onclick="
                    const query = document.getElementById('page-search-input').value;
                    if (query) {
                        window.find(query);
                        this.closest('div').parentElement.remove();
                    }
                " style="
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">搜尋</button>
            </div>
        `;

        document.body.appendChild(dialog);
        document.getElementById('page-search-input').focus();

        // ESC 關閉
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Enter 搜尋
        document.getElementById('page-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value;
                if (query) {
                    window.find(query);
                    dialog.remove();
                }
            }
        });
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

            <p style="color: #666; margin-bottom: 15px; font-size: 14px;">
                使用快捷鍵快速導航到不同頁面，提升使用效率。點擊快捷鍵可以自訂按鍵組合。
            </p>

            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="reset-shortcuts-btn" style="
                    padding: 8px 16px;
                    background: #ff6b6b;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#ff5252'" onmouseout="this.style.background='#ff6b6b'">
                    🔄 重設預設值
                </button>
                <button id="export-shortcuts-btn" style="
                    padding: 8px 16px;
                    background: #4ecdc4;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='#45b7b0'" onmouseout="this.style.background='#4ecdc4'">
                    📤 匯出設定
                </button>
            </div>

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
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <div style="display: flex; gap: 5px;" onclick="window.KeyboardShortcuts.editShortcut('${shortcut.id}')" style="cursor: pointer;" title="點擊編輯快捷鍵">
                                ${getShortcutDisplay(shortcut).split('+').map(key => `
                                    <kbd style="background: white; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-weight: bold; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); min-width: 35px; text-align: center; cursor: pointer;">
                                        ${key}
                                    </kbd>
                                `).join('<span style="opacity: 0.5; margin: 0 2px;">+</span>')}
                            </div>
                            <button onclick="window.KeyboardShortcuts.editShortcut('${shortcut.id}')" style="
                                background: rgba(255,255,255,0.3);
                                border: none;
                                padding: 6px 10px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 12px;
                                transition: all 0.2s ease;
                            " onmouseover="this.style.background='rgba(255,255,255,0.5)'" onmouseout="this.style.background='rgba(255,255,255,0.3)'">
                                ✏️ 編輯
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 25px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px;">
                <div style="font-weight: 600; color: #856404; margin-bottom: 5px;">💡 提示</div>
                <div style="color: #856404; font-size: 13px;">
                    • 在輸入框中時，快捷鍵將被停用<br>
                    • Mac 使用者可以使用 Cmd 代替 Ctrl<br>
                    • 點擊快捷鍵或編輯按鈕可自訂按鍵<br>
                    • 按 ESC 或點擊外部區域可關閉此視窗
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 關閉按鈕事件
        document.getElementById('close-shortcuts-help').addEventListener('click', hideHelp);

        // 重設按鈕事件
        document.getElementById('reset-shortcuts-btn').addEventListener('click', resetShortcuts);

        // 匯出按鈕事件
        document.getElementById('export-shortcuts-btn').addEventListener('click', exportShortcuts);

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

    // 編輯快捷鍵
    function editShortcut(shortcutId) {
        const shortcut = shortcuts[shortcutId];
        if (!shortcut) return;

        // 創建編輯對話框
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10002;
            min-width: 400px;
        `;

        dialog.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #667eea; display: flex; align-items: center; gap: 10px;">
                ${shortcut.icon} 編輯快捷鍵: ${shortcut.description}
            </h3>
            <p style="color: #666; margin-bottom: 20px; font-size: 14px;">
                請按下您想要設定的快捷鍵組合
            </p>
            <div id="key-capture" style="
                padding: 20px;
                border: 3px dashed #667eea;
                border-radius: 10px;
                text-align: center;
                background: #f8f9ff;
                font-size: 18px;
                font-weight: 600;
                color: #667eea;
                min-height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                等待按鍵...
            </div>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-edit" style="
                    padding: 10px 20px;
                    background: #e0e0e0;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                ">取消</button>
            </div>
        `;

        document.body.appendChild(dialog);

        // 捕捉按鍵
        let capturedKey = null;
        let capturedCtrl = false;
        let capturedShift = false;

        const keyHandler = (e) => {
            e.preventDefault();

            // 忽略單獨的修飾鍵
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                return;
            }

            capturedKey = e.key;
            capturedCtrl = e.ctrlKey || e.metaKey;
            capturedShift = e.shiftKey;

            // 顯示捕捉到的按鍵
            const display = [];
            if (capturedCtrl) display.push('Ctrl');
            if (capturedShift) display.push('Shift');
            display.push(capturedKey.toUpperCase());

            document.getElementById('key-capture').innerHTML = `
                <div style="display: flex; gap: 5px;">
                    ${display.map(key => `
                        <kbd style="background: white; padding: 10px 15px; border-radius: 8px; font-family: monospace; font-weight: bold; font-size: 16px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                            ${key}
                        </kbd>
                    `).join('<span style="opacity: 0.5; margin: 0 5px; font-size: 20px;">+</span>')}
                </div>
            `;

            // 驗證是否與其他快捷鍵衝突
            const conflict = Object.values(shortcuts).find(s =>
                s.id !== shortcutId &&
                s.key.toLowerCase() === capturedKey.toLowerCase() &&
                !!s.ctrl === capturedCtrl &&
                !!s.shift === capturedShift
            );

            if (conflict) {
                showToast(`此快捷鍵已被「${conflict.description}」使用`, 'error');
                return;
            }

            // 更新快捷鍵
            setTimeout(() => {
                shortcuts[shortcutId].key = capturedKey;
                shortcuts[shortcutId].ctrl = capturedCtrl;
                shortcuts[shortcutId].shift = capturedShift;
                saveShortcuts();
                dialog.remove();
                document.removeEventListener('keydown', keyHandler);

                // 重新載入說明視窗
                hideHelp();
                setTimeout(() => showHelp(), 100);
            }, 500);
        };

        document.addEventListener('keydown', keyHandler);

        // 取消按鈕
        document.getElementById('cancel-edit').addEventListener('click', () => {
            dialog.remove();
            document.removeEventListener('keydown', keyHandler);
        });
    }

    // 匯出快捷鍵設定
    function exportShortcuts() {
        const data = JSON.stringify(shortcuts, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'keyboard-shortcuts-config.json';
        a.click();
        URL.revokeObjectURL(url);
        showToast('快捷鍵設定已匯出', 'success');
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
        toggle: toggleHelp,
        editShortcut: editShortcut,
        resetShortcuts: resetShortcuts,
        exportShortcuts: exportShortcuts,
        getShortcuts: () => shortcuts
    };

})();
