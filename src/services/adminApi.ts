/**
 * 管理员侧的数据访问：举报 / 反馈的处理队列
 *
 * 权限模型（数据库层，前端只是消费）：
 * - app_admins：只有自己那一行可读，用来判断「我是不是管理员」；
 * - content_reports：普通人只能读自己提交的，管理员可读全部并改 status。
 * 所以这里不做任何前端权限判断的兜底，查不到就是没权限。
 */
import { cloud } from './cloud';

const db = cloud.database as any;

export interface ReportRow {
  id: number | string;
  owner_id: string;
  owner_name: string | null;
  target_type: string;
  target_id: string;
  target_author_id: string | null;
  target_excerpt: string | null;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
}

/** 当前登录用户是否在管理员名单里（RLS 只返回自己那一行） */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const res = await db.from('app_admins').select('user_id').limit(1);
    if (res?.error) return false;
    return Array.isArray(res?.data) && res.data.length > 0;
  } catch {
    return false;
  }
}

/** 拉取待处理队列；status 传 'all' 时不过滤 */
export async function listReports(status: 'open' | 'resolved' | 'dismissed' | 'all' = 'open'): Promise<ReportRow[]> {
  let query = db.from('content_reports').select('*').order('created_at', { ascending: false }).limit(200);
  if (status !== 'all') query = query.eq('status', status);
  const res = await query;
  if (res?.error) throw new Error(res.error.message || '读取举报失败');
  return (res?.data || []) as ReportRow[];
}

/** 标记处理结果。resolved=已处理，dismissed=判定不违规 */
export async function setReportStatus(id: ReportRow['id'], status: 'resolved' | 'dismissed' | 'open'): Promise<void> {
  const res = await db.from('content_reports').update({ status }).eq('id', id);
  if (res?.error) throw new Error(res.error.message || '更新状态失败');
}

/** 各状态计数：给顶部三个筛选标签用 */
export function countByStatus(rows: ReportRow[], status: string): number {
  return rows.filter((r) => r.status === status).length;
}

/** 提交意见 / 数据请求（含账号删除）。落同一条队列，避免多一套后台 */
export async function submitFeedback(kind: string, text: string, ownerName?: string): Promise<void> {
  const res = await db.from('content_reports').insert({
    owner_name: ownerName || null,
    target_type: 'feedback',
    target_id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    target_excerpt: kind.slice(0, 40),
    reason: 'other',
    detail: `[${kind}] ${text}`.slice(0, 500),
  });
  if (res?.error) throw new Error(res.error.message || '提交失败');
}
