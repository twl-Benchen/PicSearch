// Cloudflare Worker：代替前端呼叫 ImgBB，讓 API key 不會出現在網頁原始碼裡。
// API key 存在 Worker 的 Secret「IMGBB_API_KEY」中，不要寫在這個檔案裡。

const ALLOWED_ORIGINS = ['https://twl-benchen.github.io'];
const MAX_FILE_SIZE = 32 * 1024 * 1024; // ImgBB 單檔上限 32MB
const EXPIRATION_SECONDS = 300;         // 圖片 5 分鐘後刪除

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin'
    };

    const fail = (status, message) => new Response(
      JSON.stringify({ success: false, error: { message } }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return fail(405, '只接受 POST 請求');
    }
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return fail(403, '不允許的來源網站');
    }
    if (!env.IMGBB_API_KEY) {
      return fail(500, 'Worker 尚未設定 IMGBB_API_KEY');
    }

    let image;
    try {
      image = (await request.formData()).get('image');
    } catch (e) {
      return fail(400, '請求格式錯誤');
    }

    if (!(image instanceof File) || !image.type.startsWith('image/')) {
      return fail(400, '請上傳圖片檔案');
    }
    if (image.size > MAX_FILE_SIZE) {
      return fail(413, '圖片太大，最大只能 32MB');
    }

    const formData = new FormData();
    formData.append('image', image);

    const imgbbUrl = `https://api.imgbb.com/1/upload?expiration=${EXPIRATION_SECONDS}&key=${env.IMGBB_API_KEY}`;
    const response = await fetch(imgbbUrl, { method: 'POST', body: formData });

    // 原樣轉回 ImgBB 的 JSON，前端處理方式不變
    return new Response(await response.text(), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
