/**
 * GuestModeBar —— 游客态常驻提示条
 *
 * 目的不是催登录，而是让用户放心往下用：
 * 1. 明确「你现在是游客」，不会有"我数据去哪了"的疑惑；
 * 2. 告诉他记录已经存在本机（带上真实条数，比空口号可信）；
 * 3. 只留一个轻量入口：登录（同步） / 权限差异。
 *
 * 自动登录弹窗已取消，这个条子就是游客态唯一的常驻引导，可手动关掉（本次会话内）。
 */
import React from 'react';
import { Sprout, Cloud, X, ArrowRight } from 'lucide-react';

interface GuestModeBarProps {
  /** 本机已保存的记录数，用于「已帮你存好 N 条」 */
  localRecordCount: number;
  onLogin: () => void;
  onShowAccess: () => void;
  onDismiss: () => void;
}

export const GuestModeBar: React.FC<GuestModeBarProps> = ({
  localRecordCount,
  onLogin,
  onShowAccess,
  onDismiss,
}) => {
  return (
    <div className="bg-[#FFF8EE] border-b border-[#F3E2CB]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#9A6A20] bg-[#FCEBCF] border border-[#F2D9AE] px-2 py-0.5 rounded-full shrink-0">
          <Sprout className="w-3 h-3" />
          游客模式
        </span>

        <p className="text-[11.5px] text-[#6B5A4D] flex-1 min-w-[180px] leading-snug">
          {localRecordCount > 0 ? (
            <>
              已在本机存好 <strong className="text-[#B4452F]">{localRecordCount}</strong> 条记录，只有你能看到。
              登录后会自动并入账号，换手机也接着记。
            </>
          ) : (
            <>不需要注册就能开始记录，数据只保存在这台设备。登录后自动云同步、换设备接着记。</>
          )}
        </p>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={onShowAccess}
            className="text-[11px] font-semibold text-[#8C7A6B] hover:text-[#5A4535] underline underline-offset-2 px-1 cursor-pointer"
          >
            权限差异
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#E8D6C0] text-[11px] font-bold text-[#B4452F] hover:bg-[#FFF1E4] transition-colors cursor-pointer"
          >
            <Cloud className="w-3 h-3" />
            登录同步
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="收起游客提示"
            className="w-6 h-6 flex items-center justify-center rounded-full text-[#B8A99A] hover:bg-[#F3E6D6] hover:text-[#6B5A4D] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
