/**
 * LoginModal —— 手机验证码登录/注册弹窗
 * 新用户验证通过即自动注册，无需密码。
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Smartphone, ShieldCheck, Loader2 } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sendCode: (phone: string) => Promise<{ ok: boolean; message?: string }>;
  verifyCode: (phone: string, code: string) => Promise<{ ok: boolean; message?: string }>;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess, sendCode, verifyCode }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => (c <= 1 ? 0 : c - 1));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [countdown]);

  if (!isOpen) return null;

  const handlePhoneChange = (v: string) => {
    setPhone(v.replace(/\D/g, '').slice(0, 11));
    setError('');
  };

  const handleSendCode = async () => {
    if (sending || countdown > 0) return;
    setSending(true);
    try {
      const result = await sendCode(phone);
      if (!result.ok) {
        setError(result.message || '验证码发送失败');
      } else {
        setCodeSent(true);
        setCountdown(60);
        setError('');
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    if (!codeSent) {
      setError('请先获取验证码');
      return;
    }
    if (code.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyCode(phone, code);
      if (!result.ok) {
        setError(result.message || '验证失败，请重试');
      } else {
        onSuccess?.();
        onClose();
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 py-8 overflow-y-auto bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm my-auto rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl p-5 sm:p-6 relative animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#FFE8E0] text-[#FF6B6B] flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#292524]">登录舞友论坛</h3>
            <p className="text-xs text-[#8C7A6B]">手机验证码登录，新号码自动注册</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#574B40] mb-1.5">手机号</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="请输入 11 位手机号"
              className="w-full px-4 py-3 rounded-2xl border border-[#E8DACB] bg-white text-sm text-[#292524] placeholder-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 focus:border-[#FF6B6B]/40 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#574B40] mb-1.5">验证码</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="6 位验证码"
                disabled={!codeSent}
                className="flex-1 px-4 py-3 rounded-2xl border border-[#E8DACB] bg-white text-sm text-[#292524] placeholder-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/20 focus:border-[#FF6B6B]/40 transition-all disabled:bg-[#F7EFE7] disabled:text-[#B8A99A]"
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sending || countdown > 0 || phone.length !== 11}
                className="px-4 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all bg-[#FFE8E0] text-[#D94834] border border-[#FFD5C8] hover:bg-[#FFEAE0] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : countdown > 0 ? (
                  `${countdown}s 后重发`
                ) : codeSent ? (
                  '重新发送'
                ) : (
                  '获取验证码'
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-[#D94834] bg-[#FFF1EC] border border-[#FFD5C8] rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={verifying || !codeSent || code.length !== 6}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] text-white text-sm font-bold shadow-lg shadow-[#FF6B6B]/25 hover:shadow-xl hover:shadow-[#FF6B6B]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 验证中…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> 登录 / 注册
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-[11px] text-[#A8988A] text-center leading-relaxed">
          登录后你的作品、打卡、发帖、约练记录会存到云端，
          <br />
          换设备登录同一手机号即可继续使用。
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-2 text-xs font-semibold text-[#8C7A6B] hover:text-[#574B40] hover:bg-[#F7EFE7] rounded-xl transition-colors cursor-pointer"
        >
          先逛逛，暂不登录
        </button>
      </div>
    </div>
  );
};
