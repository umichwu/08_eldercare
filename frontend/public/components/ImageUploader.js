/**
 * 圖片上傳元件
 * 支援：拍照、選擇檔案、預覽、壓縮
 */

class ImageUploader {
    constructor(options = {}) {
        this.containerId = options.containerId || 'imageUploader';
        this.maxFiles = options.maxFiles || 5;
        this.maxSizeMB = options.maxSizeMB || 5;
        this.acceptTypes = options.acceptTypes || 'image/jpeg,image/jpg,image/png,image/webp';
        this.uploadUrl = options.uploadUrl || '/api/images/upload';
        this.onUploadSuccess = options.onUploadSuccess || (() => {});
        this.onUploadError = options.onUploadError || (() => {});

        this.selectedFiles = [];
        this.uploadedImages = [];

        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="image-uploader">
                <!-- 上傳按鈕區 -->
                <div class="upload-buttons">
                    <label class="upload-btn camera-btn">
                        📷 拍照
                        <input type="file"
                               accept="${this.acceptTypes}"
                               capture="environment"
                               multiple="${this.maxFiles > 1}"
                               id="cameraInput"
                               style="display: none;">
                    </label>

                    <label class="upload-btn gallery-btn">
                        🖼️ 選擇照片
                        <input type="file"
                               accept="${this.acceptTypes}"
                               multiple="${this.maxFiles > 1}"
                               id="galleryInput"
                               style="display: none;">
                    </label>
                </div>

                <!-- 預覽區 -->
                <div class="image-preview-container" id="imagePreviewContainer">
                    <!-- 預覽圖片會動態加入 -->
                </div>

                <!-- 上傳進度 -->
                <div class="upload-progress" id="uploadProgress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">上傳中... 0%</div>
                </div>

                <!-- 提示訊息 -->
                <div class="upload-hint">
                    💡 最多上傳 ${this.maxFiles} 張圖片，每張不超過 ${this.maxSizeMB}MB
                </div>
            </div>

            <style>
                .image-uploader {
                    padding: 20px;
                    background: #f9f9f9;
                    border-radius: 12px;
                }

                .upload-buttons {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .upload-btn {
                    flex: 1;
                    padding: 15px 20px;
                    background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.3s ease;
                }

                .upload-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3);
                }

                .camera-btn {
                    background: linear-gradient(135deg, #2196f3 0%, #42a5f5 100%);
                }

                .image-preview-container {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }

                .image-preview-item {
                    position: relative;
                    aspect-ratio: 1;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #fff;
                    border: 2px solid #e0e0e0;
                    transition: all 0.3s ease;
                }

                .image-preview-item:hover {
                    border-color: #4caf50;
                    transform: scale(1.05);
                }

                .image-preview-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .image-preview-remove {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    width: 30px;
                    height: 30px;
                    background: rgba(244, 67, 54, 0.9);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .image-preview-remove:hover {
                    background: rgba(211, 47, 47, 1);
                    transform: scale(1.1);
                }

                .image-preview-info {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 5px;
                    font-size: 12px;
                    text-align: center;
                }

                .upload-progress {
                    margin-bottom: 15px;
                }

                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background: #e0e0e0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-bottom: 10px;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #4caf50, #66bb6a);
                    width: 0%;
                    transition: width 0.3s ease;
                }

                .progress-text {
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                }

                .upload-hint {
                    text-align: center;
                    color: #999;
                    font-size: 14px;
                }

                .upload-error {
                    background: #ffebee;
                    color: #c62828;
                    padding: 10px;
                    border-radius: 8px;
                    margin-bottom: 15px;
                    text-align: center;
                }
            </style>
        `;
    }

    attachEventListeners() {
        // 拍照
        const cameraInput = document.getElementById('cameraInput');
        if (cameraInput) {
            cameraInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        // 選擇照片
        const galleryInput = document.getElementById('galleryInput');
        if (galleryInput) {
            galleryInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);

        // 檢查數量限制
        if (this.selectedFiles.length + files.length > this.maxFiles) {
            this.showError(`最多只能上傳 ${this.maxFiles} 張圖片`);
            return;
        }

        // 驗證每個檔案
        for (let file of files) {
            if (!this.validateFile(file)) {
                continue;
            }

            this.selectedFiles.push(file);
            this.showPreview(file);
        }

        // 清空 input
        event.target.value = '';
    }

    validateFile(file) {
        // 檢查檔案類型
        if (!file.type.startsWith('image/')) {
            this.showError(`${file.name} 不是圖片檔案`);
            return false;
        }

        // 檢查檔案大小
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > this.maxSizeMB) {
            this.showError(`${file.name} 超過 ${this.maxSizeMB}MB`);
            return false;
        }

        return true;
    }

    showPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const container = document.getElementById('imagePreviewContainer');
            const index = this.selectedFiles.indexOf(file);

            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.dataset.index = index;
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="${file.name}">
                <button class="image-preview-remove" onclick="imageUploader.removeFile(${index})">
                    ✕
                </button>
                <div class="image-preview-info">
                    ${(file.size / 1024).toFixed(0)} KB
                </div>
            `;

            container.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);

        // 重新渲染預覽
        const container = document.getElementById('imagePreviewContainer');
        container.innerHTML = '';
        this.selectedFiles.forEach(file => this.showPreview(file));
    }

    async uploadFiles(additionalData = {}) {
        if (this.selectedFiles.length === 0) {
            this.showError('請先選擇圖片');
            return;
        }

        const progressContainer = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        progressContainer.style.display = 'block';
        this.uploadedImages = [];

        try {
            for (let i = 0; i < this.selectedFiles.length; i++) {
                const file = this.selectedFiles[i];
                const formData = new FormData();
                formData.append('image', file);

                // 加入額外資料
                Object.keys(additionalData).forEach(key => {
                    formData.append(key, additionalData[key]);
                });

                // 上傳
                const response = await fetch(this.uploadUrl, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    this.uploadedImages.push(result.image);
                } else {
                    throw new Error(result.message);
                }

                // 更新進度
                const progress = ((i + 1) / this.selectedFiles.length) * 100;
                progressFill.style.width = `${progress}%`;
                progressText.textContent = `上傳中... ${Math.round(progress)}%`;
            }

            // 上傳完成
            progressText.textContent = '✅ 上傳完成！';
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);

            // 清空已選擇的檔案
            this.selectedFiles = [];
            document.getElementById('imagePreviewContainer').innerHTML = '';

            // 回調
            this.onUploadSuccess(this.uploadedImages);

        } catch (error) {
            console.error('上傳失敗:', error);
            this.showError('上傳失敗：' + error.message);
            this.onUploadError(error);
            progressContainer.style.display = 'none';
        }
    }

    showError(message) {
        const container = document.getElementById(this.containerId);
        const existingError = container.querySelector('.upload-error');
        if (existingError) {
            existingError.remove();
        }

        const errorDiv = document.createElement('div');
        errorDiv.className = 'upload-error';
        errorDiv.textContent = message;
        container.insertBefore(errorDiv, container.firstChild);

        setTimeout(() => errorDiv.remove(), 5000);
    }

    reset() {
        this.selectedFiles = [];
        this.uploadedImages = [];
        document.getElementById('imagePreviewContainer').innerHTML = '';
        document.getElementById('uploadProgress').style.display = 'none';
    }

    getUploadedImages() {
        return this.uploadedImages;
    }

    getSelectedFiles() {
        return this.selectedFiles;
    }
}

// 全域實例（方便使用）
let imageUploader = null;
