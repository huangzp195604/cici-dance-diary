/**
 * 好友关系与私信的云端访问层。
 *
 * 隐私边界由数据库 RLS 保证，前端不做任何「权限判断」：
 * - friendships：只有申请双方能读，只有被申请人能同意/拒绝；
 * - direct_messages：只有收发双方能读，且 INSERT 策略要求两人已是 accepted 好友。
 *
 * 因此这里即使把 peerId 换成任意账号，写不进去也读不到别人的记录。
 * 一对用户之间只保留一条关系（数据库唯一索引），反向申请会复用同一行。
 */
import { cloud, CloudUser } from './cloud';
import { fetchProfiles } from './userDataApi';
import type {
  Conversation,
  DirectMessage,
  Friendship,
  SocialData,
  SocialPeer,
} from '../types';

const db = cloud.database as any;

function errText(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (e?.code === '42P01') return '数据表尚未创建，请稍后再试';
  if (e?.code === '42501') return '没有权限（可能未登录，或对方还不是你的好友）';
  if (e?.code === '23505') return '你们之间已经有申请记录了';
  return e?.message || '云端请求失败，请检查网络后重试';
}

interface FriendRow {
  id: number;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  note: string | null;
  created_at: string;
}

interface MessageRow {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

/** 拉取好友关系 + 私信，并批量补齐对方昵称，一次组装成页面需要的结构 */
export async function fetchSocial(user: CloudUser): Promise<SocialData> {
  const [friendsRes, messagesRes] = await Promise.all([
    db.from('friendships').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('direct_messages').select('*').order('created_at', { ascending: false }).limit(500),
  ]);
  if (friendsRes.error) throw new Error(errText(friendsRes.error));
  if (messagesRes.error) throw new Error(errText(messagesRes.error));

  const friendRows = (friendsRes.data || []) as unknown as FriendRow[];
  const messageRows = (messagesRes.data || []) as unknown as MessageRow[];

  const messagesDesc: DirectMessage[] = messageRows.map((r) => ({
    id: String(r.id),
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    content: r.content,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));

  const peerIds = Array.from(
    new Set([
      ...friendRows.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)),
      ...messagesDesc.map((m) => (m.senderId === user.id ? m.recipientId : m.senderId)),
    ])
  ).filter(Boolean);

  const profileRows = await fetchProfiles(peerIds);
  const profiles = new Map<string, SocialPeer>();
  peerIds.forEach((id) => {
    const p = profileRows.get(id);
    profiles.set(id, {
      id,
      nickname: p?.nickname || '舞友',
      gender: p?.gender ?? null,
      age: p?.age ?? null,
    });
  });
  const peerOf = (id: string): SocialPeer =>
    profiles.get(id) || { id, nickname: '舞友', gender: null, age: null };

  const friendships: Friendship[] = friendRows.map((f) => {
    const outgoing = f.requester_id === user.id;
    const peerId = outgoing ? f.addressee_id : f.requester_id;
    return {
      id: String(f.id),
      requesterId: f.requester_id,
      addresseeId: f.addressee_id,
      status: f.status,
      note: f.note,
      createdAt: f.created_at,
      direction: outgoing ? 'outgoing' : 'incoming',
      peer: peerOf(peerId),
    };
  });

  // messagesDesc 是倒序，第一条即最新一条，用于会话列表摘要
  const convMap = new Map<string, Conversation>();
  messagesDesc.forEach((m) => {
    const peerId = m.senderId === user.id ? m.recipientId : m.senderId;
    let conv = convMap.get(peerId);
    if (!conv) {
      conv = {
        peerId,
        peer: peerOf(peerId),
        lastContent: m.content,
        lastAt: m.createdAt,
        lastFromMe: m.senderId === user.id,
        unread: 0,
      };
      convMap.set(peerId, conv);
    }
    if (m.recipientId === user.id && !m.readAt) conv.unread += 1;
  });
  const conversations = Array.from(convMap.values());
  conversations.forEach((c) => {
    const accepted = friendships.find(
      (f) => f.status === 'accepted' && f.peer.id === c.peerId
    );
    if (accepted) c.peer = accepted.peer;
  });

