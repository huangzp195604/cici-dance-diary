/**
 * 本地媒体仓库
 *
 * 背景：视频文件动辄几十 MB，既不能塞进 localStorage（5MB 配额），
 * 也不能转成 base64 塞进云端 jsonb。原先直接用 URL.createObjectURL(file)
 * 存进帖子，blob: 地址只在当前页面生命周期有效 —— 刷新页面后就是一个
 * 失效地址，表现为「上传的视频点了没反应 / 黑屏」。
 *
 * 方案：视频 Blob 存在 IndexedDB 独立库里，帖子的 mediaUrl 只保存
 * `local-media:<id>` 这样的引用字符串（可安全 JSON 化、可云同步元数据）。
 * 播放前再用 resolveMediaUrl 把引用还原成 blob: 地址。
 *
 * 局限：Blob 只在本设备。换设备后元数据会同步过去，但视频本体不在，
 * 播放界面会明确提示「视频保存在上传时那台设备」，而不是黑屏。
 */
const MEDIA_DB_NAME = 'cici_media_db';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE = 'media';

export const LOCAL_MEDIA_PREFIX = 'local-media:';

/** 已解析出的 objectURL 缓存：同一视频重复打开不重复创建，避免内存泄漏 */
const urlCache = new Map<string, string>();

export function isLocalMedia(src?: string | null): boolean {
  return !!src && src.startsWith(LOCAL_MEDIA_PREFIX);
}

export function makeLocalMediaId(): string {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('当前浏览器不支持本地媒体存储'));
      return;
    }
    const req = window.indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('本地媒体库打开失败'));
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(MEDIA_STORE, mode);
    const request = run(transaction.objectStore(MEDIA_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地媒体读写失败'));
    transaction.onerror = () => reject(transaction.error || new Error('本地媒体事务失败'));
  });
}

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  await tx('readwrite', (store) => store.put(blob, id));
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  const result = await tx<Blob | undefined>('readonly', (store) => store.get(id));
  return result ?? null;
}

export async function deleteMediaBlob(id: string): Promise<void> {
  urlCache.get(id) && URL.revokeObjectURL(urlCache.get(id)!);
  urlCache.delete(id);
  await tx('readwrite', (store) => store.delete(id));
}

/** 删除帖子时按 mediaUrl 顺手清理 Blob，避免本地媒体库无限膨胀 */
export async function deleteMediaForPost(mediaUrl?: string | null): Promise<void> {
  if (!isLocalMedia(mediaUrl)) return;
  const id = mediaUrl!.slice(LOCAL_MEDIA_PREFIX.length);
  try {
    await deleteMediaBlob(id);
  } catch {
    // 清理失败不影响帖子删除
  }
}

/**
 * 把帖子里的媒体地址还原成真正能播放/显示的 URL。
 * 返回 null 表示引用已失效（视频不在本设备），调用方应给出可见提示。
 */
export async function resolveMediaUrl(src?: string | null): Promise<string | null> {
  if (!src) return null;
  if (!isLocalMedia(src)) return src;

  const id = src.slice(LOCAL_MEDIA_PREFIX.length);
  const cached = urlCache.get(id);
  if (cached) return cached;

  try {
    const blob = await getMediaBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}
