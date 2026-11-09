import React, { useEffect, useState } from 'react';
import { X, Flag, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { REPORT_REASONS, REPORT_RECEIVED_TIP } from '../utils/community';
import { submitReport, type ReportTargetType } from '../services/reportApi';

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  authorId?: string;
  authorName?: string;
  /** 内容摘要：后台不用翻原文就能判断 */
  excerpt?: string;
}

interface ReportDialogProps {
  target: ReportTarget | null;
  currentUserName?: string;
  onClose: () => void;
  /** 提交成功：父组件据此把内容在本机折叠，避免举报后还天天看到 */
  onSubmitted?: (target: ReportTarget, synced: boolean) => void;
}

/**
 * 举报弹窗
 *
 * 三个设计决定：
 * 1. 原因写具体（「站外收款」「虚假约练」），不写「违规内容」——用户才知道该选哪个，
 *    你也能据此判断优先级。
 * 2. 明确告知「被举报者不会收到通知、举报人信息只有平台可见」，否则没人敢点。
 * 3. 提交后立刻在本机隐藏该内容，给一个即时结果；同时如实说明是否已上云。
 */
export const ReportDialog: React.FC<ReportDialogProps> = ({
  target,
  currentUserName,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ synced: boolean; message: string } | null>(null);

  // 每次换目标都清空，避免把上一条的补充说明带到下一条
  useEffect(() => {
    if (target) {
      setReason('');
      setDetail('');
      setBusy(false);
      setResult(null);
    }
  }, [target?.type, target?.id]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, busy, onClose]);

  if (!target) return null;

  const handleSubmit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const res = await submitReport(
      {
        targetType: target.type,
        targetId: target.id,
        targetAuthorId: target.authorId,
        targetExcerpt: target.excerpt,
        reason,
        detail,
      },
      currentUserName
    );
    setBusy(false);
    setResult({ synced: res.synced, message: res.message });
    onSubmitted?.(target, res.synced);
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#F5D5CB] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-3 border-b border-[#F1E5D8]">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF1EC] border border-[#FFD5C8] flex items-center justify-center shrink-0">
            <Flag className="w-5 h-5 text-[#B4452F]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="report-dialog-title" className="text-base font-bold text-[#292524] leading-tight">
              举报这条内容
            </h3>
            <p className="text-xs text-[#78695C] mt-1 leading-relaxed">
              {target.authorName ? `来自 ${target.authorName}·` : ''}
              被举报者不会收到通知，举报人信息只有平台能看到。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭举报弹窗"
            className="p-1.5 rounded-lg text-[#A8988A] hover:text-[#292524] hover:bg-[#FAF2EB] transition-colors cursor-pointer shrink-0 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          /* 提交结果：不玩「已收到」的套话，讲清会怎么处理、多久 */
          <div className="flex-1 overflow-y-auto px-5 py-6 text-center space-y-3">
            <div
              className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                result.synced ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {result.synced ? <Check className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <p className="text-sm font-bold text-[#292524]">{result.message}</p>
            <p className="text-xs text-[#78695C] leading-relaxed max-w-xs mx-auto">
              {result.synced ? REPORT_RECEIVED_TIP : '网络或登录状态出了点问题，这条举报先存在你本机，登录后会自动补传。'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 px-6 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95"
            >
              好，知道了
            </button>
          </div>
        ) : (
          <>
            {/* 举报原因 */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
              <p className="text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider mb-2">
                选择原因（必选）
              </p>
              {REPORT_REASONS.map((r) => {
                const active = reason === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setReason(r.key)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#FFF1EC] border-[#F5B9A6] ring-1 ring-[#E65B47]/20'
                        : 'bg-white border-[#EEE2D6] hover:bg-[#FFFCF8]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          active ? 'border-[#E65B47] bg-[#E65B47]' : 'border-[#D9C4B4] bg-white'
                        }`}
                      >
                        {active && <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#3F352D] leading-snug">{r.label}</p>
                        {r.hint && (
                          <p className="text-[10.5px] text-[#A8988A] leading-snug mt-0.5">{r.hint}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              <div className="pt-2">
                <label
                  htmlFor="report-detail"
                  className="text-[11px] font-bold text-[#8C7A6B] uppercase tracking-wider"
                >
                  补充说明（选填）
                </label>
                <textarea
                  id="report-detail"
                  value={detail}
                  onChange={(e) => setDetail(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="有具体时间、金额、对方要求你做什么，写一句就好，处理会更快。"
                  className="mt-1.5 w-full text-xs px-3 py-2 rounded-xl border border-[#E8DACB] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#E65B47] resize-none leading-relaxed"
                />
                <p className="text-[10px] text-[#B8A89A] text-right mt-0.5">{detail.length}/500</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#F1E5D8] bg-[#FFFDFB]">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!reason || busy}
                className="px-5 py-2 bg-[#E65B47] hover:bg-[#D14A36] disabled:bg-[#E8D5CC] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
                <span>{busy ? '提交中…' : '提交举报'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
