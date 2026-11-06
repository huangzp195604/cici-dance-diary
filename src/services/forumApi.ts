/**
 * 论坛云端 API —— 把云数据库的三张表（帖子/回帖/互动）
 * 映射成应用里的 ForumThread 结构。安全由 RLS 保障：
 * 公开可读（未登录也能看帖），写入必须登录且只能操作自己的数据。
 */
import { cloud, CloudUser } from './cloud';
import { ForumThread, ForumReply, ForumMeetup } from '../types';

const AVATAR_STYLES = [
  'bg-orange-100 text-orange-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
];

function avatarFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

/** ISO 时间 → 中文相对时间 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

interface ThreadRow {
  id: number;
  owner_id: string;
  owner_name: string | null;
  title: string;
  content: string | null;
  category: string;
  avatar_bg: string | null;
  is_pinned: boolean | null;
  tags: string[] | null;
  meetup: Partial<ForumMeetup> | null;
  views: number | null;
  created_at: string;
}

interface ReplyRow {
  id: number;
  thread_id: number;
  owner_id: string;
  owner_name: string | null;
  content: string;
  created_at: string;
}

interface InteractionRow {
  id: number;
  thread_id: number;
  kind: 'like' | 'join';
  owner_id: string;
  owner_name: string | null;
  created_at: string;
}

function errText(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (e?.code === '42P01') return '数据表尚未创建，请稍后再试';
  if (e?.code === '42501') return '没有权限执行该操作（可能未登录）';
  return e?.message || '云端请求失败，请检查网络后重试';
}

/**
 * SDK 未提供 schema 泛型时，insert/update 的参数类型会被推导为 never。
 * 按官方文档，无泛型的行本就是不具类型的——这里统一走动态调用，
 * 行结构由上面三个 Row 接口自行约束。
 */
const db = cloud.database as any;

/** 拉取整个论坛（帖子+回帖+互动），一次组装成 UI 需要的结构 */
export async function fetchForum(currentUser: CloudUser | null): Promise<ForumThread[]> {
  const [threadsRes, repliesRes, interactionsRes] = await Promise.all([
    db
      .from('forum_threads')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('forum_replies').select('*').order('created_at', { ascending: true }).limit(500),
    db.from('forum_interactions').select('*').limit(1000),
  ]);

  if (threadsRes.error) throw new Error(errText(threadsRes.error));
  if (repliesRes.error) throw new Error(errText(repliesRes.error));
  if (interactionsRes.error) throw new Error(errText(interactionsRes.error));

  const threads = (threadsRes.data || []) as unknown as ThreadRow[];
  const replies = (repliesRes.data || []) as unknown as ReplyRow[];
  const interactions = (interactionsRes.data || []) as unknown as InteractionRow[];

  const repliesByThread = new Map<number, ReplyRow[]>();
  replies.forEach((r) => {
    const list = repliesByThread.get(r.thread_id) || [];
    list.push(r);
    repliesByThread.set(r.thread_id, list);
  });

  return threads.map((t) => {
    const author = t.owner_name || '舞友';
    const likes = interactions.filter((i) => i.thread_id === t.id && i.kind === 'like');
    const joins = interactions.filter((i) => i.thread_id === t.id && i.kind === 'join');
    const isLiked = !!currentUser && likes.some((i) => i.owner_id === currentUser.id);
    const isJoined = !!currentUser && joins.some((i) => i.owner_id === currentUser.id);

    const meetup: ForumMeetup | undefined =
      t.meetup && t.meetup.studio
        ? {
            studio: t.meetup.studio,
            date: t.meetup.date || '',
            targetCount: t.meetup.targetCount || 4,
            costNote: t.meetup.costNote,
            joinedBuddies: joins.map((j) => j.owner_name || '舞友'),
            isJoined,
          }
        : undefined;

    const threadReplies: ForumReply[] = (repliesByThread.get(t.id) || []).map((r) => ({
      id: String(r.id),
      author: r.owner_name || '舞友',
      avatarBg: avatarFor(r.owner_name || '舞友'),
      content: r.content,
      createdAt: timeAgo(r.created_at),
      likes: 0,
      isOwner: !!currentUser && r.owner_id === currentUser.id,
    }));

    return {
      id: String(t.id),
      title: t.title,
      content: t.content || '',
      category: (t.category as ForumThread['category']) || '舞友随笔',
      author,
      avatarBg: t.avatar_bg || avatarFor(author),
      createdAt: timeAgo(t.created_at),
      likes: likes.length,
      isLiked,
      views: t.views || 0,
      replies: threadReplies,
      meetup,
      isPinned: !!t.is_pinned,
      tags: Array.isArray(t.tags) ? t.tags : [],
    };
  });
}

