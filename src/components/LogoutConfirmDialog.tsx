import React, { useEffect, useRef } from 'react';
import { LogOut, X } from 'lucide-react';

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 退出登录二次确认。
 *
 * 设计取向：这不是「危险操作」，所以用站点暖色而不是红色警告；
 * 把「继续浏览」做成最大的主按钮并默认聚焦，让误触的代价降到最低。
 * 遮罩 / X / Esc 都等价于取消，只有明确点「确认退出」才会真的登出。
 */
export const LogoutConfirmDialog: React.FC<LogoutConfirmDialogProps> = ({ isOpen, onCancel, onConfirm }) => {
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => stayRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-4 py-10 overflow-y-auto bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-desc"
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-[#F2E5D8] p-5 sm:p-6 animate-scaleUp"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="关闭退出确认弹窗"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-[#FFF2EB] border border-[#FFE0D0] flex items-center justify-center">
            <LogOut className="w-5 h-5 text-[#E65B47]" />
          </div>
          <div className="min-w-0">
            <h3 id="logout-dialog-title" className="font-display font-black text-lg text-[#292524] leading-tight">
              要退出登录吗？
            </h3>
            <p id="logout-dialog-desc" className="text-xs text-[#78695C] mt-1.5 leading-relaxed">
              退出后需要重新用手机号验证码登录，才能继续发帖和同步数据。
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 bg-[#FFFBF8] border border-[#F1E5D8] rounded-2xl p-3.5">
          <li className="flex items-start gap-2 text-xs text-[#5C4D42] leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5 shrink-0" />
            <span>已保存的作品、头像和标签会留在这台设备上，不会丢失。</span>
          </li>
          <li className="flex items-start gap-2 text-xs text-[#5C4D42] leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] mt-1.5 shrink-0" />
            <span>重新登录同一个手机号，云端数据会自动同步回来。</span>
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={stayRef}
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl bg-[#E65B47] hover:bg-[#C84B31] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            继续浏览
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-2 rounded-xl border border-[#E7D8C9] text-xs font-semibold text-[#8C7A6B] hover:text-[#C84B31] hover:border-[#F0B9A9] hover:bg-[#FFF7F3] transition-colors cursor-pointer"
          >
            确认退出登录
          </button>
        </div>
      </div>
    </div>
  );
};
