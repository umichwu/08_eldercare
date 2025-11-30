/**
 * 檔案上傳工具函數
 * 提供圖片上傳、預覽、壓縮等功能
 */

// API 基礎 URL（從 config.js 讀取）
// 注意：API_BASE_URL 已在 config.js 中定義為全域變數

// ===================================
// 圖片上傳相關函數
// ===================================

/**
 * 上傳圖片到後端
 * @param {File} file - 圖片檔案
 * @param {string} userId - 使用者 ID
 * @param {string} type - 類型 ('posts', 'chat', 'avatars')
 * @param {boolean} compress - 是否壓縮
 * @param {Function} onProgress - 進度回調函數
 * @returns {Promise<string>} 圖片 URL
 */
async function uploadImage(file, userId, type = 'posts', compress = true, onProgress = null) {
    try {
        console.log(`📤 開始上傳圖片: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        // 驗證檔案類型
        if (!file.type.startsWith('image/')) {
            throw new Error('只能上傳圖片檔案');
        }

        // 驗證檔案大小（最大 5MB）
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new Error(`圖片大小不能超過 ${maxSize / 1024 / 1024} MB`);
        }

        // 建立 FormData
        const formData = new FormData();
        formData.append('image', file);
        formData.append('userId', userId);
        formData.append('type', type);
        formData.append('compress', compress.toString());

        // 發送請求
        const xhr = new XMLHttpRequest();

        return new Promise((resolve, reject) => {
            // 監聽上傳進度
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        onProgress(percentComplete);
                    }
                });
            }

            // 監聽完成
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    console.log('✅ 圖片上傳成功:', response);
                    resolve(response.url);
                } else {
                    const error = JSON.parse(xhr.responseText);
                    console.error('❌ 圖片上傳失敗:', error);
                    reject(new Error(error.message || '上傳失敗'));
                }
            });

            // 監聽錯誤
            xhr.addEventListener('error', () => {
                console.error('❌ 網路錯誤');
                reject(new Error('網路錯誤，請檢查連線'));
            });

            // 發送請求
            xhr.open('POST', `${API_BASE_URL}/api/upload/image`);
            xhr.send(formData);
        });

    } catch (error) {
        console.error('❌ 上傳圖片時發生錯誤:', error);
        throw error;
    }
}

/**
 * 選擇圖片檔案
 * @param {Object} options - 選項
 * @param {boolean} options.multiple - 是否允許多選
 * @param {Function} options.onSelect - 選擇回調函數
 * @returns {Promise<File[]>} 選擇的檔案
 */
function selectImageFile(options = {}) {
    const { multiple = false, onSelect = null } = options;

    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = multiple;

        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);

            if (files.length === 0) {
                reject(new Error('未選擇檔案'));
                return;
            }

            console.log(`📁 已選擇 ${files.length} 個檔案`);

            if (onSelect) {
                onSelect(files);
            }

            resolve(files);
        });

        input.addEventListener('cancel', () => {
            reject(new Error('使用者取消選擇'));
        });

        input.click();
    });
}

/**
 * 預覽圖片
 * @param {File} file - 圖片檔案
 * @returns {Promise<string>} Base64 圖片 URL
 */
function previewImage(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('不是圖片檔案'));
            return;
        }

        const reader = new FileReader();

        reader.addEventListener('load', (e) => {
            resolve(e.target.result);
        });

        reader.addEventListener('error', () => {
            reject(new Error('讀取檔案失敗'));
        });

        reader.readAsDataURL(file);
    });
}

/**
 * 壓縮圖片（前端壓縮）
 * @param {File} file - 原始圖片
 * @param {Object} options - 壓縮選項
 * @returns {Promise<Blob>} 壓縮後的圖片
 */
async function compressImageClient(file, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1080,
        quality = 0.8,
    } = options;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.addEventListener('load', (e) => {
            const img = new Image();

            img.addEventListener('load', () => {
                // 計算新尺寸
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // 建立 canvas
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                // 繪製圖片
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 轉換為 Blob
                canvas.toBlob(
                    (blob) => {
                        console.log(`✅ 圖片壓縮完成: ${img.width}x${img.height} → ${width}x${height}`);
                        console.log(`   原始大小: ${(file.size / 1024).toFixed(2)} KB`);
                        console.log(`   壓縮後: ${(blob.size / 1024).toFixed(2)} KB`);
                        resolve(blob);
                    },
                    'image/jpeg',
                    quality
                );
            });

            img.addEventListener('error', () => {
                reject(new Error('無法載入圖片'));
            });

            img.src = e.target.result;
        });

        reader.addEventListener('error', () => {
            reject(new Error('讀取檔案失敗'));
        });

        reader.readAsDataURL(file);
    });
}

/**
 * 刪除已上傳的圖片
 * @param {string} url - 圖片 URL
 * @param {string} userId - 使用者 ID
 * @returns {Promise<void>}
 */
async function deleteImage(url, userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/upload/delete`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, userId }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '刪除失敗');
        }

        console.log('✅ 圖片刪除成功');
    } catch (error) {
        console.error('❌ 刪除圖片時發生錯誤:', error);
        throw error;
    }
}

// ===================================
// UI 輔助函數
// ===================================

/**
 * 建立圖片上傳 UI
 * @param {Object} options - 選項
 * @returns {HTMLElement} UI 元素
 */
