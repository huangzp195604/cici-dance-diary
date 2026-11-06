/**
 * useAuth —— 云端登录状态 Hook（手机验证码登录）
 * 会话由 SDK 持久化，刷新页面自动恢复，无需手动存 token。
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { cloud, CloudUser } from '../services/cloud';

interface AuthState {
  /** null = 未登录；undefined = 尚在恢复会话 */
  user: CloudUser | null | undefined;
  /** 会话恢复完成（首屏判定用） */
  ready: boolean;
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
  // 保存发送验证码后的挑战状态（跨事件持久，不在 handler 里重新发送）
  const pendingRef = useRef<{ phone: string; verificationId: string; isExistingUser: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const { data: session } = await cloud.auth.getSession();
      if (!mounted) return;
      setUser(session ? (session.user as CloudUser) : null);
      setReady(true);
    }
    restore();

    // 登录 / 退出 / 刷新会话时自动同步 UI
    const unsubscribe = cloud.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session ? (session.user as CloudUser) : null);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
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
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await cloud.auth.signOut();
    setUser(null);
  }, []);

  return { user, ready, sendCode, verifyCode, signOut };
}

/** 展示昵称：平台昵称 > 手机号脱敏 > 兜底 */
export function displayName(user: CloudUser | null | undefined, phone?: string): string {
  if (user?.name) return user.name;
  if (phone) return maskPhone(phone);
  return '舞友';
}
