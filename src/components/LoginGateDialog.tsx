/**
 * LoginGateDialog —— 「这里需要登录」的提示层
 *
 * 和直接弹登录框的区别：先解释清楚为什么、登录能获得什么，
 * 再给「登录」和「先不登录」两个平等出口。游客点论坛详情、点发帖时用它，
 * 不至于一上来就要手机号。
 */
import React from 'react';
import { X, Lock, ArrowRight, Sparkles } from 'lucide-react';

interface LoginGateDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** 登录后能做什么，2~3 条即可 */
  benefits?: string[];
  onLogin: () => void;
  onCancel: () => void;
  onShowAccess?: () => void;
}

export const LoginGateDialog: React.FC<LoginGateDialogProps> = ({
  open,
  title,
  description,
  benefits = ['查看话题全文与全部回复', '发帖发起约练、点赞报名', '给舞友加好友、互发私信'],
  onLogin,
  onCancel,
  onShowAccess,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[62] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl p-5 sm:p-6 relative animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          aria-label="关闭"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-2xl bg-[#F5F0FF] text-[#7C3AED] flex items-center justify-center mb-3">
          <Lock className="w-5 h-5" />
        </div>

        <h3 className="font-display font-extrabold text-base text-[#292524] pr-6">{title}</h3>
        <p className="text-xs text-[#78695C] mt-1.5 leading-relaxed">{description}</p>

        <div className="mt-3.5 rounded-2xl bg-[#FBF7FF] border border-[#EDE4FE] px-3.5 py-3">
          <p className="text-[10.5px] font-bold text-[#6D28D9] flex items-center gap-1 mb-1.5">
            <Sparkles className="w-3 h-3" />
            登录后可以
          </p>
          <ul className="space-y-1">
            {benefits.map((b) => (
              <li key={b} className="text-[11px] text-[#574B40] flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#7C3AED] mt-1.5 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={onLogin}
          className="w-full mt-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] text-white text-sm font-bold shadow-lg shadow-[#FF6B6B]/20 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          登录 / 注册 <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="w-full mt-2 py-2 text-xs font-semibold text-[#8C7A6B] hover:text-[#574B40] hover:bg-[#F7EFE7] rounded-xl transition-colors cursor-pointer"
        >
          先不登录，回去继续记录
        </button>
        {onShowAccess && (
          <button
            onClick={onShowAccess}
            className="w-full mt-1 text-[10.5px] text-[#A8988A] hover:text-[#6B5A4D] underline underline-offset-2 cursor-pointer"
          >
            查看游客 / 登录权限差异
          </button>
        )}
      </div>
    </div>
  );
};
