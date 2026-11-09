/**
 * AdminReports —— 举报与反馈的处理队列
 *
 * 为什么要它：举报弹窗里承诺「24 小时内核实」，但之前数据只躺在 content_reports
 * 表里，没有任何查看入口，承诺无法兑现。这个面板就是兑现承诺的工具：
 * 打开就能看到待处理列表，处理完点一下标记，不用再手写 SQL。
 *
 * 入口只在「当前账号在 app_admins 名单里」时出现（权限由数据库 RLS 保证）。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { X, RefreshCw, CheckCircle2, ShieldOff, Flag, Inbox, AlertCircle, MessageSquare } from 'lucide-react';
import { REPORT_REASONS } from '../utils/community';
import { checkIsAdmin, listReports, setReportStatus, type ReportRow } from '../services/adminApi';

const TARGET_LABEL: Record<string, string> = {
  thread: '帖子',
  reply: '回复',
  message: '私信',
  profile: '个人资料',
  feedback: '意见 / 请求',
};

const STATUS_LABEL: Record<string, string> = {
  open: '待处理',
  resolved: '已处理',
  dismissed: '不违规',
};

type Filter = 'open' | 'resolved' | 'all';

interface AdminReportsProps {
  open: boolean;
  onClose: () => void;
}

export const AdminReports: React.FC<AdminReportsProps> = ({ open, onClose }) => {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async (status: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const admin = await checkIsAdmin();
      if (!admin) {
        setDenied(true);
        setRows([]);
        return;
      }
      setDenied(false);
      const list = await listReports(status === 'all' ? 'all' : status);
      setRows(list);
    } catch (err) {
      setError(String((err as Error)?.message || err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load(filter);
  }, [open, filter, load]);

  if (!open) return null;

  const handleStatus = async (row: ReportRow, status: 'resolved' | 'dismissed') => {
    setBusyId(String(row.id));
    try {
      await setReportStatus(row.id, status);
      setRows((prev) => prev.map((r) => (String(r.id) === String(row.id) ? { ...r, status } : r)));
    } catch (err) {
      setError(String((err as Error)?.message || err));
    } finally {
      setBusyId(null);
    }
  };

  const reasonLabel = (key: string) => REPORT_REASONS.find((r) => r.key === key)?.label || key;

  return (
    <div
      className="fixed inset-0 z-[67] flex items-start sm:items-center justify-center p-4 py-6 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="举报与反馈处理"
    >
      <div
        className="w-full max-w-2xl max-h-[86vh] flex flex-col rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl relative animate-[fadeIn_.2s_ease-out]"
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
            <div className="w-9 h-9 rounded-2xl bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-extrabold text-base text-[#292524] leading-tight">举报与反馈</h3>
              <p className="text-[10.5px] text-[#A8988A] mt-0.5">
                承诺 24 小时内核实 · 处理完在这里点一下标记
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5">
            {(
              [
                { key: 'open', label: '待处理' },
                { key: 'resolved', label: '已处理' },
                { key: 'all', label: '全部' },
              ] as Array<{ key: Filter; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
                  filter === t.key ? 'bg-[#292524] text-white' : 'bg-[#F7EFE7] text-[#8C7A6B] hover:text-[#574B40]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load(filter)}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-bold text-[#6B5A4D] hover:bg-[#F7EFE7] cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4">
          {denied && (
            <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[11.5px] text-[#991B1B]">
              当前账号没有处理权限。只有管理员名单里的账号能看到这个队列。
            </div>
          )}

          {error && (
            <div className="flex items-start gap-1.5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 mb-3">
              <AlertCircle className="w-3.5 h-3.5 text-[#B91C1C] shrink-0 mt-0.5" />
              <span className="text-[11.5px] text-[#991B1B] leading-relaxed">{error}</span>
            </div>
          )}

          {!denied && !loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-[#A8988A]">
              <Inbox className="w-8 h-8 mb-2" />
              <p className="text-[12px]">这个筛选下没有记录</p>
            </div>
          )}

          <div className="space-y-2.5">
            {rows.map((row) => {
              const isFeedback = row.target_type === 'feedback';
              return (
                <article key={String(row.id)} className="rounded-2xl border border-[#F1E5D8] bg-white p-3.5">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        isFeedback ? 'bg-[#EDE9FE] text-[#5B21B6]' : 'bg-[#FFE4D6] text-[#B4452F]'
                      }`}
                    >
                      {TARGET_LABEL[row.target_type] || row.target_type}
                    </span>
                    <span className="text-[11.5px] font-bold text-[#292524] min-w-0 flex-1">
                      {isFeedback ? row.target_excerpt || '意见 / 数据请求' : reasonLabel(row.reason)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        row.status === 'open'
                          ? 'bg-[#FEF3C7] text-[#92400E]'
                          : row.status === 'resolved'
                            ? 'bg-[#DCFCE7] text-[#166534]'
                            : 'bg-[#F1EFE8] text-[#5F5E5A]'
                      }`}
                    >
                      {STATUS_LABEL[row.status] || row.status}
                    </span>
                  </div>

                  {row.detail && (
                    <p className="mt-2 text-[11.5px] text-[#574B40] leading-relaxed whitespace-pre-wrap break-words">
                      {row.detail}
                    </p>
                  )}

                  {row.target_excerpt && !isFeedback && (
                    <p className="mt-1.5 text-[11px] text-[#8C7A6B] leading-relaxed bg-[#FAF8F4] rounded-lg px-2 py-1.5 break-words">
                      原文摘要：{row.target_excerpt}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2 flex-wrap text-[10.5px] text-[#A8988A]">
                    <span className="break-all">目标 {row.target_id}</span>
                    <span>·</span>
                    <span>{row.owner_name || row.owner_id}</span>
                    <span>·</span>
                    <span>{new Date(row.created_at).toLocaleString('zh-CN', { hour12: false })}</span>
                    {row.target_author_id && (
                      <>
                        <span>·</span>
                        <span className="break-all">作者 {row.target_author_id}</span>
                      </>
                    )}
                  </div>

                  {row.status === 'open' && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === String(row.id)}
                        onClick={() => void handleStatus(row, 'resolved')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#166534] hover:bg-[#14532D] disabled:opacity-50 text-white text-[11px] font-bold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        已处理
                      </button>
                      <button
                        type="button"
                        disabled={busyId === String(row.id)}
                        onClick={() => void handleStatus(row, 'dismissed')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F1EFE8] hover:bg-[#E7E4DA] disabled:opacity-50 text-[#5F5E5A] text-[11px] font-bold cursor-pointer"
                      >
                        <ShieldOff className="w-3 h-3" />
                        判定不违规
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <p className="mt-4 flex items-start gap-1.5 text-[10.5px] text-[#A8988A] leading-relaxed">
            <MessageSquare className="w-3 h-3 shrink-0 mt-0.5" />
            删内容请到对应帖子上操作；这里只记录「这条举报处理完了」，方便核对 24 小时承诺。
          </p>
        </div>
      </div>
    </div>
  );
};
