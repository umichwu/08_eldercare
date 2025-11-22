/**
 * 圖片上傳 API
 * 功能：藥物外觀拍照、心情日記配圖
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Supabase 設定
const supabaseUrl = process.env.SUPABASE_URL || 'https://rxquczgjsgkeqemhngnb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Multer 設定（記憶體儲存）
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        // 只允許圖片
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案'));
        }
    }
});

// ================================================
// 輔助函數
// ================================================

/**
 * 上傳圖片到 Supabase Storage
 */
async function uploadToStorage(buffer, path, contentType) {
    try {
        const { data, error } = await supabase.storage
            .from('eldercare-images')
            .upload(path, buffer, {
                contentType,
                upsert: false
            });

        if (error) throw error;

        // 取得公開 URL
        const { data: publicUrlData } = supabase.storage
            .from('eldercare-images')
            .getPublicUrl(path);

        return publicUrlData.publicUrl;
    } catch (error) {
        console.error('上傳到 Storage 失敗:', error);
        throw error;
    }
}

/**
 * 生成縮圖
 */
async function generateThumbnail(buffer, width = 300) {
    try {
        return await sharp(buffer)
            .resize(width, null, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toBuffer();
    } catch (error) {
        console.error('生成縮圖失敗:', error);
        return null;
    }
}

/**
 * 取得圖片元數據
 */
async function getImageMetadata(buffer) {
    try {
        const metadata = await sharp(buffer).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format
        };
    } catch (error) {
        console.error('取得圖片元數據失敗:', error);
        return null;
    }
}

// ================================================
// API 端點
// ================================================

/**
 * 上傳圖片（通用）
 * POST /api/images/upload
 */
router.post('/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '未提供圖片檔案'
            });
        }

        const {
            uploader_id,
            image_type = 'other',
            related_id = null
        } = req.body;

        if (!uploader_id) {
            return res.status(400).json({
                success: false,
                message: '缺少 uploader_id'
            });
        }

        // 取得圖片元數據
        const metadata = await getImageMetadata(req.file.buffer);

        // 生成檔案路徑
        const timestamp = Date.now();
        const fileExtension = req.file.originalname.split('.').pop();
        const fileName = `${timestamp}_${uuidv4()}.${fileExtension}`;
        const storagePath = `${image_type}/${uploader_id}/${fileName}`;

        // 上傳到 Storage
        const storageUrl = await uploadToStorage(
            req.file.buffer,
            storagePath,
            req.file.mimetype
        );

        // 生成縮圖（選用）
        let thumbnailUrl = null;
        if (metadata && metadata.width > 600) {
            const thumbnailBuffer = await generateThumbnail(req.file.buffer);
            if (thumbnailBuffer) {
                const thumbnailPath = `thumbnails/${uuidv4()}_thumb.jpg`;
                thumbnailUrl = await uploadToStorage(
                    thumbnailBuffer,
                    thumbnailPath,
                    'image/jpeg'
                );
            }
        }

        // 儲存到資料庫
        const { data: imageRecord, error: dbError } = await supabase
            .from('uploaded_images')
            .insert({
                uploader_id,
                file_name: req.file.originalname,
                storage_path: storagePath,
                storage_url: storageUrl,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                image_type,
                related_id,
                width: metadata?.width,
                height: metadata?.height,
                thumbnail_url: thumbnailUrl,
                metadata: {
                    originalName: req.file.originalname,
                    uploadedAt: new Date().toISOString()
                }
            })
            .select()
            .single();

        if (dbError) throw dbError;

        res.json({
            success: true,
            message: '圖片上傳成功',
            image: imageRecord
        });

    } catch (error) {
        console.error('上傳圖片失敗:', error);
        res.status(500).json({
            success: false,
            message: '上傳失敗：' + error.message
        });
    }
});

/**
 * 上傳藥物圖片
 * POST /api/images/medication/:medicationId
 */
