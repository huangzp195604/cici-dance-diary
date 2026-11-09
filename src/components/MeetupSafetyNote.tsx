import React, { useEffect } from 'react';
import { ShieldAlert, X, HandHeart, MapPin, Users, Wallet } from 'lucide-react';
import {
  MEETUP_SAFETY_SHORT,
  MEETUP_SAFETY_CHECKS,
  MEETUP_SAFETY_CONFIRM,
} from '../utils/community';

/**
 * 约练安全提示
 *
 * 分两层，各管一件事：
 * - 常驻提示条（卡片里一行）：让没报名的人也知道规矩，不打断浏览。
 * - 首次报名确认（弹窗）：真正要去的人必须看过三条具体动作。
 *
 * 只在这台设备上确认一次（localStorage），之后报名不再弹——
 * 每次报名都弹一遍的免责声明，只会被无脑点掉，最后谁也没看。
 */
const ACK_KEY = 'cici_meetup_safety_ack_v1';

export function hasAckedMeetupSafety(): boolean {
  try {
    return !!localStorage.getItem(ACK_KEY);
  } catch {
    return false;
  }
}

export function ackMeetupSafety(): void {
  try {
    localStorage.setItem(ACK_KEY, String(Date.now()));
  } catch {
    // 隐私模式写不进去：本次会话内已确认过，只是下次还会再问一次
  }
}

/** 卡片里的常驻一行提示 */
export const MeetupSafetyNote: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`flex items-start gap-1.5 text-[11px] leading-snug text-[#8A6A3F] ${className}`}
    title="首次见面请选公共场所，并把时间地点告诉一位朋友"
  >
    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px text-[#B45309]" />
    <span>{MEETUP_SAFETY_SHORT}</span>
  </div>
);

const CHECK_ICONS = [MapPin, Users, Wallet];

interface ConfirmProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 首次报名前的确认弹窗 */
export const MeetupSafetyConfirm: React.FC<ConfirmProps> = ({ open, onCancel, onConfirm }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="meetup-safety-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#FAD6C5] overflow-hidden">
        <div className="flex items-start gap-3 p-5 pb-3 border-b border-[#F1E5D8]">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF6E8] border border-[#F2DFC0] flex items-center justify-center shrink-0">
            <HandHeart className="w-5 h-5 text-[#B45309]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="meetup-safety-title" className="text-base font-bold text-[#292524] leading-tight">
              报名前的三件事
            </h3>
            <p className="text-xs text-[#78695C] mt-1 leading-relaxed">
              见陌生人约练，做对这三件就够了。不复杂，但别省。
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭安全提示"
            className="p-1.5 rounded-lg text-[#A8988A] hover:text-[#292524] hover:bg-[#FAF2EB] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {MEETUP_SAFETY_CHECKS.map((item, idx) => {
            const Icon = CHECK_ICONS[idx] || MapPin;
            return (
              <div key={item.title} className="flex items-start gap-3 bg-[#FFFCF8] border border-[#F3E5D7] rounded-2xl p-3">
                <div className="w-8 h-8 rounded-xl bg-[#FFF1EC] text-[#E65B47] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#3F352D] leading-snug">{item.title}</p>
                  <p className="text-[11.5px] text-[#78695C] leading-relaxed mt-0.5">{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#F1E5D8] bg-[#FFFDFB]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            先不报
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 bg-[#E65B47] hover:bg-[#D14A36] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer active:scale-95"
          >
            {MEETUP_SAFETY_CONFIRM}
          </button>
        </div>
      </div>
    </div>
  );
};
