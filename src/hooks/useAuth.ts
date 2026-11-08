/**
 * useAuth —— 云端登录状态 Hook（手机验证码登录）
 *
 * 会话由 SDK 持久化在 localStorage，刷新页面 / 重开浏览器都会自动恢复，
 * 同一设备首次登录后在会话有效期间无需再次输入验证码。
 *
 * 本层只负责「UI 登录态判定」，鉴权与权限完全交给 SDK token 与数据库 RLS。
 *
 * 修复的旧问题：SDK 的 getSession() 在 token 临近过期时会顺手续期，续期遇到
 * 网络抖动会返回 null **但保留本地会话**（设计上等自愈）；旧实现把 null 直接
 * 判成未登录，加上 2.5s watchdog 抢先把 user 置 null，于是每次打开都弹登录框。
 * 现在以「本地会话是否真实存在」为准：
 *  - 本地有会话 → 首屏乐观按已登录渲染，getSession 暂时拿不到就退避重试；
 *  - 本地会话被 SDK 清除（过期 / 凭据被拒 / 主动登出 / 清数据 / 别处登出）
 *    才转为未登录，并要求重新登录。
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { cloud, CloudUser } from '../services/cloud';
import {
  SESSION_KEY_PREFIX,
  readStoredSession,
  storedSessionUser,
  markSignedIn,
  clearManualSignOut,
  markManualSignOut,
  hasEverSignedIn,
} from '../utils/authSession';

/** 首屏放行兜底：SDK 长时间不返回时，不阻塞页面交互 */
const SESSION_RESTORE_TIMEOUT_MS = 2500;
/** 会话暂时校验失败时的退避重试间隔；网络恢复事件会立即重试并重置计数 */
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

const HINT_RECOVERING = '登录状态校验中，网络恢复后会自动继续';
const HINT_NETWORK = '网络异常，暂时无法校验登录状态，稍后自动重试';
const HINT_EXPIRED = '登录已过期，请重新登录';