function createImageUploadUI(options = {}) {
    const {
        containerId = 'imageUploadContainer',
        onUploadSuccess = null,
        onUploadError = null,
        maxFiles = 1,
    } = options;

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`❌ 找不到容器: ${containerId}`);
        return null;
    }

    // 清空容器
    container.innerHTML = '';

    // 建立 UI 結構
    const html = `
        <div class="image-upload-wrapper">
            <!-- 預覽區域 -->
            <div class="image-preview-area" style="display: none;">
                <img class="preview-image" src="" alt="預覽圖片">
                <button class="remove-preview-btn" title="移除圖片">✕</button>
            </div>

            <!-- 上傳按鈕 -->
            <button class="select-image-btn">
                📷 選擇圖片
            </button>

            <!-- 進度條 -->
            <div class="upload-progress" style="display: none;">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <span class="progress-text">0%</span>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // 綁定事件
    const selectBtn = container.querySelector('.select-image-btn');
    const previewArea = container.querySelector('.image-preview-area');
    const previewImg = container.querySelector('.preview-image');
    const removeBtn = container.querySelector('.remove-preview-btn');
    const progressDiv = container.querySelector('.upload-progress');
    const progressFill = container.querySelector('.progress-fill');
    const progressText = container.querySelector('.progress-text');

    let selectedFile = null;
    let uploadedUrl = null;

    // 選擇圖片
    selectBtn.addEventListener('click', async () => {
        try {
            const files = await selectImageFile({ multiple: false });
            selectedFile = files[0];

            // 預覽
            const previewUrl = await previewImage(selectedFile);
            previewImg.src = previewUrl;
            previewArea.style.display = 'block';
            selectBtn.style.display = 'none';

        } catch (error) {
            console.error('❌ 選擇圖片失敗:', error);
        }
    });

    // 移除預覽
    removeBtn.addEventListener('click', () => {
        selectedFile = null;
        uploadedUrl = null;
        previewImg.src = '';
        previewArea.style.display = 'none';
        selectBtn.style.display = 'block';
        progressDiv.style.display = 'none';
    });

    // 提供上傳方法
    container.uploadImage = async (userId, type = 'posts') => {
        if (!selectedFile) {
            throw new Error('請先選擇圖片');
        }

        try {
            // 顯示進度條
            progressDiv.style.display = 'block';

            // 上傳
            uploadedUrl = await uploadImage(
                selectedFile,
                userId,
                type,
                true,
                (progress) => {
                    progressFill.style.width = `${progress}%`;
                    progressText.textContent = `${Math.round(progress)}%`;
                }
            );

            console.log('✅ 上傳成功:', uploadedUrl);

            if (onUploadSuccess) {
                onUploadSuccess(uploadedUrl);
            }

            return uploadedUrl;

        } catch (error) {
            console.error('❌ 上傳失敗:', error);

            if (onUploadError) {
                onUploadError(error);
            }

            throw error;
        } finally {
            // 隱藏進度條
            setTimeout(() => {
                progressDiv.style.display = 'none';
                progressFill.style.width = '0%';
                progressText.textContent = '0%';
            }, 1000);
        }
    };

    // 提供取得上傳 URL 方法
    container.getUploadedUrl = () => uploadedUrl;

    // 提供重置方法
    container.reset = () => {
        selectedFile = null;
        uploadedUrl = null;
        previewImg.src = '';
        previewArea.style.display = 'none';
        selectBtn.style.display = 'block';
        progressDiv.style.display = 'none';
    };

    return container;
}

/**
 * 顯示圖片放大預覽
 * @param {string} imageUrl - 圖片 URL
 */
function showImageModal(imageUrl) {
    // 建立 modal
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <button class="modal-close-btn">✕</button>
            <img src="${imageUrl}" alt="圖片預覽">
        </div>
    `;

    document.body.appendChild(modal);

    // 綁定關閉事件
    const closeBtn = modal.querySelector('.modal-close-btn');
    const overlay = modal.querySelector('.modal-overlay');

    const closeModal = () => {
        modal.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // ESC 鍵關閉
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
}

// ===================================
// 表情符號選擇器
// ===================================

/**
 * 顯示表情符號選擇器
 * @param {Function} onSelect - 選擇回調函數
 */
function showEmojiPicker(onSelect) {
    const emojis = [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
        '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
        '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
        '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
        '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌',
        '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
        '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '😵', '🤯', '🤠',
        '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️',
        '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨',
        '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
        '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
        '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
        '💯', '💢', '💥', '💫', '💦', '💨', '🕊️', '🦋',
    ];

    // 建立 modal
    const modal = document.createElement('div');
    modal.className = 'emoji-picker-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="emoji-picker-content">
            <div class="emoji-picker-header">
                <h3>選擇表情符號</h3>
                <button class="modal-close-btn">✕</button>
            </div>
            <div class="emoji-grid">
                ${emojis.map(emoji => `
                    <button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 綁定事件
    const closeBtn = modal.querySelector('.modal-close-btn');
    const overlay = modal.querySelector('.modal-overlay');
    const emojiButtons = modal.querySelectorAll('.emoji-btn');

    const closeModal = () => {
        modal.remove();
    };

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    emojiButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.dataset.emoji;
            if (onSelect) {
                onSelect(emoji);
            }
            closeModal();
        });
    });
}

// 暴露全域函數
window.UploadUtils = {
    uploadImage,
    selectImageFile,
    previewImage,
    compressImageClient,
    deleteImage,
    createImageUploadUI,
    showImageModal,
    showEmojiPicker,
};
