/**
 * 麵包屑導航模組
 * 提供自動化的階層式導航路徑顯示
 */

(function() {
    'use strict';

    // 頁面階層結構定義
    const pageHierarchy = {
        'index.html': {
            title: '主頁',
            icon: '🏠',
            parent: null
        },
        'medications.html': {
            title: '用藥管理',
            icon: '💊',
            parent: 'index.html'
        },
        'family-dashboard.html': {
            title: '家屬監控面板',
            icon: '📊',
            parent: 'medications.html'
        },
        'test-family-dashboard-filter.html': {
            title: '測試過濾功能',
            icon: '🧪',
            parent: 'family-dashboard.html'
        },
        'conversation.html': {
            title: '對話紀錄',
            icon: '💬',
            parent: 'index.html'
        },
        'geolocation.html': {
            title: '位置追蹤',
            icon: '📍',
            parent: 'index.html'
        },
        'download-app.html': {
            title: '下載 App',
            icon: '📱',
            parent: 'index.html'
        }
    };

    // 當前頁面
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 取得麵包屑路徑
    function getBreadcrumbPath() {
        const path = [];
        let page = currentPage;

        while (page) {
            const pageInfo = pageHierarchy[page];
            if (!pageInfo) break;

            path.unshift({
                page: page,
                title: pageInfo.title,
                icon: pageInfo.icon
            });

            page = pageInfo.parent;
        }

        return path;
    }

    // 初始化麵包屑導航
    function init() {
        // 如果當前頁面不在階層結構中，不顯示麵包屑
        if (!pageHierarchy[currentPage]) {
            console.log('ℹ️ 當前頁面無麵包屑導航配置');
            return;
        }

        // 創建麵包屑容器
        const breadcrumb = createBreadcrumb();

        // 插入到頁面頂部
        insertBreadcrumb(breadcrumb);

        console.log('✅ 麵包屑導航已啟用');
    }

    // 創建麵包屑元素
    function createBreadcrumb() {
        const path = getBreadcrumbPath();

        // 如果路徑只有一層（首頁），不顯示麵包屑
        if (path.length <= 1) {
            return null;
        }

        const container = document.createElement('nav');
        container.id = 'breadcrumb-navigation';
        container.style.cssText = `
            background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%);
            backdrop-filter: blur(10px);
            padding: 12px 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
            border-bottom: 1px solid rgba(102, 126, 234, 0.1);
            position: sticky;
            top: 0;
            z-index: 1000;
            font-size: 14px;
            animation: slideDown 0.3s ease;
        `;

        const breadcrumbList = document.createElement('ol');
        breadcrumbList.style.cssText = `
            display: flex;
            align-items: center;
            list-style: none;
            margin: 0;
            padding: 0;
            gap: 8px;
            flex-wrap: wrap;
        `;

        path.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
            `;

            const isLast = index === path.length - 1;

            if (isLast) {
                // 當前頁面（不可點擊）
                listItem.innerHTML = `
                    <span style="
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        color: #667eea;
                        font-weight: 600;
                        padding: 6px 12px;
                        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                        border-radius: 8px;
                    ">
                        <span style="font-size: 16px;">${item.icon}</span>
                        <span>${item.title}</span>
                    </span>
                `;
            } else {
                // 可點擊的父頁面
                const link = document.createElement('a');
                link.href = item.page;
                link.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #666;
                    text-decoration: none;
                    padding: 6px 12px;
                    border-radius: 8px;
                    transition: all 0.2s ease;
                `;
                link.innerHTML = `
                    <span style="font-size: 16px;">${item.icon}</span>
                    <span>${item.title}</span>
                `;

                link.addEventListener('mouseenter', function() {
                    this.style.background = 'rgba(102, 126, 234, 0.1)';
                    this.style.color = '#667eea';
                    this.style.transform = 'translateY(-2px)';
                });

                link.addEventListener('mouseleave', function() {
                    this.style.background = 'transparent';
                    this.style.color = '#666';
                    this.style.transform = 'translateY(0)';
                });

                listItem.appendChild(link);

                // 添加分隔符
                const separator = document.createElement('span');
                separator.style.cssText = `
                    color: #ccc;
                    font-size: 12px;
                    margin: 0 4px;
                `;
                separator.textContent = '›';
                listItem.appendChild(separator);
            }

            breadcrumbList.appendChild(listItem);
        });

        container.appendChild(breadcrumbList);
        return container;
    }

    // 插入麵包屑到頁面
    function insertBreadcrumb(breadcrumb) {
        if (!breadcrumb) return;

        // 找到適合的插入位置
        const targetSelectors = [
            'header',
            '.header',
            'nav',
            '.nav',
            'main',
            '.main',
            'body > *:first-child'
        ];

        let insertTarget = null;
        for (const selector of targetSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                insertTarget = element;
                break;
            }
        }

        if (insertTarget) {
            // 插入到目標元素之前
            insertTarget.parentNode.insertBefore(breadcrumb, insertTarget);
        } else {
            // 如果找不到合適位置，插入到 body 開頭
            document.body.insertBefore(breadcrumb, document.body.firstChild);
        }
    }

    // 添加必要的 CSS 動畫
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* 響應式設計 */
        @media (max-width: 768px) {
            #breadcrumb-navigation {
                padding: 10px 15px !important;
                font-size: 13px !important;
            }

            #breadcrumb-navigation ol {
                gap: 6px !important;
            }

            #breadcrumb-navigation a span:last-child,
            #breadcrumb-navigation > span span:last-child {
                display: none;
            }

            #breadcrumb-navigation a,
            #breadcrumb-navigation > span {
                padding: 6px !important;
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
    window.BreadcrumbNavigation = {
        getBreadcrumbPath: getBreadcrumbPath,
        pageHierarchy: pageHierarchy
    };

})();
