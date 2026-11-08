/**
 * authSession —— 登录态持久化辅助（只读观察 + UI 标记）
 *
 * 云 SDK 把会话持久化在 localStorage，key 为
 * `workbuddy-cloud.session.<publishableKey>`，并明确区分：
 *  - 续期遇到网络 / 5xx 失败 → 保留本地会话，只返回 null，等自愈；
 *  - 凭据被拒 / 主动登出 → 清除本地会话并广播 SIGNED_OUT。
 *
 * 本模块**不参与鉴权**：所有云端读写仍然使用 SDK 的 access token，
 * 权限由数据库 RLS 校验。这里读到的 user 只用于首屏不闪登录框、
 * 以及判断「这台设备是不是已经登录过」。
 */
export const SESSION_KEY_PREFIX = 'workbuddy-cloud.session.';

/** 设备曾成功登录过（用于会话失效时给出更准确的提示） */
const EVER_SIGNED_IN_KEY = 'cici_ever_signed_in_v1';
/** 用户主动登出：登出后不再自动弹登录框打扰，登录按钮仍常驻 */
const MANUAL_SIGNOUT_KEY = 'cici_manual_signout_v1';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: Record<string, unknown> | null;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    // 隐私模式 / WebView 禁用存储
    return null;
  }
}

/**
 * 读 SDK 落盘的会话。按前缀遍历而非硬编码完整 key，
 * 这样 publishableKey 变更或 SDK 调整 key 结构时仍然能识别。
 */
export function readStoredSession(): StoredSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(SESSION_KEY_PREFIX)) continue;
      const raw = storage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredSession;
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.accessToken === 'string' &&
        parsed.accessToken.length > 0 &&
        typeof parsed.refreshToken === 'string' &&
        typeof parsed.expiresAt === 'number' &&
        parsed.user &&
        typeof parsed.user === 'object'
      ) {
        return parsed;
      }
    }
  } catch {
    // 脏数据或存储不可读：按「没有会话」处理，不抛错阻断首屏
  }
  return null;
}

/** 从落盘会话里取最小用户画像，仅用于 UI 展示 */
export function storedSessionUser(session: StoredSession | null): { id: string; name: string } | null {
  const user = session?.user;
  if (!user || typeof user.id !== 'string' || user.id.length === 0) return null;
  return {
    id: user.id,
    name: typeof user.name === 'string' ? user.name : '',
  };
}

export function markSignedIn(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(EVER_SIGNED_IN_KEY, String(Date.now()));
    storage.removeItem(MANUAL_SIGNOUT_KEY);
  } catch {
    // 存储不可写时不影响本次登录
  }
}

export function markManualSignOut(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(MANUAL_SIGNOUT_KEY, '1');
  } catch {
    // 忽略
  }
}

export function clearManualSignOut(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(MANUAL_SIGNOUT_KEY);
  } catch {
    // 忽略
  }
}

export function isManualSignOut(): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    return storage.getItem(MANUAL_SIGNOUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function hasEverSignedIn(): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    return !!storage.getItem(EVER_SIGNED_IN_KEY);
  } catch {
    return false;
  }
}