interface AuthState {
  /** null = 未登录；undefined = 尚在恢复会话 */
  user: CloudUser | null | undefined;
  /** 会话恢复完成（首屏判定用） */
  ready: boolean;
  /** 网络异常 / 会话过期时的轻提示，供 App 用 toast 展示 */
  authHint: string;
  /** 发送验证码；成功返回 true */
  sendCode: (phone: string) => Promise<{ ok: boolean; message?: string }>;
  /** 校验验证码并登录/注册 */
  verifyCode: (phone: string, code: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
}

/** 手机号脱敏展示：138****1234 */
function maskPhone(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(7)}` : '舞友';
}

export function useAuth(): AuthState {
  // undefined = 加载中；null = 未登录
  const [user, setUser] = useState<CloudUser | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [authHint, setAuthHint] = useState('');
  // 保存发送验证码后的挑战状态（跨事件持久，不在 handler 里重新发送）
  const pendingRef = useRef<{ phone: string; verificationId: string; isExistingUser: boolean } | null>(null);
  /** 用户主动登出后，本次页面生命周期内不再乐观恢复登录态 */
  const manualSignOutRef = useRef(false);
  /** storage 事件里读取最新 user，避免闭包拿到旧值 */
  const userRef = useRef<CloudUser | null | undefined>(undefined);
  /** online / visibilitychange 时立即触发一次校准 */
  const recalibrateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let mounted = true;
    let settled = false;
    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
    const clearWatchdog = () => {
      if (watchdog) {
        clearTimeout(watchdog);
        watchdog = null;
      }
    };

    // 首屏乐观恢复：本地有会话就先按已登录渲染，避免闪登录框、避免被 watchdog 判成未登录
    const cachedUser = storedSessionUser(readStoredSession());
    if (cachedUser) {
      setUser(cachedUser as CloudUser);
      setReady(true);
    }

    const scheduleRetry = () => {
      if (!mounted || manualSignOutRef.current || retryCount >= RETRY_DELAYS_MS.length) return;
      const delay = RETRY_DELAYS_MS[retryCount];
      retryCount += 1;
      clearRetry();
      retryTimer = setTimeout(() => {
        void restore();
      }, delay);
    };

    /** 保持已登录 UI 并安排重试：本地会话仍在，只是这次没拿到可用 token */
    const keepSessionPending = (hint: string) => {
      const still = readStoredSession();
      if (!still) return false;
      const stored = storedSessionUser(still);
      if (stored) setUser(stored as CloudUser);
      setReady(true);
      setAuthHint(hint);
      scheduleRetry();
      return true;
    };

    async function restore() {
      try {
        const { data: session } = await cloud.auth.getSession();
        if (!mounted || manualSignOutRef.current) return;

        if (session?.user) {
          settled = true;
          clearRetry();
          clearWatchdog();
          retryCount = 0;
          manualSignOutRef.current = false;
          setUser(session.user as CloudUser);
          setReady(true);
          setAuthHint('');
          markSignedIn();
          return;
        }

        // getSession 返回 null 有两种含义：本来就没登录，或续期暂时失败但会话保留
        if (keepSessionPending(HINT_RECOVERING)) return;

        // 本地会话已被 SDK 清除 → 会话过期 / 凭据被拒 / 主动登出 / 设备清数据
        settled = true;
        clearRetry();
        clearWatchdog();
        setUser(null);
        setReady(true);
        setAuthHint(hasEverSignedIn() && !manualSignOutRef.current ? HINT_EXPIRED : '');
      } catch (err) {
        if (!mounted || manualSignOutRef.current) return;
        console.warn('会话校验失败，保留本地登录态并重试', err);
        if (keepSessionPending(HINT_NETWORK)) return;
        settled = true;
        clearRetry();
        clearWatchdog();
        setUser((current) => (current === undefined ? null : current));
        setReady(true);
      }
    }

    // 兜底：SDK 长时间不返回时放行首屏。有本地会话时绝不抢先判成未登录。
    watchdog = setTimeout(() => {
      if (settled || !mounted) return;
      if (!readStoredSession()) {
        setUser((current) => (current === undefined ? null : current));
      }
      setReady(true);
    }, SESSION_RESTORE_TIMEOUT_MS);

    recalibrateRef.current = () => {
      if (!mounted || manualSignOutRef.current || !readStoredSession()) return;
      retryCount = 0;
      clearRetry();
      void restore();
    };

    void restore();

    // 登录 / 退出 / 续期时同步 UI；SIGNED_OUT 只在 SDK 真正清掉会话时广播
    const unsubscribe = cloud.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        settled = true;
        clearRetry();
        clearWatchdog();
        setUser(null);
        setReady(true);
        setAuthHint(manualSignOutRef.current ? '' : HINT_EXPIRED);
        return;
      }
      if (session?.user) {
        settled = true;
        retryCount = 0;
        clearRetry();
        clearWatchdog();
        manualSignOutRef.current = false;
        setUser(session.user as CloudUser);
        setReady(true);
        setAuthHint('');
        markSignedIn();
      }
    });

    /** 多标签 / 设备清数据：另一个标签登录或登出时同步本页 */
    const onStorage = (e: StorageEvent) => {
      if (!mounted) return;
      // key 为 null 表示 localStorage.clear()，也必须处理
      if (e.key !== null && !e.key.startsWith(SESSION_KEY_PREFIX)) return;
      const now = readStoredSession();
      if (!now) {
        clearRetry();
        if (userRef.current) {
          setUser(null);
          setReady(true);
          setAuthHint('登录状态已在其他位置退出');
        }
        return;
      }
      if (!userRef.current) {
        manualSignOutRef.current = false;
        clearManualSignOut();
        const stored = storedSessionUser(now);
        if (stored) setUser(stored as CloudUser);
        retryCount = 0;
        void restore();
      }
    };

    const onOnline = () => recalibrateRef.current?.();
    const onVisible = () => {
      if (document.visibilityState === 'visible') recalibrateRef.current?.();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      mounted = false;
      recalibrateRef.current = null;
      clearRetry();
      clearWatchdog();
      unsubscribe?.();
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const sendCode = useCallback(async (phone: string) => {
    if (!/^1\d{10}$/.test(phone)) {
      return { ok: false, message: '请输入正确的 11 位手机号' };
    }
    const sent = await cloud.auth.sendOtp({ phone });
    if (sent.error) {
      return { ok: false, message: sent.error.message || '验证码发送失败，请稍后重试' };
    }
    pendingRef.current = {
      phone,
      verificationId: sent.data.verificationId,
      isExistingUser: sent.data.isExistingUser,
    };
    return { ok: true };
  }, []);

  const verifyCode = useCallback(async (phone: string, code: string) => {
    const pending = pendingRef.current;
    if (!pending || pending.phone !== phone) {
      return { ok: false, message: '请先获取当前手机号的验证码' };
    }
    const completed = await cloud.auth.verifyOtp({
      phone: pending.phone,
      verificationId: pending.verificationId,
      isExistingUser: pending.isExistingUser,
      token: code,
    });
    if (completed.error) {
      return { ok: false, message: completed.error.message || '验证码校验失败，请重试' };
    }
    pendingRef.current = null;
    // 不依赖事件是否到达：登录成功立刻落标记并清掉「主动登出」标记
    manualSignOutRef.current = false;
    markSignedIn();
    if (completed.data?.user) {
      setUser(completed.data.user as CloudUser);
      setReady(true);
      setAuthHint('');
    }
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    manualSignOutRef.current = true;
    markManualSignOut();
    setAuthHint('');
    setUser(null);
    await cloud.auth.signOut();
  }, []);

  return { user, ready, authHint, sendCode, verifyCode, signOut };
}

/** 展示昵称：平台昵称 > 手机号脱敏 > 兜底 */
export function displayName(user: CloudUser | null | undefined, phone?: string): string {
  if (user?.name) return user.name;
  if (phone) return maskPhone(phone);
  return '舞友';
}
