import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Loader2,
  LogIn,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck2,
  UserPlus,
  X,
} from 'lucide-react';
import type { ForumThread, SocialData, SocialPeer } from '../types';
import { formatDateTime, timeAgo } from '../services/forumApi';
import { isFriend, relationWith } from '../services/socialApi';

/** 页面把云端操作传进来的统一回调集合；所有函数都要能抛出可读的中文错误 */
export interface SocialActions {
  onAddFriend: (peerId: string, note: string) => Promise<void>;
  onRespond: (relationId: string, accept: boolean) => Promise<void>;
  onRemoveFriend: (relationId: string) => Promise<void>;
  onSendMessage: (peerId: string, content: string) => Promise<void>;
  onMarkRead: (peerId: string) => void;
  onOpenChat: (peerId: string) => void;
  onRefresh: () => void;
  onLogin: () => void;
}

export interface SocialViewProps {
  social: SocialData | null;
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  currentUserId?: string;
  activeChatPeerId: string | null;
  onSelectChat: (peerId: string | null) => void;
  actions: SocialActions;
}

const CARD = 'bg-white border border-[#EFE3D5] rounded-3xl shadow-2xs';
const BTN_PRIMARY =
  'px-3.5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5';
const BTN_GHOST =
  'px-3 py-2 bg-white border border-[#E7DED2] hover:bg-[#FAF7FF] text-[#6D28D9] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5';

