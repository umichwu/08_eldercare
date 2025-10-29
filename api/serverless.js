/**
 * Vercel Serverless Function - Simple Health Check & Status
 *
 * 注意：這是前端專案的 API 路由，不應包含後端邏輯
 * 完整的後端 API 部署在 Render: https://eldercare-backend-8o4k.onrender.com
 */

// 簡單的處理函數，不依賴 Express 或複雜的模組
export default function handler(req, res) {
  // 設定 CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 處理 OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 根據路徑處理不同請求
  const path = req.url || '';

  // Health Check
  if (path.includes('/health') || path === '/api' || path === '/') {
    res.status(200).json({
      status: 'ok',
      message: 'Frontend API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
      note: 'This is the frontend deployment. Backend API is at: https://eldercare-backend-8o4k.onrender.com',
      backend: {
        url: 'https://eldercare-backend-8o4k.onrender.com',
        health: 'https://eldercare-backend-8o4k.onrender.com/api/health'
      },
      frontend: {
        supabase_configured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY,
        deployment: 'Vercel'
      }
    });
    return;
  }

  // 其他路徑導向後端
  res.status(200).json({
    message: 'Please use the backend API',
    backend_url: 'https://eldercare-backend-8o4k.onrender.com',
    requested_path: path,
    suggestion: `Try: https://eldercare-backend-8o4k.onrender.com${path}`
  });
}