router.post('/medication/:medicationId', upload.single('image'), async (req, res) => {
    try {
        const { medicationId } = req.params;
        const {
            uploader_id,
            image_type = 'appearance',
            description = '',
            is_primary = false
        } = req.body;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '未提供圖片檔案'
            });
        }

        // 1. 上傳圖片
        const metadata = await getImageMetadata(req.file.buffer);
        const timestamp = Date.now();
        const fileExtension = req.file.originalname.split('.').pop();
        const fileName = `${timestamp}_${uuidv4()}.${fileExtension}`;
        const storagePath = `medications/${uploader_id}/${medicationId}/${fileName}`;

        const storageUrl = await uploadToStorage(
            req.file.buffer,
            storagePath,
            req.file.mimetype
        );

        // 2. 儲存圖片記錄
        const { data: imageRecord, error: imageError } = await supabase
            .from('uploaded_images')
            .insert({
                uploader_id,
                file_name: req.file.originalname,
                storage_path: storagePath,
                storage_url: storageUrl,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                image_type: 'medication',
                related_id: medicationId,
                width: metadata?.width,
                height: metadata?.height
            })
            .select()
            .single();

        if (imageError) throw imageError;

        // 3. 建立藥物-圖片關聯
        const { data: linkRecord, error: linkError } = await supabase
            .from('medication_images')
            .insert({
                medication_id: medicationId,
                image_id: imageRecord.id,
                image_type,
                description,
                is_primary
            })
            .select()
            .single();

        if (linkError) throw linkError;

        res.json({
            success: true,
            message: '藥物圖片上傳成功',
            image: imageRecord,
            link: linkRecord
        });

    } catch (error) {
        console.error('上傳藥物圖片失敗:', error);
        res.status(500).json({
            success: false,
            message: '上傳失敗：' + error.message
        });
    }
});

/**
 * 取得藥物的所有圖片
 * GET /api/images/medication/:medicationId
 */
router.get('/medication/:medicationId', async (req, res) => {
    try {
        const { medicationId } = req.params;

        const { data, error } = await supabase
            .rpc('get_medication_images', { p_medication_id: medicationId });

        if (error) throw error;

        res.json({
            success: true,
            images: data || []
        });

    } catch (error) {
        console.error('取得藥物圖片失敗:', error);
        res.status(500).json({
            success: false,
            message: '取得失敗：' + error.message
        });
    }
});

/**
 * 刪除圖片（軟刪除）
 * DELETE /api/images/:imageId
 */
router.delete('/:imageId', async (req, res) => {
    try {
        const { imageId } = req.params;

        const { data, error } = await supabase
            .rpc('soft_delete_image', { p_image_id: imageId });

        if (error) throw error;

        res.json({
            success: true,
            message: '圖片已刪除'
        });

    } catch (error) {
        console.error('刪除圖片失敗:', error);
        res.status(500).json({
            success: false,
            message: '刪除失敗：' + error.message
        });
    }
});

// ================================================
// 心情日記 API
// ================================================

/**
 * 創建心情日記
 * POST /api/images/mood-diary
 */
router.post('/mood-diary', upload.array('images', 5), async (req, res) => {
    try {
        const {
            elder_id,
            title = '',
            content,
            mood_level,
            mood_emoji = '',
            tags = '[]',
            weather = '',
            location = '',
            is_private = false
        } = req.body;

        if (!elder_id || !content) {
            return res.status(400).json({
                success: false,
                message: '缺少必要欄位'
            });
        }

        // 1. 創建日記
        const { data: diary, error: diaryError } = await supabase
            .from('mood_diaries')
            .insert({
                elder_id,
                title,
                content,
                mood_level: mood_level ? parseInt(mood_level) : null,
                mood_emoji,
                tags: JSON.parse(tags),
                weather,
                location,
                is_private: is_private === 'true'
            })
            .select()
            .single();

        if (diaryError) throw diaryError;

        // 2. 上傳圖片（如果有）
        const uploadedImages = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];

                // 上傳圖片
                const metadata = await getImageMetadata(file.buffer);
                const timestamp = Date.now();
                const fileExtension = file.originalname.split('.').pop();
                const fileName = `${timestamp}_${i}.${fileExtension}`;
                const storagePath = `mood_diaries/${elder_id}/${diary.id}/${fileName}`;

                const storageUrl = await uploadToStorage(
                    file.buffer,
                    storagePath,
                    file.mimetype
                );

                // 儲存圖片記錄
                const { data: imageRecord, error: imageError } = await supabase
                    .from('uploaded_images')
                    .insert({
                        uploader_id: elder_id,
                        file_name: file.originalname,
                        storage_path: storagePath,
                        storage_url: storageUrl,
                        file_size: file.size,
                        mime_type: file.mimetype,
                        image_type: 'mood_diary',
                        related_id: diary.id,
                        width: metadata?.width,
                        height: metadata?.height
                    })
                    .select()
                    .single();

                if (imageError) throw imageError;

                // 建立日記-圖片關聯
                await supabase
                    .from('mood_diary_images')
                    .insert({
                        diary_id: diary.id,
                        image_id: imageRecord.id,
                        display_order: i
                    });

                uploadedImages.push(imageRecord);
            }
        }

        res.json({
            success: true,
            message: '心情日記建立成功',
            diary,
            images: uploadedImages
        });

    } catch (error) {
        console.error('建立心情日記失敗:', error);
        res.status(500).json({
            success: false,
            message: '建立失敗：' + error.message
        });
    }
});

