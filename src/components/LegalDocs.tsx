/**
 * LegalDocs —— 隐私政策 / 用户协议 阅读层
 *
 * 为什么单独做成一页而不是塞进已有弹窗：
 * 这两份文档是用户判断「敢不敢在这里写私事」的依据，必须能独立打开、
 * 能被截图、能在页脚随时找到。放在「权限对比」里会被当成功能罗列。
 *
 * 入口：欢迎弹窗底部、页脚、关于我页、意见反馈弹窗底部。
 */
import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, FileText, ArrowRight } from 'lucide-react';
import { LEGAL_DOCS, type LegalDocKey } from '../utils/legal';

interface LegalDocsProps {
  open: boolean;
  initialDoc?: LegalDocKey;
  onClose: () => void;
  /** 打开「意见与数据请求」，用于账号数据删除等需要人工处理的诉求 */
  onOpenFeedback?: () => void;
}

export const LegalDocs: React.FC<LegalDocsProps> = ({ open, initialDoc = 'privacy', onClose, onOpenFeedback }) => {
  const [doc, setDoc] = useState<LegalDocKey>(initialDoc);

  // 每次打开都回到调用方指定的那一篇
  useEffect(() => {
    if (open) setDoc(initialDoc);
  }, [open, initialDoc]);

  if (!open) return null;

  const current = LEGAL_DOCS[doc];

  return (
    <div
      className="fixed inset-0 z-[66] flex items-start sm:items-center justify-center p-4 py-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
    >
      <div
        className="w-full max-w-lg max-h-[86vh] flex flex-col rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl relative animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 sm:px-6 pt-5 pb-3 border-b border-[#F3E9DE]">
          <button
            onClick={onClose}
            aria-label="关闭"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 pr-8">
            <div className="w-9 h-9 rounded-2xl bg-[#EFEAFE] text-[#6D28D9] flex items-center justify-center shrink-0">
              {doc === 'privacy' ? <ShieldCheck className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-base text-[#292524] leading-tight">{current.title}</h3>
              <p className="text-[10.5px] text-[#A8988A] mt-0.5">更新于 {current.updatedAt}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F7EFE7]">
            {(['privacy', 'terms'] as LegalDocKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setDoc(key)}
                className={`py-1.5 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
                  doc === key ? 'bg-white text-[#5B21B6] shadow-2xs' : 'text-[#8C7A6B] hover:text-[#574B40]'
                }`}
              >
                {LEGAL_DOCS[key].title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4">
          <p className="text-[12px] text-[#574B40] leading-relaxed bg-[#FBF7FF] border border-[#EDE9FE] rounded-xl px-3 py-2.5">
            {current.intro}
          </p>

          <div className="mt-4 space-y-4">
            {current.sections.map((section) => (
              <section key={section.heading}>
                <h4 className="text-[12.5px] font-bold text-[#292524] mb-1.5">{section.heading}</h4>
                {section.paragraphs?.map((p) => (
                  <p key={p.slice(0, 24)} className="text-[11.5px] text-[#574B40] leading-relaxed mb-1.5">
                    {p}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="space-y-1.5">
                    {section.bullets.map((b) => (
                      <li key={b.slice(0, 24)} className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[#C4B5FD] mt-[7px] shrink-0" />
                        <span className="text-[11.5px] text-[#574B40] leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {onOpenFeedback && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFeedback();
              }}
              className="w-full mt-5 flex items-center justify-between gap-2 rounded-xl border border-[#E8DACB] bg-white hover:bg-[#FAF2EB] px-3.5 py-2.5 transition-colors cursor-pointer"
            >
              <span className="text-[11.5px] text-[#574B40]">要删除账号数据，或对规则有疑问？</span>
              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#6D28D9] shrink-0">
                提交请求 <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          )}
        </div>

        <div className="shrink-0 px-5 sm:px-6 py-3 border-t border-[#F3E9DE]">
          <p className="text-[10.5px] text-[#A8988A] leading-relaxed text-center">
            时间线始终只有你自己可见 · 论坛内容才是公开的
          </p>
        </div>
      </div>
    </div>
  );
};
