/**
 * AccessCompareModal —— 游客 / 登录 两种状态的权限与同步机制说明
 *
 * 这是产品里唯一「讲清楚规则」的地方：哪些功能游客能用、哪些必须登录、
 * 数据到底存在哪里、登录后怎么并进账号。入口：导航栏「游客」徽标、
 * 游客提示条、登录弹窗底部、页脚。
 */
import React from 'react';
import { X, Check, Lock, Eye, HardDrive, Cloud, ArrowRight, ShieldCheck } from 'lucide-react';
import { ACCESS_ROWS, SYNC_NOTES, accessStyle, accessIcon } from '../utils/access';

interface AccessCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 当前是否游客态：用来高亮「你现在在哪一列」 */
  isGuest: boolean;
  onLogin: () => void;
  /** 本机已保存的记录数，登录后会并入账号 */
  localRecordCount?: number;
}

const LevelIcon: React.FC<{ level: ReturnType<typeof accessIcon>; className?: string }> = ({ level, className }) => {
  if (level === 'lock') return <Lock className={className} />;
  if (level === 'eye') return <Eye className={className} />;
  return <Check className={className} />;
};

export const AccessCompareModal: React.FC<AccessCompareModalProps> = ({
  isOpen,
  onClose,
  isGuest,
  onLogin,
  localRecordCount = 0,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-start sm:items-center justify-center p-4 py-8 overflow-y-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="游客与登录权限说明"
    >
      <div
        className="w-full max-w-lg my-auto rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl p-5 sm:p-6 relative animate-[fadeIn_.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
          aria-label="关闭"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-[#FFE8E0] text-[#E05A45] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#292524]">游客与登录，差在哪里</h3>
            <p className="text-[11px] text-[#8C7A6B]">
              记录永远是私密的；登录只决定「能不能跟人互动」和「数据跟不跟你走」。
            </p>
          </div>
        </div>

        {/* 表头：两列身份，高亮当前状态。用 minmax(0,…) 让长文本截断而不是把首列挤成竖排 */}
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 mt-4 mb-1.5 px-1">
          <span className="text-[11px] font-bold text-[#A8988A] tracking-wide">功能</span>
          <span
            className={`text-[11px] font-bold text-center rounded-lg py-1 ${
              isGuest ? 'bg-[#FFF1EC] text-[#B4452F]' : 'text-[#A8988A]'
            }`}
          >
            游客{isGuest ? ' · 当前' : ''}
          </span>
          <span
            className={`text-[11px] font-bold text-center rounded-lg py-1 ${
              !isGuest ? 'bg-emerald-50 text-emerald-700' : 'text-[#A8988A]'
            }`}
          >
            登录{!isGuest ? ' · 当前' : ''}
          </span>
        </div>

        <div className="rounded-2xl border border-[#F1E5D8] overflow-hidden">
          {ACCESS_ROWS.map((row, idx) => (
            <div
              key={row.module}
              className={`grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 items-center px-2.5 py-2 ${
                idx % 2 === 0 ? 'bg-white' : 'bg-[#FFFCF7]'
              }`}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#3F352D] leading-snug break-words">{row.module}</p>
                {row.hint && <p className="text-[10px] text-[#A8988A] leading-snug break-words">{row.hint}</p>}
              </div>
              {[row.guest, row.member].map((cell, i) => (
                <div key={i} className="min-w-0 flex justify-center">
                  <span
                    className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md border text-[10px] font-semibold max-w-full overflow-hidden ${accessStyle(
                      cell.level
                    )}`}
                    title={cell.text}
                  >
                    <LevelIcon level={accessIcon(cell.level)} className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{cell.text}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* 同步机制 */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-3.5 h-3.5 text-[#E05A45]" />
            <h4 className="text-xs font-bold text-[#3F352D]">数据存在哪里、怎么同步</h4>
          </div>
          <div className="space-y-1.5">
            {SYNC_NOTES.map((note, i) => (
              <div key={note.title} className="flex gap-2 rounded-xl bg-[#FFF8F1] border border-[#F3E6D8] px-3 py-2">
                <span className="w-4 h-4 rounded-full bg-[#FFE0D1] text-[#B4452F] text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[11px] text-[#6B5A4D] leading-relaxed">
                  <strong className="text-[#3F352D]">{note.title}：</strong>
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {isGuest && localRecordCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
            <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              本机已保存 <strong>{localRecordCount}</strong> 条记录，登录后会全部并入你的账号。
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {isGuest ? (
            <>
              <button
                onClick={() => {
                  onClose();
                  onLogin();
                }}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] text-white text-sm font-bold shadow-lg shadow-[#FF6B6B]/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                登录 / 注册 <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="sm:w-32 py-2.5 rounded-2xl bg-[#F7EFE7] text-[#574B40] text-sm font-semibold hover:bg-[#F0E5DA] transition-colors cursor-pointer"
              >
                继续游客
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl bg-[#F7EFE7] text-[#574B40] text-sm font-semibold hover:bg-[#F0E5DA] transition-colors cursor-pointer"
            >
              知道了
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
