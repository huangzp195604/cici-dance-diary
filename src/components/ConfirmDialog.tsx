import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: React.ReactNode;
  /** 将被清除/影响的内容清单，逐条展示 */
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  /** 是否必须勾选确认后才能提交 */
  requireAcknowledgement?: boolean;
  acknowledgementLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 通用二次确认弹窗（危险操作）
 * 用于所有“清空/清除”类不可恢复操作的二次确认
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  details,
  confirmLabel = '确认清空',
  cancelLabel = '取消',
  requireAcknowledgement = false,
  acknowledgementLabel = '我已确认并知晓该操作不可恢复',
  onCancel,
  onConfirm,
}) => {
  const [acknowledged, setAcknowledged] = useState(false);

  // 每次打开时重置勾选状态
  useEffect(() => {
    if (open) {
      setAcknowledged(false);
    }
  }, [open]);

  // 支持 Esc 关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmDisabled = requireAcknowledgement && !acknowledged;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-rose-200/80 animate-scaleUp overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 sm:p-6 pb-0">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-bold text-[#292524] leading-tight">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="text-xs text-[#78695C] mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="关闭确认弹窗"
            className="p-1.5 rounded-lg text-[#A8988A] hover:text-[#292524] hover:bg-[#FAF2EB] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 py-4 flex-1 overflow-y-auto space-y-4">
          {details && details.length > 0 && (
            <ul className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3 space-y-1.5">
              {details.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-[#7A4A42] leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626]/70 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}

          {requireAcknowledgement && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <span
                className={`mt-0.5 w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                  acknowledged
                    ? 'bg-[#DC2626] border-[#DC2626]'
                    : 'bg-white border-[#D9C4B4]'
                }`}
              >
                {acknowledged && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="sr-only"
              />
              <span className="text-xs text-[#5C4D42] leading-relaxed">{acknowledgementLabel}</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-[#F1E5D8] bg-[#FFFDFB]">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="px-5 py-2 bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-[#E8D5CC] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
