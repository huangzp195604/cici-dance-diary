/**
 * 运行环境探测
 *
 * 这个应用最主要的入口是抖音 → 微信 → 内置浏览器。微信 WebView（X5 / WKWebView）
 * 和 Chrome 的行为差异集中在两处：本地存储配额更紧、<video> 默认抢全屏。
 * 与其等用户反馈「视频存不上 / 一点就全屏」，不如先探测再给对应文案。
 */

export function isWeChat(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

export interface StorageEstimate {
  usage: number;
  quota: number;
  /** 已用比例 0–1；取不到配额时为 null，调用方不要据此吓用户 */
  percent: number | null;
}

/** 读取本机存储用量。浏览器不支持或不给值时静默返回 null 字段。 */
export async function estimateStorage(): Promise<StorageEstimate | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) return null;
    return { usage, quota, percent: usage / quota };
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 10) return `${Math.round(mb)} MB`;
  return `${mb.toFixed(1)} MB`;
}

/** 视频存不下 / 快存不下时给用户的一句实话（不是技术报错） */
export const STORAGE_TIGHT_TIP =
  '手机给这个网页的存储空间快满了。删掉几支旧视频，或者先把要留的视频传到相册，再回来记录。';

export const STORAGE_FULL_TIP =
  '手机没有多余空间存这支视频了。先删掉几条旧记录（视频会一起释放），或者清理一下相册再试。';

/** 微信里看视频的行为差异提示，只出现一次，避免打扰 */
export const WECHAT_VIDEO_TIP =
  '微信里播放视频会全屏、也不能边看边记。想对着分解动作练，点右上角「···」→「在浏览器打开」会顺手很多。';
