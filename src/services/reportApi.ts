/**
 * 举报上报
 *
 * 落库到云端的 content_reports（RLS 只允许本人读自己的举报、只能新增不能改），
 * 这样举报不会石沉大海，也不会被别人看到是谁举报的。
 *
 * 失败策略：网络异常 / 未登录时退回本机队列，并在界面上诚实说明，
 * 不假装「已提交」——举报是用户对平台的信任，不能拿来糊弄。
 */
import { cloud } from './cloud';

const db = cloud.database as any;

export type ReportTargetType = 'thread' | 'reply' | 'message' | 'profile';

export interface ReportInput {
  targetType: ReportTargetType;
  /** 帖子 / 回复 / 消息的 id */
  targetId: string;
  /** 被举报内容的作者，便于后续定位与批量处理 */
  targetAuthorId?: string;
  /** 内容摘要，方便后台不用翻原文就能判断 */
  targetExcerpt?: string;
  reason: string;
  detail?: string;
}

const LOCAL_QUEUE_KEY = 'cici_report_queue_v1';

interface QueuedReport extends ReportInput {
  queuedAt: string;
}

function readQueue(): QueuedReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeQueue(list: QueuedReport[]): void {
  try {
    localStorage.setItem(LOCAL_QUEUE_KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // 隐私模式写不进去时忽略：本次举报已尝试上云，只是没有本地备份
  }
}

/** 待补传的举报数（登录后可以提示用户） */
export function pendingReportCount(): number {
  return readQueue().length;
}

async function pushOne(input: ReportInput, ownerName?: string): Promise<void> {
  const res = await db.from('content_reports').insert({
    owner_name: ownerName || null,
    target_type: input.targetType,
    target_id: String(input.targetId),
    target_author_id: input.targetAuthorId || null,
    target_excerpt: (input.targetExcerpt || '').slice(0, 200) || null,
    reason: input.reason,
    detail: (input.detail || '').trim().slice(0, 500) || null,
  });
  if (res?.error) throw new Error(res.error.message || '举报提交失败');
}

/**
 * 提交举报。
 * 返回 synced=true 表示已上云；false 表示只存在本机（未登录或网络失败）。
 */
export async function submitReport(
  input: ReportInput,
  ownerName?: string
): Promise<{ ok: boolean; synced: boolean; message: string }> {
  try {
    await pushOne(input, ownerName);
    return { ok: true, synced: true, message: '已提交' };
  } catch (err) {
    // 23505 = 同一人对同一目标重复举报，直接当成功处理，不要吓用户
    const text = String((err as Error)?.message || err);
    if (text.includes('23505') || text.includes('duplicate key')) {
      return { ok: true, synced: true, message: '你之前已经举报过这条内容' };
    }
    const queue = readQueue();
    queue.push({ ...input, queuedAt: new Date().toISOString() });
    writeQueue(queue);
    return {
      ok: true,
      synced: false,
      message: '记录已保存在本机，登录后会自动补传',
    };
  }
}

/** 登录 / 网络恢复后补传本机积压的举报 */
export async function flushReports(ownerName?: string): Promise<number> {
  const queue = readQueue();
  if (queue.length === 0) return 0;
  const rest: QueuedReport[] = [];
  let sent = 0;
  for (const item of queue) {
    try {
      await pushOne(item, ownerName);
      sent += 1;
    } catch (err) {
      const text = String((err as Error)?.message || err);
      if (text.includes('23505') || text.includes('duplicate key')) {
        sent += 1;
      } else {
        rest.push(item);
      }
    }
  }
  writeQueue(rest);
  return sent;
}