function bgFor(name: string): string {
  const styles = [
    'bg-orange-100 text-orange-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700',
    'bg-sky-100 text-sky-700',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return styles[hash % styles.length];
}

export function PeerAvatar({
  name,
  bg,
  size = 'md',
}: {
  name: string;
  bg?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls =
    size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';
  return (
    <div
      className={`${cls} rounded-full ${bg || bgFor(name)} font-display font-bold flex items-center justify-center shrink-0 border border-black/5`}
    >
      {name.slice(0, 1) || '舞'}
    </div>
  );
}

function peerMeta(peer?: SocialPeer | null): string {
  if (!peer) return '';
  return [peer.gender, peer.age ? `${peer.age}岁` : ''].filter(Boolean).join(' · ');
}

function LoginHint({ actions, title, text }: { actions: SocialActions; title: string; text: string }) {
  return (
    <div className={`${CARD} p-6 text-center`}>
      <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F3EEFF] text-[#7C3AED] flex items-center justify-center mb-3">
        <ShieldCheck className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-[#292524]">{title}</h3>
      <p className="text-xs text-[#8C7A6B] mt-1 max-w-sm mx-auto leading-relaxed">{text}</p>
      <button onClick={actions.onLogin} className={`${BTN_PRIMARY} mx-auto mt-4`}>
        <LogIn className="w-3.5 h-3.5" />
        登录 / 注册
      </button>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl border border-[#FFD5C8] bg-[#FFF1EC] px-4 py-2.5 text-xs text-[#D94834]">
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 线上好友 + 好友申请                                                  */
/* ------------------------------------------------------------------ */
export const OnlineFriendsSection: React.FC<SocialViewProps> = ({
  social,
  loading,
  error,
  isLoggedIn,
  actions,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyId(key);
    setLocalError('');
    try {
      await fn();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginHint
        actions={actions}
        title="登录后认识论坛里的舞友"
        text="在论坛帖子里点任意一位舞友的头像，就能发好友申请；对方同意后即可互发私信。"
      />
    );
  }

  const friendships = social?.friendships || [];
  const accepted = friendships.filter((f) => f.status === 'accepted');
  const incoming = friendships.filter((f) => f.status === 'pending' && f.direction === 'incoming');
  const outgoing = friendships.filter((f) => f.status === 'pending' && f.direction === 'outgoing');

  return (
    <div className="space-y-4">
      <ErrorLine text={localError} />
      {error && (
        <div className={`${CARD} p-4 flex items-center justify-between gap-3`}>
          <span className="text-xs text-[#D94834]">好友数据加载失败：{error}</span>
          <button onClick={actions.onRefresh} className={BTN_GHOST}>
            <RefreshCw className="w-3.5 h-3.5" /> 重试
          </button>
        </div>
      )}

      {incoming.length > 0 && (
        <section className={`${CARD} p-5`}>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-[#7C3AED]" />
            <h3 className="text-sm font-bold text-[#292524]">待处理的好友申请 ({incoming.length})</h3>
          </div>
          <div className="space-y-2.5">
            {incoming.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#EFE3D5] bg-[#FFFCF8] p-3"
              >
                <PeerAvatar name={f.peer.nickname} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#292524] truncate">
                    {f.peer.nickname} 想加你为好友
                  </p>
                  {f.note && <p className="text-[11px] text-[#78695C] mt-0.5 break-words">附言：{f.note}</p>}
                  <p className="text-[10px] text-[#B0A090] mt-0.5">{timeAgo(f.createdAt)} · 同意后才能互发私信</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={busyId !== null}
                    onClick={() => run(`yes-${f.id}`, () => actions.onRespond(f.id, true))}
                    className={BTN_PRIMARY}
                  >
                    {busyId === `yes-${f.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    同意
                  </button>
                  <button
                    disabled={busyId !== null}
                    onClick={() => run(`no-${f.id}`, () => actions.onRespond(f.id, false))}
                    className={BTN_GHOST}
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <div className="rounded-2xl border border-[#DDD0FA] bg-[#F6F3FF] px-4 py-3 text-xs text-[#6D28D9]">
          已发出 {outgoing.length} 条好友申请，等对方同意后就能开始私信。
        </div>
      )}

      <section className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck2 className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="text-base font-bold text-[#292524]">线上好友</h3>
              <span className="text-xs bg-[#F3EEFF] text-[#6D28D9] px-2 py-0.5 rounded-full font-bold">
                {accepted.length} 位
              </span>
            </div>
            <p className="text-xs text-[#78695C] mt-1">
              在论坛点头像认识、且对方已同意的舞友。互为好友后才能一对一私信。
            </p>
          </div>
          <button onClick={actions.onRefresh} className={BTN_GHOST} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            刷新
          </button>
        </div>

        {accepted.length === 0 ? (
          <div className="mt-4 py-8 px-4 text-center border border-dashed border-[#E8DACB] rounded-2xl">
            <MessageCircle className="w-6 h-6 mx-auto text-[#C4B5A4]" />
            <p className="text-xs font-bold text-[#292524] mt-2">还没有线上好友</p>
            <p className="text-[11px] text-[#8C7A6B] mt-1">回到「舞友论坛」，点一位舞友的头像发个好友申请吧。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {accepted.map((f) => (
              <div key={f.id} className="rounded-2xl border border-[#EFE3D5] p-3.5 flex items-center gap-3">
                <PeerAvatar name={f.peer.nickname} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#292524] truncate">{f.peer.nickname}</p>
                  <p className="text-[10px] text-[#8C7A6B] truncate">
                    {peerMeta(f.peer) || '论坛舞友'} · 互为好友
                  </p>
                </div>
                <button
                  onClick={() => actions.onOpenChat(f.peer.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#7C3AED] text-white text-[11px] font-bold hover:bg-[#6D28D9] cursor-pointer"
                >
                  发私信
                </button>
                <button
                  title="删除好友"
                  aria-label={`删除好友 ${f.peer.nickname}`}
                  disabled={busyId !== null}
                  onClick={() => {
                    if (!window.confirm(`确定删除好友「${f.peer.nickname}」吗？删除后需要重新申请才能私信。`)) return;
                    run(`del-${f.id}`, () => actions.onRemoveFriend(f.id));
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A8988A] hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 私信会话                                                            */
/* ------------------------------------------------------------------ */
export const MessagesView: React.FC<SocialViewProps> = ({
  social,
  loading,
  error,
  isLoggedIn,
  currentUserId,
  activeChatPeerId,
  onSelectChat,
  actions,
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [localError, setLocalError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversations = social?.conversations || [];
  const activePeer = activeChatPeerId ? social?.profiles.get(activeChatPeerId) : null;
  const messages = useMemo(() => {
    if (!activeChatPeerId) return [];
    return (social?.messages || []).filter(
      (m) =>
        (m.senderId === currentUserId && m.recipientId === activeChatPeerId) ||
        (m.senderId === activeChatPeerId && m.recipientId === currentUserId)
    );
  }, [social, currentUserId, activeChatPeerId]);
  const canSend = activeChatPeerId ? isFriend(social, activeChatPeerId) : false;
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread, 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeChatPeerId]);

  useEffect(() => {
    if (activeChatPeerId) actions.onMarkRead(activeChatPeerId);
    // 只在切换会话或收到新消息时标记已读，避免刷新循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatPeerId, messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeChatPeerId || !canSend || sending) return;
    setSending(true);
    setLocalError('');
    try {
      await actions.onSendMessage(activeChatPeerId, text);
      setDraft('');
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginHint
        actions={actions}
        title="登录后查看私信"
        text="私信只在互为好友的双方之间可见，别人读不到你们的聊天内容。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className={`${CARD} p-5 flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="text-base font-bold text-[#292524]">私信</h3>
            {unreadTotal > 0 && (
              <span className="text-[11px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                {unreadTotal} 条未读
              </span>
            )}
          </div>
          <p className="text-xs text-[#78695C] mt-1">只有互为好友的舞友可以互发消息，聊天内容仅双方可见。</p>
        </div>
        <button onClick={actions.onRefresh} className={BTN_GHOST} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          刷新
        </button>
      </div>

      <ErrorLine text={localError || error} />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className={`${activeChatPeerId ? 'hidden sm:block' : 'block'} sm:w-72 shrink-0 ${CARD} p-3`}>
          <h4 className="text-xs font-bold text-[#8C7A6B] px-2 pb-2">会话 ({conversations.length})</h4>
          {conversations.length === 0 ? (
            <div className="py-10 px-3 text-center">
              <MessageCircle className="w-6 h-6 mx-auto text-[#C4B5A4]" />
              <p className="text-xs font-bold text-[#292524] mt-2">还没有会话</p>
              <p className="text-[11px] text-[#8C7A6B] mt-1 leading-relaxed">
                在「舞友」页点好友的「发私信」，或在论坛点头像开始。
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.peerId}
                  onClick={() => onSelectChat(c.peerId)}
                  className={`w-full text-left p-2.5 rounded-2xl transition-all cursor-pointer ${
                    activeChatPeerId === c.peerId ? 'bg-[#F3EEFF]' : 'hover:bg-[#FAF7FF]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PeerAvatar name={c.peer.nickname} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-[#292524]">{c.peer.nickname}</span>
                        <span className="text-[10px] text-[#B0A090] shrink-0">{timeAgo(c.lastAt)}</span>
                      </div>
                      <p className="truncate text-[11px] text-[#8C7A6B]">
                        {c.lastFromMe ? '我：' : ''}
                        {c.lastContent}
                      </p>
                    </div>
                    {c.unread > 0 && (
                      <span className="w-5 h-5 shrink-0 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className={`${activeChatPeerId ? 'flex' : 'hidden sm:flex'} flex-1 min-w-0 ${CARD} p-4 flex-col min-h-[420px]`}
        >
          {!activeChatPeerId ? (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-[#8C7A6B]">
              选一个会话开始聊天
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-3 border-b border-[#F1E5D8]">
                <button
                  onClick={() => onSelectChat(null)}
                  className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F3EEFF] cursor-pointer"
                  aria-label="返回会话列表"
                >
                  <ArrowLeft className="w-4 h-4 text-[#6D28D9]" />
                </button>
                <PeerAvatar name={activePeer?.nickname || '舞友'} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#292524] truncate">{activePeer?.nickname || '舞友'}</p>
                  <p className="text-[10px] text-[#8C7A6B]">
                    {canSend ? '互为好友 · 仅你们两人可见' : '已不是好友，无法继续发送'}
                  </p>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>

              <div className="flex-1 overflow-y-auto max-h-[360px] min-h-[240px] py-3 space-y-2.5">
                {messages.length === 0 ? (
                  <p className="text-center text-[11px] text-[#B0A090] pt-10">打个招呼，约一次练舞吧～</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === currentUserId;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                            mine ? 'bg-[#7C3AED] text-white' : 'bg-[#F5F1EA] text-[#292524]'
                          }`}
                        >
                          <p className="text-xs whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-[#A8988A]'}`}>
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="pt-3 border-t border-[#F1E5D8]">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    disabled={!canSend}
                    rows={2}
                    maxLength={1000}
                    placeholder={canSend ? '输入消息，Enter 发送 / Shift+Enter 换行' : '互为好友后才能发送私信'}
                    className="flex-1 resize-none rounded-xl border border-[#E7DED2] px-3 py-2 text-xs text-[#292524] focus:outline-none focus:ring-2 focus:ring-[#DDD0FA] disabled:bg-[#FAF7F4]"
                  />
                  <button onClick={() => void send()} disabled={!canSend || sending || !draft.trim()} className={BTN_PRIMARY}>
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    发送
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* 论坛点头像弹出的用户资料卡                                          */
/* ------------------------------------------------------------------ */
export interface UserCardModalProps {
  target: { id: string; name: string; avatarBg: string } | null;
  threads: ForumThread[];
  social: SocialData | null;
  currentUserId?: string;
  isLoggedIn: boolean;
  actions: SocialActions;
  onClose: () => void;
}

export const UserCardModal: React.FC<UserCardModalProps> = ({
  target,
  threads,
  social,
  currentUserId,
  isLoggedIn,
  actions,
  onClose,
}) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setNote('');
    setLocalError('');
  }, [target?.id]);

  if (!target) return null;

  const peer = social?.profiles.get(target.id) || null;
  const displayName = peer?.nickname || target.name;
  const relation = relationWith(social, target.id);
  const isSelf = target.id === currentUserId;
  const ownThreads = threads.filter((t) => t.authorId === target.id);
  const meetups = ownThreads.filter((t) => t.meetup).length;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setLocalError('');
    try {
      await fn();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-[#EADCCE] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <span className="text-[11px] font-bold text-[#7C3AED] bg-[#F3EEFF] px-2.5 py-1 rounded-full">舞友资料卡</span>
          <button onClick={onClose} aria-label="关闭" className="w-8 h-8 rounded-lg hover:bg-[#F5F1EA] flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-[#8C7A6B]" />
          </button>
        </div>

        <div className="flex flex-col items-center text-center mt-3">
          <PeerAvatar name={displayName} bg={target.avatarBg} size="lg" />
          <h3 className="text-base font-bold text-[#292524] mt-3">{displayName}</h3>
          <p className="text-[11px] text-[#8C7A6B] mt-0.5">
            {peerMeta(peer) || '论坛舞友'}
            {isSelf && ' · 这是你自己'}
          </p>
          <div className="flex items-center gap-3 mt-3 text-[11px] text-[#78695C]">
            <span>发帖 <strong className="text-[#292524]">{ownThreads.length}</strong></span>
            <span className="w-px h-3 bg-[#E7DED2]" />
            <span>组织约练 <strong className="text-[#292524]">{meetups}</strong></span>
            {meetups >= 3 && (
              <span className="inline-flex items-center gap-0.5 text-[#4338CA] font-bold">
                <BadgeCheck className="w-3 h-3" /> 资深组织者
              </span>
            )}
          </div>
        </div>

        <ErrorLine text={localError} />

        <div className="mt-5 space-y-2.5">
          {!isLoggedIn ? (
            <button onClick={actions.onLogin} className={`${BTN_PRIMARY} w-full`}>
              <LogIn className="w-4 h-4" /> 登录后加好友 / 发私信
            </button>
          ) : isSelf ? (
            <div className="text-center text-xs text-[#8C7A6B] py-2">想修改自己的昵称，去「关于我」或个人资料里改。</div>
          ) : relation?.status === 'accepted' ? (
            <>
              <button
                onClick={() => {
                  actions.onOpenChat(target.id);
                  onClose();
                }}
                className={`${BTN_PRIMARY} w-full`}
              >
                <MessageCircle className="w-4 h-4" /> 发私信
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`确定删除与「${displayName}」的好友关系吗？`)) return;
                  void run(() => actions.onRemoveFriend(relation.id));
                }}
                className={`${BTN_GHOST} w-full`}
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除好友
              </button>
            </>
          ) : relation?.status === 'pending' && relation.direction === 'outgoing' ? (
            <div className="text-center text-xs text-[#6D28D9] bg-[#F6F3FF] rounded-xl py-3">
              好友申请已发出，等对方同意后就能私信
            </div>
          ) : relation?.status === 'pending' && relation.direction === 'incoming' ? (
            <>
              <p className="text-center text-xs text-[#78695C]">{displayName} 也想加你为好友</p>
              <button disabled={busy} onClick={() => void run(() => actions.onRespond(relation.id, true))} className={`${BTN_PRIMARY} w-full`}>
                <Check className="w-4 h-4" /> 同意并成为好友
              </button>
            </>
          ) : (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={100}
                placeholder="打个招呼（选填）：周六一起练基础呀～"
                className="w-full resize-none rounded-xl border border-[#E7DED2] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#DDD0FA]"
              />
              <button
                disabled={busy}
                onClick={() => void run(() => actions.onAddFriend(target.id, note))}
                className={`${BTN_PRIMARY} w-full`}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                发送好友申请
              </button>
              <p className="text-center text-[10px] text-[#B0A090]">对方同意后才会解锁私信，避免被打扰</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