  return {
    friendships,
    // 聊天窗口按时间正序展示
    messages: messagesDesc.slice().reverse(),
    conversations,
    profiles,
  };
}

/** 找当前用户与某人之间的关系（不存在返回 undefined） */
export function relationWith(social: SocialData | null, peerId: string): Friendship | undefined {
  if (!social || !peerId) return undefined;
  return social.friendships.find((f) => f.peer.id === peerId);
}

export function isFriend(social: SocialData | null, peerId: string): boolean {
  return relationWith(social, peerId)?.status === 'accepted';
}

/** 当前用户与 peerId 之间是否已有任意关系行（含待处理、已拒绝） */
async function findPair(peerId: string, user: CloudUser): Promise<FriendRow | undefined> {
  const res = await db.from('friendships').select('*').limit(200);
  if (res.error) throw new Error(errText(res.error));
  const rows = (res.data || []) as unknown as FriendRow[];
  return rows.find(
    (f) =>
      (f.requester_id === user.id && f.addressee_id === peerId) ||
      (f.requester_id === peerId && f.addressee_id === user.id)
  );
}

/**
 * 加好友：无关系则发申请；对方已向我申请则直接互相成为好友；
 * 之前被拒绝过则清理旧行重新申请（唯一索引保证一对用户只有一条关系）。
 */
export async function sendFriendRequest(
  peerId: string,
  note: string,
  user: CloudUser
): Promise<'sent' | 'accepted'> {
  if (!peerId) throw new Error('找不到这位舞友的账号');
  if (peerId === user.id) throw new Error('不能加自己为好友');

  const existing = await findPair(peerId, user);
  if (existing) {
    if (existing.status === 'accepted') throw new Error('你们已经是好友了');
    if (existing.status === 'pending') {
      if (existing.requester_id === peerId) {
        const upd = await db
          .from('friendships')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select();
        if (upd.error) throw new Error(errText(upd.error));
        return 'accepted';
      }
      throw new Error('申请已发出，等对方同意就好');
    }
    // declined：删掉旧行再重新申请
    const del = await db.from('friendships').delete().eq('id', existing.id).select();
    if (del.error) throw new Error(errText(del.error));
  }

  const ins = await db
    .from('friendships')
    .insert({ addressee_id: peerId, note: note.trim() || null })
    .select();
  if (ins.error) throw new Error(errText(ins.error));
  return 'sent';
}

/** 同意 / 拒绝好友申请（只有被申请人能操作，RLS 兜底） */
export async function respondFriendRequest(
  relationId: string,
  accept: boolean,
  user: CloudUser
): Promise<void> {
  const res = await db
    .from('friendships')
    .update({
      status: accept ? 'accepted' : 'declined',
      updated_at: new Date().toISOString(),
    })
    .eq('id', Number(relationId))
    .select();
  if (res.error) throw new Error(errText(res.error));
  if (!res.data || res.data.length === 0) {
    throw new Error('这条申请已不存在，请刷新后重试');
  }
  void user;
}

/** 删除好友 / 撤回申请（双方都可删） */
export async function removeFriendship(relationId: string): Promise<void> {
  const res = await db
    .from('friendships')
    .delete()
    .eq('id', Number(relationId))
    .select();
  if (res.error) throw new Error(errText(res.error));
}

/** 发私信：非好友会被数据库 INSERT 策略拒绝 */
export async function sendDirectMessage(
  peerId: string,
  content: string,
  user: CloudUser
): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error('消息不能为空');
  if (text.length > 1000) throw new Error('消息最多 1000 字');
  if (!peerId || peerId === user.id) throw new Error('不能给自己发私信');
  const res = await db
    .from('direct_messages')
    .insert({ recipient_id: peerId, content: text })
    .select();
  if (res.error) throw new Error(errText(res.error));
}

/** 把某会话中对方发来的消息标记为已读 */
export async function markConversationRead(
  peerId: string,
  user: CloudUser
): Promise<void> {
  const res = await db
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', user.id)
    .eq('sender_id', peerId)
    .select();
  if (res.error) throw new Error(errText(res.error));
}