/**
 * 取得長輩的心情日記列表
 * GET /api/images/mood-diary/elder/:elderId
 */
router.get('/mood-diary/elder/:elderId', async (req, res) => {
    try {
        const { elderId } = req.params;
        const { limit = 20, offset = 0, include_private = false } = req.query;

        let query = supabase
            .from('mood_diaries')
            .select('*')
            .eq('elder_id', elderId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (include_private !== 'true') {
            query = query.eq('is_private', false);
        }

        const { data: diaries, error } = await query;

        if (error) throw error;

        // 載入每個日記的圖片
        for (let diary of diaries) {
            const { data: images } = await supabase
                .rpc('get_diary_images', { p_diary_id: diary.id });
            diary.images = images || [];
        }

        res.json({
            success: true,
            diaries: diaries || [],
            total: diaries?.length || 0
        });

    } catch (error) {
        console.error('取得心情日記失敗:', error);
        res.status(500).json({
            success: false,
            message: '取得失敗：' + error.message
        });
    }
});

/**
 * 取得單一心情日記
 * GET /api/images/mood-diary/:diaryId
 */
router.get('/mood-diary/:diaryId', async (req, res) => {
    try {
        const { diaryId } = req.params;

        // 取得日記
        const { data: diary, error: diaryError } = await supabase
            .from('mood_diaries')
            .select('*')
            .eq('id', diaryId)
            .single();

        if (diaryError) throw diaryError;

        // 取得圖片
        const { data: images } = await supabase
            .rpc('get_diary_images', { p_diary_id: diaryId });

        diary.images = images || [];

        // 增加瀏覽次數
        await supabase
            .from('mood_diaries')
            .update({ view_count: diary.view_count + 1 })
            .eq('id', diaryId);

        res.json({
            success: true,
            diary
        });

    } catch (error) {
        console.error('取得心情日記失敗:', error);
        res.status(500).json({
            success: false,
            message: '取得失敗：' + error.message
        });
    }
});

/**
 * 刪除心情日記
 * DELETE /api/images/mood-diary/:diaryId
 */
router.delete('/mood-diary/:diaryId', async (req, res) => {
    try {
        const { diaryId } = req.params;

        // 軟刪除關聯的圖片
        const { data: diaryImages } = await supabase
            .from('mood_diary_images')
            .select('image_id')
            .eq('diary_id', diaryId);

        if (diaryImages && diaryImages.length > 0) {
            for (let img of diaryImages) {
                await supabase.rpc('soft_delete_image', { p_image_id: img.image_id });
            }
        }

        // 刪除日記
        const { error } = await supabase
            .from('mood_diaries')
            .delete()
            .eq('id', diaryId);

        if (error) throw error;

        res.json({
            success: true,
            message: '心情日記已刪除'
        });

    } catch (error) {
        console.error('刪除心情日記失敗:', error);
        res.status(500).json({
            success: false,
            message: '刪除失敗：' + error.message
        });
    }
});

/**
 * 取得使用者儲存空間使用量
 * GET /api/images/storage-usage/:userId
 */
router.get('/storage-usage/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .rpc('get_user_storage_usage', { p_user_id: userId });

        if (error) throw error;

        const usageBytes = data || 0;
        const usageMB = (usageBytes / (1024 * 1024)).toFixed(2);

        res.json({
            success: true,
            usage: {
                bytes: usageBytes,
                mb: parseFloat(usageMB),
                limit_mb: 100 // 預設 100MB 限制
            }
        });

    } catch (error) {
        console.error('取得儲存空間使用量失敗:', error);
        res.status(500).json({
            success: false,
            message: '取得失敗：' + error.message
        });
    }
});

module.exports = router;
