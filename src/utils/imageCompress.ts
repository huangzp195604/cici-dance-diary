/**
 * 图片压缩工具
 *
 * 背景：原先用 URL.createObjectURL(file) 生成 blob URL，这类 URL 只在当前
 * 页面会话有效——刷新或换设备后图片必然失效。改为压缩后转 base64 存下来，
 * 才能真正持久化并同步到云端。
 */

const DEFAULT_MAX_EDGE = 1280;
const TARGET_BYTES = 420 * 1024; // base64 字符串目标上限，避免单行 JSONB 过大

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

/**
 * 把图片文件压缩成 base64 dataURL。
 * 逐步降低质量直到体积可接受，兼顾清晰度与存储/同步成本。
 */
export async function compressImageFile(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE
): Promise<string> {
  const original = await readAsDataURL(file);
  const img = await loadImage(original);

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;

  // 白底，避免 PNG 透明区域转 JPEG 后变黑
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.82;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length > TARGET_BYTES && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  return out;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
