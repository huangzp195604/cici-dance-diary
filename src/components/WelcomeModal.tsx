/**
 * WelcomeModal —— 首次进入的三选一（游客 / 登录）
 *
 * 为什么要有它：以前第一屏就弹手机验证码，游客从这里流失最快。
 * 现在先给两条平等的路——
 *   1. 游客直接开始记录（默认推荐，按钮最显眼）；
 *   2. 登录（论坛 + 云同步）。
 * 只在一台设备上出现一次，之后由顶部游客提示条常驻提醒，不再打扰。
 */
import React from 'react';
import { X, Sprout, Smartphone, HardDrive, Cloud, Users, ShieldCheck, ArrowRight } from 'lucide-react';

interface WelcomeModalProps {
  open: boolean;
  onGuest: () => void;
  onLogin: () => void;
  onShowAccess: () => void;
  onShowLegal: (doc: 'privacy' | 'terms') => void;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  open,
  onGuest,
  onLogin,
  onShowAccess,
  onShowLegal,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[64] flex items-start sm:items-center justify-center p-4 py-8 overflow-y-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="选择使用方式"
    >
      <div
        className="w-full max-w-md my-auto rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl p-5 sm:p-6 relative animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-[#FFE8E0] text-[#E05A45] flex items-center justify-center shrink-0">
            <Sprout className="w-5 h-5" />
          </div>
          <div className="pr-6">
            <h3 className="font-display font-extrabold text-lg text-[#292524] leading-tight">
              你的舞蹈成长日记
            </h3>
            <p className="text-[11px] text-[#8C7A6B] mt-0.5">一个只属于你的私密记录空间</p>
          </div>
        </div>

        <p className="text-xs text-[#6B5A4D] leading-relaxed mb-4">
          记录每一次练舞、看清自己的进步。你想怎么开始都可以——
        </p>

        {/* 路径一：游客 */}
        <button
          onClick={onGuest}
          className="w-full text-left rounded-2xl border-2 border-[#FFD9CC] bg-[#FFF7F2] hover:bg-[#FFF1EA] hover:border-[#FFBFA8] p-4 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#B4452F]">
              <HardDrive className="w-4 h-4" />
              先以游客身份开始
            </span>
            <span className="text-[10px] font-bold bg-[#FFE0D1] text-[#B4452F] px-1.5 py-0.5 rounded-full">
              零门槛
            </span>
          </div>
          <p className="text-[11px] text-[#7A584C] mt-1.5 leading-relaxed">
            不用手机号，马上记录。数据只存在这台设备，只有你能看到；
            以后登录，这些记录会自动并入你的账号。
          </p>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E05A45] mt-2 group-hover:gap-2 transition-all">
            直接开始记录 <ArrowRight className="w-3 h-3" />
          </span>
        </button>

        {/* 路径二：登录 */}
        <button
          onClick={onLogin}
          className="w-full text-left rounded-2xl border border-[#E3D7FE] bg-white hover:bg-[#FBF7FF] p-4 transition-all cursor-pointer mt-2.5 group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#5B21B6]">
              <Smartphone className="w-4 h-4" />
              登录 / 注册
            </span>
            <span className="text-[10px] font-bold bg-[#EDE9FE] text-[#6D28D9] px-1.5 py-0.5 rounded-full">
              手机号一键
            </span>
          </div>
          <div className="mt-1.5 space-y-1">
            <p className="text-[11px] text-[#574B40] flex items-center gap-1.5">
              <Cloud className="w-3 h-3 text-[#7C3AED] shrink-0" />
              记录云端同步，换设备登录接着记
            </p>
            <p className="text-[11px] text-[#574B40] flex items-center gap-1.5">
              <Users className="w-3 h-3 text-[#7C3AED] shrink-0" />
              解锁舞友论坛：发帖约练、加好友、私信
            </p>
          </div>
        </button>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#A8988A]">
          <ShieldCheck className="w-3 h-3" />
          时间线仅自己可见 · 论坛才是公开区
        </div>

        <button
          onClick={onShowAccess}
          className="w-full mt-1.5 text-[10.5px] text-[#A8988A] hover:text-[#6B5A4D] underline underline-offset-2 cursor-pointer"
        >
          先看看两种状态的权限差异
        </button>

        <p className="mt-2 text-center text-[10px] text-[#A8988A] leading-relaxed">
          继续即表示同意
          <button
            type="button"
            onClick={() => onShowLegal('terms')}
            className="mx-0.5 text-[#8C7A6B] hover:text-[#6B5A4D] underline underline-offset-2 cursor-pointer"
          >
            《用户协议》
          </button>
          与
          <button
            type="button"
            onClick={() => onShowLegal('privacy')}
            className="mx-0.5 text-[#8C7A6B] hover:text-[#6B5A4D] underline underline-offset-2 cursor-pointer"
          >
            《隐私政策》
          </button>
        </p>
      </div>
    </div>
  );
};