/** 发帖（必须登录）。返回云端生成的帖子 id */
export async function createThread(
  thread: Omit<ForumThread, 'id' | 'createdAt' | 'likes' | 'views' | 'replies' | 'isLiked'> & { replies?: ForumReply[] },
  user: CloudUser
): Promise<string> {
  const res = await db
    .from('forum_threads')
    .insert({
      title: thread.title,
      content: thread.content,
      category: thread.category,
      avatar_bg: thread.avatarBg,
      is_pinned: thread.isPinned || false,
      tags: thread.tags || [],
      meetup: thread.meetup ? { ...thread.meetup } : null,
      owner_name: user.name,
    })
    .select();
  if (res.error) throw new Error(errText(res.error));
  const row = (res.data?.[0] || { id: '0' }) as unknown as { id: number };
  return String(row.id);
}

/** 编辑帖子（仅作者本人，RLS 兜底） */
export async function updateThread(thread: ForumThread): Promise<void> {
  const res = await db
    .from('forum_threads')
    .update({
      title: thread.title,
      content: thread.content,
      category: thread.category,
      is_pinned: thread.isPinned || false,
      tags: thread.tags || [],
      meetup: thread.meetup ? { ...thread.meetup } : null,
    })
    .eq('id', Number(thread.id))
    .select();
  if (res.error) throw new Error(errText(res.error));
  if (!res.data || res.data.length === 0) {
    throw new Error('帖子不存在或不是你发布的，无法修改');
  }
}

/** 删帖（仅作者本人） */
export async function deleteThread(threadId: string): Promise<void> {
  const id = Number(threadId);
  const res = await db.from('forum_threads').delete().eq('id', id).select();
  if (res.error) throw new Error(errText(res.error));
  if (!res.data || res.data.length === 0) {
    throw new Error('帖子不存在或不是你发布的，无法删除');
  }
}

/** 点赞 / 取消点赞（每人每帖唯一，未登录会失败并要求登录） */
export async function toggleLike(threadId: string, user: CloudUser): Promise<void> {
  const id = Number(threadId);
  const existing = await db
    .from('forum_interactions')
    .select('id')
    .eq('thread_id', id)
    .eq('kind', 'like')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (existing.error) throw new Error(errText(existing.error));

  if (existing.data) {
    const del = await db
      .from('forum_interactions')
      .delete()
      .eq('id', (existing.data as { id: number }).id)
      .select();
    if (del.error) throw new Error(errText(del.error));
  } else {
    const ins = await db
      .from('forum_interactions')
      .insert({ thread_id: id, kind: 'like', owner_name: user.name })
      .select();
    if (ins.error) {
      // 并发点击重复插入 → 23505 唯一约束，视为成功
      if ((ins.error as { code?: string }).code !== '23505') throw new Error(errText(ins.error));
    }
  }
}

/** 回帖 */
export async function addReply(threadId: string, content: string, user: CloudUser): Promise<void> {
  const res = await db
    .from('forum_replies')
    .insert({ thread_id: Number(threadId), content, owner_name: user.name })
    .select();
  if (res.error) throw new Error(errText(res.error));
}

/** 约练报名 / 取消报名 */
export async function toggleJoin(threadId: string, user: CloudUser): Promise<void> {
  const id = Number(threadId);
  const existing = await db
    .from('forum_interactions')
    .select('id')
    .eq('thread_id', id)
    .eq('kind', 'join')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (existing.error) throw new Error(errText(existing.error));

  if (existing.data) {
    const del = await db
      .from('forum_interactions')
      .delete()
      .eq('id', (existing.data as { id: number }).id)
      .select();
    if (del.error) throw new Error(errText(del.error));
  } else {
    const ins = await db
      .from('forum_interactions')
      .insert({ thread_id: id, kind: 'join', owner_name: user.name })
      .select();
    if (ins.error) {
      if ((ins.error as { code?: string }).code !== '23505') throw new Error(errText(ins.error));
    }
  }
}
