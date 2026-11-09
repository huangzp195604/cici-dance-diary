/**
 * FeedbackDialog —— 意见与数据请求
 *
 * 为什么和举报共用一个队列：用户要的是「有人处理」，不是给平台分门别类。
 * 数据删除、规则疑问、功能建议都落在 content_reports，管理员在同一处看，
 * 就不会出现「隐私政策里写着可以申请删除，但没人收」的断头路。
 *
 * 未登录不能提交（表要求 owner_id），所以这里直接引导登录，而不是骗用户「已收到」。
 */
import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import { submitFeedback } from '../services/adminApi';

const KINDS = ['功能建议', '数据问题', '删除我的账号数据', '其他'] as const;
type Kind = (typeof KINDS)[number];

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  ownerName?: string;
  onLogin: () => void;
}

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open,
  onClose,
  isLoggedIn,
  ownerName,
  onLogin,
}) => {
  const [kind, setKind] = useState<Kind>('功能建议');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const close = () => {
    onClose();
    // 关闭后延迟重置，避免看到内容闪一下消失
    window.setTimeout(() => {
      setDone(false);
      setError(null);
      setText('');
      setKind('功能建议');
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (content.length < 5) {
      setError('再写几个字，让我们知道具体是什么问题。');
      return;
    }
    setError(null);
    setSending(true);
    try {
      await submitFeedback(kind, content, ownerName);
      setDone(true);
    } catch (err) {
      setError(String((err as Error)?.message || err) || '提交失败，稍后再试');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[68] flex items-start sm:items-center justify-center p-4 py-8 bg-black/40 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="意见与数据请求"
    >
      <div
        className="w-full max-w-md my-auto rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl p-5 sm:p-6 relative animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          aria-label="关闭"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 pr-8">
          <div className="w-9 h-9 rounded-2xl bg-[#EFEAFE] text-[#6D28D9] flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-extrabold text-base text-[#292524] leading-tight">意见与数据请求</h3>
            <p className="text-[10.5px] text-[#A8988A] mt-0.5">会有人看，7 个工作日内回复</p>
          </div>
        </div>

        {done ? (
          <div className="mt-5 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-5 text-center">
            <CheckCircle2 className="w-7 h-7 text-[#166534] mx-auto mb-2" />
            <p className="text-[12.5px] font-bold text-[#166534]">已收到</p>
            <p className="text-[11.5px] text-[#3F6212] mt-1 leading-relaxed">
              {kind === '删除我的账号数据'
                ? '删除请求已记录，我们会在 7 个工作日内处理，期间你的账号仍可正常使用。'
                : '我们会在 7 个工作日内查看并处理，需要你补充信息时会通过站内联系。'}
            </p>
            <button
              type="button"
              onClick={close}
              className="mt-3 px-4 py-1.5 rounded-xl bg-[#166534] text-white text-[11.5px] font-bold cursor-pointer"
            >
              知道了
            </button>
          </div>
        ) : !isLoggedIn ? (
          <div className="mt-5">
            <p className="text-[12px] text-[#574B40] leading-relaxed">
              提交请求需要先登录，这样我们才知道要处理谁的账号。
              登录不会把你本机已有的记录传上去，除非你自己选择并入。
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogin();
              }}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12.5px] font-bold cursor-pointer"
            >
              登录后提交
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-[#574B40] mb-1.5">1. 这是什么</label>
              <div className="grid grid-cols-2 gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                      kind === k
                        ? 'bg-[#7C3AED] text-white border-[#6D28D9]'
                        : 'bg-[#FAF2EB] text-[#736357] border-[#E8DACB] hover:bg-[#F3E5D7]'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#574B40] mb-1.5">2. 具体说明</label>
              <textarea
                rows={4}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={
                  kind === '删除我的账号数据'
                    ? '说明要删除的范围（全部账号 / 仅云端记录），以及是否保留本机数据。'
                    : '遇到什么问题、希望在哪个页面改，写具体一点我们才好处理。'
                }
                className="w-full text-xs p-3 rounded-2xl border border-[#E8DACB] bg-[#FFFDF9] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
              />
              <p className={`text-[10.5px] mt-1 text-right ${text.length > 500 ? 'text-[#C2410C] font-semibold' : 'text-[#A8988A]'}`}>
                {text.length} / 500 字
              </p>
            </div>

            {error && (
              <p className="flex items-start gap-1.5 text-[11px] text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-2.5 py-2 leading-relaxed">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={sending || text.trim().length < 5 || text.length > 500}
              className="w-full py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? '提交中…' : '提交'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
