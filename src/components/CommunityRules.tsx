import React, { useEffect } from 'react';
import { X, ShieldCheck, ScrollText } from 'lucide-react';
import { COMMUNITY_RULES, COMMUNITY_ENFORCEMENT } from '../utils/community';

interface CommunityRulesProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 社区公约弹窗
 *
 * 不做成「点我同意才能继续」的强制拦截——公开门槛已经够高了，
 * 再拦一道只会劝退。做法是把规则摆在看得见的地方（论坛顶部、发帖框底部），
 * 需要时随时能打开，发帖时明确一句「发布即表示同意」。
 */
export const CommunityRules: React.FC<CommunityRulesProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-rules-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E4D8F5] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 pb-3 border-b border-[#F1E5D8]">
          <div className="w-10 h-10 rounded-2xl bg-[#F3EEFF] border border-[#DDD0FA] flex items-center justify-center shrink-0">
            <ScrollText className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="community-rules-title" className="text-base font-bold text-[#292524] leading-tight">
              舞友社区公约
            </h3>
            <p className="text-xs text-[#78695C] mt-1 leading-relaxed">
              这里只谈舞蹈，不做生意。六条，都写得很具体，看完就知道边界在哪。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭社区公约"
            className="p-1.5 rounded-lg text-[#A8988A] hover:text-[#292524] hover:bg-[#FAF2EB] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rules */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {COMMUNITY_RULES.map((rule, idx) => (
            <div key={rule.title} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#F3EEFF] text-[#7C3AED] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#3F352D] leading-snug">{rule.title}</p>
                <p className="text-[11.5px] text-[#78695C] leading-relaxed mt-0.5">{rule.body}</p>
              </div>
            </div>
          ))}

          <div className="bg-[#FFF8F3] border border-[#FAD6C5] rounded-2xl p-3 flex items-start gap-2 mt-1">
            <ShieldCheck className="w-4 h-4 text-[#B4452F] shrink-0 mt-0.5" />
            <p className="text-[11.5px] text-[#8C4A38] leading-relaxed">{COMMUNITY_ENFORCEMENT}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#F1E5D8] bg-[#FFFDFB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-[11px] text-[#A8988A]">
            举报入口在每条帖子和回复的右上角，举报人信息只有我们能看到。
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 active:scale-95"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
