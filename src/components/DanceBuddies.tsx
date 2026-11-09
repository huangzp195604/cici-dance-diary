import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserCheck, 
  UserPlus, 
  MapPin, 
  MessageSquare, 
  Heart, 
  Send, 
  Sparkles, 
  Calendar,
  Flame,
  Plus,
  Pin,
  CheckCircle2,
  Copy,
  Check,
  Search,
  MessageCircle,
  HelpCircle,
  Music,
  Coffee,
  UserCheck2,
  Trash2,
  Share2,
  AlertTriangle,
  ShieldCheck,
  Database,
  X,
  AlertCircle,
  Pencil,
  Lock,
  BadgeCheck,
  Link2,
  Flag,
  ScrollText
} from 'lucide-react';
import { DanceBuddy, WallMessage, ForumThread, RealFriend, ForumCategory, ForumReply, DanceStage, Gender } from '../types';
import { OnlineFriendsSection, MessagesView, UserCardModal } from './SocialViews';
import { GuestForumPreview } from './GuestForumPreview';
import { CommunityRules } from './CommunityRules';
import { ReportDialog, type ReportTarget } from './ReportDialog';
import {
  MeetupSafetyNote,
  MeetupSafetyConfirm,
  hasAckedMeetupSafety,
  ackMeetupSafety,
} from './MeetupSafetyNote';
import type { SocialActions, SocialViewProps } from './SocialViews';
import type { SocialData } from '../types';

/** 未接入社交数据时的空实现：让组件在未登录 / 加载中也能安全渲染 */
const NOOP_SOCIAL_ACTIONS: SocialActions = {
  onAddFriend: async () => {},
  onRespond: async () => {},
  onRemoveFriend: async () => {},
  onSendMessage: async () => {},
  onMarkRead: () => {},
  onOpenChat: () => {},
  onRefresh: () => {},
  onLogin: () => {},
};

/**
 * 站外收款 / 私下拉群检测：命中则折叠正文，引导走官方报名。
 * 目的不是封禁，而是让「绕开平台」的信息在视觉上降权，
 * 官方报名按钮始终更显眼、更省事。
 */
const OFFSITE_PATTERNS: RegExp[] = [
  /(收款码|付款码|扫码付|扫码转账|支付宝转账|微信转账|发红包)/,
  /(加|扫|长按)[^\n]{0,6}(二维码|群二维码)/,
  /(微信|vx|VX|Vx|v信|weixin)\s*[:：]?\s*[a-zA-Z][-_a-zA-Z0-9]{5,19}/,
  /(扫码进群|拉群|私聊我发群)/,
];

function detectOffsite(text: string): string | null {
  if (!text) return null;
  for (const p of OFFSITE_PATTERNS) {
    if (p.test(text)) return '检测到疑似站外收款或私下拉群信息';
  }
  return null;
}

interface DanceBuddiesProps {
  buddies: DanceBuddy[];
  messages: WallMessage[];
  threads?: ForumThread[];
  realFriends?: RealFriend[];
  onToggleFollow: (buddyId: string) => void;
  onAddBuddy?: (buddy: DanceBuddy) => void;
  onUpdateBuddy?: (buddy: DanceBuddy) => void;
  onDeleteBuddy?: (buddyId: string) => void;
  onAddMessage: (message: WallMessage) => void;
  onToggleMessageLike: (msgId: string) => void;
  onAddReply: (msgId: string, replyText: string) => void;
  onCreateThread?: (thread: ForumThread) => void;
  onUpdateThread?: (thread: ForumThread) => void;
  onDeleteThread?: (threadId: string) => void;
  onToggleThreadLike?: (threadId: string) => void;
  onAddThreadReply?: (threadId: string, content: string) => void;
  onToggleJoinMeetup?: (threadId: string) => void;
  onAddRealFriend?: (friend: RealFriend) => void;
  onUpdateRealFriend?: (friend: RealFriend) => void;
  onDeleteRealFriend?: (friendId: string) => void;
  /** 当前登录用户昵称：用于名单高亮与组织者判定 */
  currentUserName?: string;
  /** 好友关系 / 私信 / 会话（云端数据，未登录时为 null） */
  social?: SocialData | null;
  socialLoading?: boolean;
  socialError?: string;
  currentUserId?: string;
  isLoggedIn?: boolean;
  activeChatPeerId?: string | null;
  onSelectChat?: (peerId: string | null) => void;
  socialActions?: SocialActions;
  /** 打开登录弹窗（未登录点头像时引导） */
  onLoginRequired?: () => void;
  /** 游客点论坛详情 / 发帖：打开「登录后使用」的提示层（比直接弹验证码更友好） */
  onForumLocked?: () => void;
  /** 打开权限对比说明 */
  onShowAccess?: () => void;
}

export const DanceBuddies: React.FC<DanceBuddiesProps> = ({
  buddies,
  messages,
  threads = [],
  realFriends = [],
  onToggleFollow,
  onAddBuddy,
  onUpdateBuddy,
  onDeleteBuddy,
  onAddMessage,
  onToggleMessageLike,
  onAddReply,
  onCreateThread,
  onUpdateThread,
  onDeleteThread,
  onToggleThreadLike,
  onAddThreadReply,
  onToggleJoinMeetup,
  onAddRealFriend,
  onUpdateRealFriend,
  onDeleteRealFriend,
  currentUserName,
  social = null,
  socialLoading = false,
  socialError = '',
  currentUserId,
  isLoggedIn = false,
  activeChatPeerId = null,
  onSelectChat = () => {},
  socialActions = NOOP_SOCIAL_ACTIONS,
  onLoginRequired,
  onForumLocked,
  onShowAccess,
}) => {
  /** 当前用户在本站的展示名：发帖作者、约练发起人、空间主人等处统一用它，不再写死人名 */
  const selfName = (currentUserName || '').trim() || '我';
  const [activeTab, setActiveTab] = useState<'forum' | 'friends' | 'messages'>('forum');
  /** 论坛点头像打开的用户资料卡 */
  const [userCard, setUserCard] = useState<{ id: string; name: string; avatarBg: string } | null>(null);

  const socialActionsWithLogin: SocialActions = {
    ...socialActions,
    onLogin: onLoginRequired || socialActions.onLogin,
  };

  /** 三个社交视图共用同一份 props，避免数据来源不一致 */
  const socialViewProps: SocialViewProps = {
    social,
    loading: socialLoading,
    error: socialError,
    isLoggedIn,
    currentUserId,
    activeChatPeerId,
    onSelectChat,
    actions: socialActionsWithLogin,
  };

  const unreadMessages = (social?.conversations || []).reduce((n, c) => n + c.unread, 0);
  const pendingRequests = (social?.friendships || []).filter(
    (f) => f.status === 'pending' && f.direction === 'incoming'
  ).length;

  /** 从资料卡 / 好友卡片点「发私信」时，父组件只需设置 activeChatPeerId，这里自动切到私信页 */
  useEffect(() => {
    if (activeChatPeerId) setActiveTab('messages');
  }, [activeChatPeerId]);
  const [selectedCategory, setSelectedCategory] = useState<ForumCategory>('全部');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Thread Expansion & Reply State
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [threadReplyText, setThreadReplyText] = useState<Record<string, string>>({});

  // New Thread Modal
  const [isNewThreadOpen, setIsNewThreadOpen] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadCategory, setNewThreadCategory] = useState<'舞室约练' | '动作拆解' | '扒舞音乐' | '舞友随笔'>('舞室约练');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newThreadStudio, setNewThreadStudio] = useState('星光舞蹈工作室 (静安店)');
  const [newThreadDate, setNewThreadDate] = useState('本周六 14:00-16:00');
  const [newThreadTargetCount, setNewThreadTargetCount] = useState(4);
  const [newThreadCost, setNewThreadCost] = useState('场地费平摊，人均约 35 元');

  // 报名闭环：活动群入口（仅报名者可见）与组织者身份说明
  const [newThreadGroupEntry, setNewThreadGroupEntry] = useState('');
  const [newThreadGroupNote, setNewThreadGroupNote] = useState('');

  // 社区治理：举报 / 公约 / 首次约练安全确认
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  /** 本机已举报的内容：立刻折叠，避免举报完还天天在列表里看到 */
  const [reportedThreadIds, setReportedThreadIds] = useState<Record<string, boolean>>({});
  const [revealedReportedIds, setRevealedReportedIds] = useState<Record<string, boolean>>({});
  const [reportedReplyIds, setReportedReplyIds] = useState<Record<string, boolean>>({});
  /** 首次报名前要先过安全确认；记下待确认的帖子 id */
  const [safetyThreadId, setSafetyThreadId] = useState<string | null>(null);
  const [newThreadOrganizerNote, setNewThreadOrganizerNote] = useState('');
  // 疑似站外收款/拉群的帖子：默认折叠，用户可主动展开
  const [revealedOffsiteIds, setRevealedOffsiteIds] = useState<Record<string, boolean>>({});
  // 群入口复制反馈
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  // Add Real Friend Modal
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendContact, setNewFriendContact] = useState('');
  const [newFriendStudio, setNewFriendStudio] = useState('星光舞蹈工作室 (静安)');
  const [newFriendStyle, setNewFriendStyle] = useState('基础班 · 律动');
  const [newFriendNotes, setNewFriendNotes] = useState('');
  const [newFriendGender, setNewFriendGender] = useState<Gender | null>(null);
  const [newFriendAge, setNewFriendAge] = useState('');
  const [copiedFriendId, setCopiedFriendId] = useState<string | null>(null);

  // Permanent Delete Modal & Confirmation State
  const [friendToDelete, setFriendToDelete] = useState<RealFriend | null>(null);
  const [isDeletingFriend, setIsDeletingFriend] = useState(false);
  const [deletePermissionConfirmed, setDeletePermissionConfirmed] = useState(false);
  const [deleteFeedbackToast, setDeleteFeedbackToast] = useState<string | null>(null);

  // Buddy Invite Modal (for directory tab)
  const [invitedBuddy, setInvitedBuddy] = useState<DanceBuddy | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  // Message Wall (Legacy Tab Support)
  const [wallFilter, setWallFilter] = useState<string>('全部');
  const [newMessageText, setNewMessageText] = useState('');
  const [newMessageType, setNewMessageType] = useState<WallMessage['type']>('约练');
  const [newMessageStudio, setNewMessageStudio] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');

  // 帖子编辑状态（为空表示新建）
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);

  // 真实舞友编辑状态（为空表示新增）
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);

  // 舞伴名册编辑器状态
  const [isBuddyEditorOpen, setIsBuddyEditorOpen] = useState(false);
  const [editingBuddyId, setEditingBuddyId] = useState<string | null>(null);
  const [buddyForm, setBuddyForm] = useState<{
    name: string;
    style: string;
    stage: DanceStage;
    studio: string;
    frequency: string;
    bio: string;
    currentPractice: string;
    recentTrack: string;
  }>({
    name: '',
    style: '基础班 · 律动',
    stage: '入门',
    studio: '',
    frequency: '每周 1 次',
    bio: '',
    currentPractice: '',
    recentTrack: '',
  });

  const followedBuddies = buddies.filter((b) => b.isFollowed);

  /** 生成真实的记录时间，例如 "2026-11-06 15:30" */
  const formatNow = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /** 显示系统自动记录的新增日期 */
  const formatRecordDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const realFriendNames = realFriends.slice(0, 3).map((f) => f.name).join('、') + (realFriends.length > 3 ? ' 等' : '');

  // Filter Threads
  const filteredThreads = threads.filter((t) => {
    if (selectedCategory !== '全部' && t.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchContent = t.content.toLowerCase().includes(q);
      const matchAuthor = t.author.toLowerCase().includes(q);
      const matchStudio = t.meetup?.studio.toLowerCase().includes(q);
      const matchTag = t.tags?.some((tag) => tag.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchAuthor && !matchStudio && !matchTag) return false;
    }
    return true;
  });

  // 打开新建帖子弹窗（清空上一次编辑残留）
  const openNewThreadModal = () => {
    setEditingThreadId(null);
    setNewThreadTitle('');
    setNewThreadCategory('舞室约练');
    setNewThreadContent('');
    setNewThreadStudio('星光舞蹈工作室 (静安店)');
    setNewThreadDate('本周六 14:00-16:00');
    setNewThreadTargetCount(4);
    setNewThreadCost('场地费平摊，人均约 35 元');
    setNewThreadGroupEntry('');
    setNewThreadGroupNote('');
    setNewThreadOrganizerNote('');
    setIsNewThreadOpen(true);
  };

  // 打开帖子编辑弹窗
  const openEditThread = (thread: ForumThread) => {
    setEditingThreadId(thread.id);
    setNewThreadTitle(thread.title);
    setNewThreadCategory(thread.category);
    setNewThreadContent(thread.content);
    setNewThreadStudio(thread.meetup?.studio ?? '星光舞蹈工作室 (静安店)');
    setNewThreadDate(thread.meetup?.date ?? '本周末');
    setNewThreadTargetCount(thread.meetup?.targetCount ?? 4);
    setNewThreadCost(thread.meetup?.costNote ?? '');
    setNewThreadGroupEntry(thread.meetup?.groupEntry ?? '');
    setNewThreadGroupNote(thread.meetup?.groupNote ?? '');
    setNewThreadOrganizerNote(thread.meetup?.organizerNote ?? '');
    setIsNewThreadOpen(true);
  };

  const closeThreadModal = () => {
    setIsNewThreadOpen(false);
    setEditingThreadId(null);
  };

  // Handle Thread Submission (新建或编辑)
  const handlePublishThread = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return;

    const meetup = newThreadCategory === '舞室约练' ? {
      studio: newThreadStudio.trim(),
      date: newThreadDate.trim(),
      targetCount: newThreadTargetCount,
      joinedBuddies: [selfName],
      isJoined: true,
      costNote: newThreadCost.trim() || undefined,
      organizerNote: newThreadOrganizerNote.trim() || undefined,
      groupEntry: newThreadGroupEntry.trim() || undefined,
      groupNote: newThreadGroupNote.trim() || undefined,
    } : undefined;

    if (editingThreadId) {
      const original = threads.find((t) => t.id === editingThreadId);
      if (original) {
        const updated: ForumThread = {
          ...original,
          title: newThreadTitle.trim(),
          category: newThreadCategory,
          content: newThreadContent.trim(),
          tags: original.tags?.length ? [newThreadCategory, ...original.tags.slice(1)] : [newThreadCategory, `${selfName}发帖`],
          meetup: meetup
            ? { ...meetup, joinedBuddies: original.meetup?.joinedBuddies ?? [selfName], isJoined: original.meetup?.isJoined ?? true }
            : undefined,
        };
        onUpdateThread?.(updated);
      }
      closeThreadModal();
      return;
    }

    const newThread: ForumThread = {
      id: `thread-${Date.now()}`,
      title: newThreadTitle.trim(),
      category: newThreadCategory,
      content: newThreadContent.trim(),
      author: selfName,
      authorRole: '发起人',
      avatarBg: 'bg-orange-100 text-orange-700',
      createdAt: formatNow(),
      likes: 1,
      isLiked: true,
      views: 1,
      replies: [],
      tags: [newThreadCategory, `${selfName}发帖`],
      meetup,
    };

    onCreateThread?.(newThread);
    closeThreadModal();
  };

  // 删除帖子（真实物理删除，二次确认）
  const handleDeleteThread = (thread: ForumThread) => {
    if (!window.confirm(`确定删除帖子「${thread.title}」吗？删除后不可恢复。`)) return;
    onDeleteThread?.(thread.id);
    if (expandedThreadId === thread.id) {
      setExpandedThreadId(null);
    }
  };

  // 复制活动群入口（仅报名者/组织者可见时才渲染此按钮）
  const handleCopyGroup = async (threadId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 浏览器不支持或未授权时静默降级，用户可手动选中复制
    }
    setCopiedGroupId(threadId);
    window.setTimeout(() => setCopiedGroupId((prev) => (prev === threadId ? null : prev)), 2000);
  };

  // Handle Thread Reply
  const handleSubmitThreadReply = (threadId: string, e: React.FormEvent) => {
    e.preventDefault();
    const text = threadReplyText[threadId]?.trim();
    if (!text) return;

    if (onAddThreadReply) {
      onAddThreadReply(threadId, text);
    }
    setThreadReplyText((prev) => ({ ...prev, [threadId]: '' }));
  };

  // Handle Add / Edit Real Friend
  const handleSaveRealFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim() || !newFriendContact.trim()) return;

    const base = editingFriendId ? realFriends.find((f) => f.id === editingFriendId) : undefined;
    const friend: RealFriend = {
      id: base?.id ?? `friend-${Date.now()}`,
      name: newFriendName.trim(),
      contact: newFriendContact.trim(),
      studio: newFriendStudio.trim(),
      danceStyle: newFriendStyle.trim(),
      notes: newFriendNotes.trim() || base?.notes || '常在一起练舞的伙伴',
      gender: newFriendGender ?? base?.gender,
      age: newFriendAge.trim() ? Number(newFriendAge) : base?.age,
      avatarBg: base?.avatarBg ?? 'bg-rose-100 text-rose-700',
      status: base?.status ?? '空闲',
      recentTopic: base?.recentTopic ?? '刚刚添加为真实舞友',
      createdAt: base?.createdAt ?? new Date().toISOString(),
    };

    if (base) {
      onUpdateRealFriend?.(friend);
    } else {
      onAddRealFriend?.(friend);
    }

    setEditingFriendId(null);
    setNewFriendName('');
    setNewFriendContact('');
    setNewFriendNotes('');
    setNewFriendGender(null);
    setNewFriendAge('');
    setIsAddFriendOpen(false);
  };

  const openNewFriendModal = () => {
    setEditingFriendId(null);
    setNewFriendName('');
    setNewFriendContact('');
    setNewFriendStudio('星光舞蹈工作室 (静安)');
    setNewFriendStyle('基础班 · 律动');
    setNewFriendNotes('');
    setNewFriendGender(null);
    setNewFriendAge('');
    setIsAddFriendOpen(true);
  };

  const openEditFriend = (friend: RealFriend) => {
    setEditingFriendId(friend.id);
    setNewFriendName(friend.name);
    setNewFriendContact(friend.contact);
    setNewFriendStudio(friend.studio);
    setNewFriendStyle(friend.danceStyle);
    setNewFriendNotes(friend.notes);
    setNewFriendGender(friend.gender ?? null);
    setNewFriendAge(friend.age ? String(friend.age) : '');
    setIsAddFriendOpen(true);
  };

  const handleCopyContact = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedFriendId(id);
    setTimeout(() => setCopiedFriendId(null), 2000);
  };

  const openComposerWithFriend = (friendName: string, studio: string) => {
    setActiveTab('forum');
    setEditingThreadId(null);
    setNewThreadCategory('舞室约练');
    setNewThreadTitle(`【${studio}】约 @${friendName} 一起拼教室练舞～`);
    setNewThreadContent(`Hi @${friendName}，这周末有空一起在 ${studio} 拼大教室练基础和扒舞吗？互相纠动作拍视频！`);
    setNewThreadStudio(studio);
    setIsNewThreadOpen(true);
  };

  const handleConfirmPermanentDelete = async () => {
    if (!friendToDelete || !deletePermissionConfirmed || isDeletingFriend) return;
    setIsDeletingFriend(true);
    try {
      const targetFriendName = friendToDelete.name;
      if (onDeleteRealFriend) {
        await onDeleteRealFriend(friendToDelete.id);
      }
      setDeleteFeedbackToast(`已永久彻底删除舞伴「${targetFriendName}」，并级联清理其在所有活动名单中的关联引用！`);
      setTimeout(() => setDeleteFeedbackToast(null), 4500);
      setFriendToDelete(null);
      setDeletePermissionConfirmed(false);
    } catch (e) {
      console.error('Permanent delete failed:', e);
      setDeleteFeedbackToast('删除过程中发生错误，请重试');
      setTimeout(() => setDeleteFeedbackToast(null), 3500);
    } finally {
      setIsDeletingFriend(false);
    }
  };

  // --- 舞伴名册：新增 / 编辑 / 删除 ---
  const emptyBuddyForm = () => ({
    name: '',
    style: '基础班 · 律动',
    stage: '入门' as DanceStage,
    studio: '',
    frequency: '每周 1 次',
    bio: '',
    currentPractice: '',
    recentTrack: '',
  });

  const openNewBuddyModal = () => {
    setEditingBuddyId(null);
    setBuddyForm(emptyBuddyForm());
    setIsBuddyEditorOpen(true);
  };

  const openEditBuddy = (buddy: DanceBuddy) => {
    setEditingBuddyId(buddy.id);
    setBuddyForm({
      name: buddy.name,
      style: buddy.style,
      stage: buddy.stage,
      studio: buddy.studio,
      frequency: buddy.frequency,
      bio: buddy.bio,
      currentPractice: buddy.currentPractice,
      recentTrack: buddy.recentTrack ?? '',
    });
    setIsBuddyEditorOpen(true);
  };

  const handleSaveBuddy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!buddyForm.name.trim() || !buddyForm.studio.trim()) return;

    const base = editingBuddyId ? buddies.find((b) => b.id === editingBuddyId) : undefined;
    const name = buddyForm.name.trim();
    const buddy: DanceBuddy = {
      id: base?.id ?? `buddy-${Date.now()}`,
      name,
      initials: base?.initials ?? name.slice(0, 1),
      avatarBg: base?.avatarBg ?? 'bg-indigo-100 text-indigo-700',
      style: buddyForm.style.trim() || '基础班 · 律动',
      stage: buddyForm.stage,
      bio: buddyForm.bio.trim() || '刚刚加入舞伴名册，正在寻找一起练舞的搭子。',
      studio: buddyForm.studio.trim(),
      frequency: buddyForm.frequency.trim() || '每周 1 次',
      followersCount: base?.followersCount ?? 0,
      isFollowed: base?.isFollowed ?? false,
      currentPractice: buddyForm.currentPractice.trim() || '正在规划本阶段的练习重点',
      recentTrack: buddyForm.recentTrack.trim() || undefined,
      createdAt: base?.createdAt ?? new Date().toISOString(),
    };

    if (base) {
      onUpdateBuddy?.(buddy);
    } else {
      onAddBuddy?.(buddy);
    }

    setBuddyForm(emptyBuddyForm());
    setEditingBuddyId(null);
    setIsBuddyEditorOpen(false);
  };

  const handleDeleteBuddy = (buddy: DanceBuddy) => {
    if (!window.confirm(`确定从舞伴名册中删除「${buddy.name}」吗？删除后不可恢复。`)) return;
    onDeleteBuddy?.(buddy.id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fadeIn">
      
      {/* 1. Community Forum Header Banner */}
      <section className="bg-gradient-to-r from-[#F3EEFF] via-[#F8EEFF] to-[#FFF0EC] border border-[#E3D7FE] rounded-3xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#E6D9FF] text-[#7C3AED] flex items-center justify-center shrink-0 shadow-inner">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#292524] tracking-tight">
                  舞友论坛 & 真实舞友圈
                </h2>
                <span className="text-[11px] bg-[#EDE9FE] text-[#6D28D9] px-2.5 py-0.5 rounded-full font-bold border border-[#DDD0FA]">
                  Dance Community
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#6D28D9] mt-0.5">
                连接现实练舞好友、舞室组队拼房约练、舞蹈动作避坑答疑与音乐交流。
              </p>
            </div>
          </div>

          {/* Tab Switcher：论坛 / 舞友 / 私信，标签总数不变，不增加操作层级 */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-white/85 backdrop-blur-xs rounded-2xl border border-[#DDD0FA] self-start sm:self-auto shadow-2xs">
            <button
              onClick={() => setActiveTab('forum')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'forum'
                  ? 'bg-[#7C3AED] text-white shadow-2xs'
                  : 'text-[#6D28D9] hover:bg-[#EFEBFF]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>舞友论坛 ({threads.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('friends')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'friends'
                  ? 'bg-[#7C3AED] text-white shadow-2xs'
                  : 'text-[#6D28D9] hover:bg-[#EFEBFF]'
              }`}
            >
              <UserCheck2 className="w-3.5 h-3.5" />
              <span>舞友</span>
              {pendingRequests > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingRequests}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'messages'
                  ? 'bg-[#7C3AED] text-white shadow-2xs'
                  : 'text-[#6D28D9] hover:bg-[#EFEBFF]'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>私信</span>
              {unreadMessages > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* VIEW A: 舞友论坛 (FORUM BOARDS & DISCUSSIONS)           */}
      {/* ======================================================== */}
      {activeTab === 'forum' && !isLoggedIn && (
        <GuestForumPreview
          threads={threads}
          onLogin={onForumLocked || onLoginRequired || (() => {})}
          onShowAccess={onShowAccess || (() => {})}
          onShowRules={() => setIsRulesOpen(true)}
        />
      )}

      {activeTab === 'forum' && isLoggedIn && (
        <div className="space-y-5">
          
          {/* Sub-bar: Category Filter & New Post Trigger */}
          <div className="bg-white border border-[#EFE3D5] rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Board category chips：窄屏换行而不是横向滚动，
                横向滚动会把“扒舞音乐”切一半，看着像排版坏了 */}
            <div className="flex flex-wrap items-center gap-1.5 gap-y-1.5">
              {(['全部', '舞室约练', '动作拆解', '扒舞音乐', '舞友随笔'] as ForumCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#7C3AED] text-white shadow-2xs ring-2 ring-[#7C3AED]/20'
                      : 'bg-[#FAF2EB] text-[#736357] hover:bg-[#F3E5D7]'
                  }`}
                >
                  {cat === '舞室约练' && '👯 '}
                  {cat === '动作拆解' && '💡 '}
                  {cat === '扒舞音乐' && '🎵 '}
                  {cat === '舞友随笔' && '☕ '}
                  {cat}
                </button>
              ))}
            </div>

            {/* Search & New Post Button */}
            <div className="flex items-center gap-2 self-end md:self-auto w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsRulesOpen(true)}
                title="查看社区公约：只谈舞蹈、不做生意、见面选公共场所"
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-[#7C3AED] bg-[#F3EEFF] hover:bg-[#EAE1FF] border border-[#DDD0FA] rounded-xl shrink-0 transition-colors cursor-pointer"
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">公约</span>
              </button>

              <div className="relative flex-1 md:w-48">
                <Search className="w-3.5 h-3.5 text-[#A8988A] absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="搜索话题/舞室/动作..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9] focus:outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>

              <button
                onClick={openNewThreadModal}
                className="px-4 py-2 bg-[#FF7E67] hover:bg-[#E65B47] text-white rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span className="whitespace-nowrap">发布<span className="hidden sm:inline">新帖 / 发起约练</span></span>
              </button>
            </div>

          </div>

          {/* Quick Notice about Real Friends connection */}
          <div className="bg-[#FFFDF9] border border-[#F0E3D6] p-3.5 rounded-2xl text-xs text-[#6B5A4D] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF7E67] shrink-0" />
              <span>
                {realFriends.length > 0 ? (
                  <>你已关联 <strong>{realFriends.length}</strong> 位现实舞友{realFriendNames ? `（${realFriendNames}）` : ''}。发布约练帖会即时记录到你的舞友圈。</>
                ) : (
                  <>暂无现实舞友档案。添加第一位线下舞伴后，即可在这里一键发帖约练。</>
                )}
              </span>
            </div>
            <button
              onClick={() => setActiveTab('friends')}
              className="text-xs font-bold text-[#7C3AED] hover:underline shrink-0"
            >
              管理真实舞友 →
            </button>
          </div>

          {/* Threads Stream */}
          <div className="space-y-4">
            {filteredThreads.length === 0 ? (
              <div className="bg-white border border-[#EFE3D5] rounded-3xl p-10 text-center">
                <MessageSquare className="w-10 h-10 mx-auto text-[#C4B5FD] mb-2" />
                <p className="text-sm font-bold text-[#4A3E36]">暂无符合条件的话题帖子</p>
                <p className="text-xs text-[#8C7A6B] mt-1">发个帖子求助动作细节，或者发起一场周末舞室约练吧！</p>
                <button
                  onClick={openNewThreadModal}
                  className="mt-4 px-4 py-1.5 bg-[#7C3AED] text-white rounded-full text-xs font-semibold"
                >
                  去发第一帖
                </button>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isExpanded = expandedThreadId === thread.id;
                const isMeetup = thread.category === '舞室约练' && thread.meetup;
                const meetup = thread.meetup;
                // 是否已报名：云端给出 isJoined，本地演示数据回退到昵称匹配
                const hasJoined = meetup
                  ? meetup.isJoined ?? (!!currentUserName && meetup.joinedBuddies.includes(currentUserName))
                  : false;
                const joinedCount = meetup?.joinedBuddies.length ?? 0;
                const capacity = meetup?.targetCount ?? 0;
                const isFull = capacity > 0 && joinedCount >= capacity;
                // 群入口可见性：组织者本人或已报名者
                const canSeeGroup = hasJoined || !!thread.isOrganizer;
                const offsiteWarning = detectOffsite(thread.content);
                const hideContent = !!offsiteWarning && !revealedOffsiteIds[thread.id];
                // 刚举报过：本机先折叠，眼不见为净，但保留「仍要查看」的出口，不做无声删改
                const isReportedHidden = !!reportedThreadIds[thread.id] && !revealedReportedIds[thread.id];

                return (
                  <article
                    key={thread.id}
                    className="bg-white border border-[#EFE3D5] rounded-3xl p-5 sm:p-6 shadow-2xs hover:shadow-sm transition-all"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          disabled={!thread.authorId}
                          onClick={() =>
                            thread.authorId &&
                            setUserCard({ id: thread.authorId, name: thread.author, avatarBg: thread.avatarBg })
                          }
                          title={thread.authorId ? `查看 ${thread.author} 的资料` : undefined}
                          className={`w-10 h-10 rounded-full ${thread.avatarBg} font-display font-bold text-sm flex items-center justify-center shrink-0 border border-black/5 transition-transform hover:scale-105 ${
                            thread.authorId ? 'cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          {thread.author.slice(0, 1)}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-[#292524]">{thread.author}</span>
                            {(thread.authorGender || thread.authorAge) && (
                              <span className="text-[10px] bg-[#F2F7FF] text-[#4B6B8A] px-2 py-0.5 rounded-full font-medium">
                                {[thread.authorGender, thread.authorAge ? `${thread.authorAge}岁` : '']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            )}
                            {thread.authorRole && (
                              <span className="text-[10px] bg-[#FAF2EB] text-[#736357] px-2 py-0.5 rounded-full font-medium">
                                {thread.authorRole}
                              </span>
                            )}
                            {thread.organizerStats && thread.organizerStats.hosted > 0 && (
                              <span
                                title={`已组织 ${thread.organizerStats.hosted} 场约练 · 累计 ${thread.organizerStats.totalJoined} 人报名`}
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 cursor-help border ${
                                  thread.organizerStats.hosted >= 3
                                    ? 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]'
                                    : 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]'
                                }`}
                              >
                                <BadgeCheck className="w-2.5 h-2.5" />
                                <span>{thread.organizerStats.hosted >= 3 ? '资深组织者' : '活动组织者'}</span>
                                <span className="opacity-70 font-mono">{thread.organizerStats.hosted}场</span>
                              </span>
                            )}
                            {thread.isPinned && (
                              <span className="text-[10px] bg-[#FEE2E2] text-[#DC2626] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                <Pin className="w-2.5 h-2.5" />
                                置顶
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#A8988A] mt-0.5">
                            <span className="text-[#7C3AED] font-semibold whitespace-nowrap">{thread.category}</span>
                            {/* 分隔点挂在第二段开头，换行时跟着走，不会把孤零零一个点留在行尾 */}
                            <span
                              className="whitespace-nowrap"
                              title={thread.createdAtExact ? `发布于 ${thread.createdAtExact}` : undefined}
                            >
                              <span aria-hidden="true" className="mr-2 text-[#CDBEB3]">
                                ·
                              </span>
                              {thread.createdAt}
                              <span className="hidden sm:inline"> · {thread.views} 次浏览</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tag pill & 帖子操作 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs bg-[#F5EDE4] text-[#6E5D50] px-2.5 py-1 rounded-xl font-medium hidden sm:inline">
                          {thread.tags?.[0] || thread.category}
                        </span>
                        <button
                          onClick={() => openEditThread(thread)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#A8988A] hover:text-[#7C3AED] hover:bg-[#F3EEFF] border border-transparent hover:border-[#DDD0FA] transition-all cursor-pointer"
                          title="编辑帖子"
                          aria-label={`编辑帖子 ${thread.title}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteThread(thread)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#B8A89A] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                          title="删除帖子"
                          aria-label={`删除帖子 ${thread.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {/* 举报：自己的帖子不显示（举报自己没意义，也容易被当成测试入口） */}
                        {!thread.isOrganizer && (
                          <button
                            onClick={() =>
                              setReportTarget({
                                type: 'thread',
                                id: thread.id,
                                authorId: thread.authorId,
                                authorName: thread.author,
                                excerpt: `${thread.title}｜${thread.content}`.slice(0, 200),
                              })
                            }
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#B8A89A] hover:text-[#B4452F] hover:bg-[#FFF1EC] border border-transparent hover:border-[#FFD5C8] transition-all cursor-pointer"
                            title="举报这条内容（广告、站外收款、骚扰等）"
                            aria-label={`举报帖子 ${thread.title}`}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3
                      onClick={() => setExpandedThreadId(isExpanded ? null : thread.id)}
                      className="text-base sm:text-lg font-bold text-[#292524] mt-3 hover:text-[#7C3AED] cursor-pointer transition-colors leading-snug"
                    >
                      {thread.title}
                    </h3>

                    {/* Content snippet：疑似站外收款/拉群时默认折叠，引导走官方报名 */}
                    {isReportedHidden ? (
                      <div className="mt-2 bg-[#F7F4FF] border border-[#DDD0FA] rounded-2xl p-3 flex items-start gap-2">
                        <Flag className="w-4 h-4 text-[#7C3AED] shrink-0 mt-0.5" />
                        <div className="space-y-1 min-w-0">
                          <p className="text-xs font-bold text-[#4C1D95]">你已举报这条内容，已在这台设备上隐藏</p>
                          <p className="text-[11px] text-[#6D28D9] leading-relaxed">
                            我们会在 24 小时内核实。想先看一眼原文，可以展开。
                          </p>
                          <button
                            type="button"
                            onClick={() => setRevealedReportedIds((prev) => ({ ...prev, [thread.id]: true }))}
                            className="text-[11px] font-bold text-[#4C1D95] underline hover:no-underline cursor-pointer"
                          >
                            仍要查看
                          </button>
                        </div>
                      </div>
                    ) : hideContent ? (
                      <div className="mt-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-[#92400E]">{offsiteWarning}</p>
                            <p className="text-[11px] text-[#A16207] leading-relaxed">
                              为保障你的权益，站内活动请优先使用上方「官方报名」按钮报名；报名成功后由组织者提供群入口。
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedOffsiteIds((prev) => ({ ...prev, [thread.id]: true }))
                          }
                          className="text-[11px] font-bold text-[#92400E] underline hover:no-underline cursor-pointer"
                        >
                          仍要查看帖子原文
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs sm:text-sm text-[#574B40] mt-2 leading-relaxed whitespace-pre-wrap">
                        {thread.content}
                      </p>
                    )}

                    {/* MEETUP CARD：官方报名闭环（人数上限 / 报名名单 / 报名后解锁群入口） */}
                    {isMeetup && meetup && (
                      <div className="mt-3.5 bg-gradient-to-br from-[#FFF8F3] to-[#FFF1EC] border border-[#FAD6C5] rounded-2xl p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[#A63C29]">
                              <MapPin className="w-3.5 h-3.5 text-[#E65B47]" />
                              <span>{meetup.studio}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#78695C] flex-wrap">
                              <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" />
                              <span>时间: <strong>{meetup.date}</strong></span>
                              {meetup.costNote && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{meetup.costNote}</span>
                                </>
                              )}
                            </div>
                            {meetup.organizerNote && (
                              <div className="flex items-center gap-1 text-[11px] text-[#8C7A6B]">
                                <ShieldCheck className="w-3 h-3 text-[#15803D]" />
                                <span>组织者：{thread.author} · {meetup.organizerNote}</span>
                              </div>
                            )}
                          </div>

                          {/* 官方报名按钮：满员禁用；组织者本人不显示报名入口 */}
                          {thread.isOrganizer ? (
                            <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#E8DACB] text-[#78695C]">
                              <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" />
                              <span>你是本场组织者</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                // 第一次报名先过一次安全确认；之后不再打扰
                                if (!hasJoined && !hasAckedMeetupSafety()) {
                                  setSafetyThreadId(thread.id);
                                  return;
                                }
                                onToggleJoinMeetup?.(thread.id);
                              }}
                              disabled={!hasJoined && isFull}
                              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                                hasJoined
                                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 cursor-pointer'
                                  : isFull
                                  ? 'bg-[#F5EDE4] text-[#A8988A] border border-[#E8DACB] cursor-not-allowed'
                                  : 'bg-[#FF7E67] hover:bg-[#E65B47] text-white cursor-pointer'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{hasJoined ? '已报名 · 点击退出' : isFull ? '名额已满' : '官方报名'}</span>
                            </button>
                          )}
                        </div>

                        {/* 报名进度：把「还差几人」变成可见进度，组织者不用再数接龙 */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#8C7A6B]">
                              报名进度{' '}
                              <strong className="text-[#A63C29] font-mono">{joinedCount}/{capacity}</strong>
                              {thread.isOrganizer && joinedCount > 0 && (
                                <span className="ml-1 text-[#15803D] font-semibold">（名单见下方）</span>
                              )}
                            </span>
                            <span className={`font-mono font-bold ${isFull ? 'text-[#15803D]' : 'text-[#D94834]'}`}>
                              {isFull ? '🎉 已满员' : `还差 ${Math.max(0, capacity - joinedCount)} 人成行`}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#F5DEC7] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#FF9E8A] to-[#E65B47] transition-all"
                              style={{
                                width: `${capacity > 0 ? Math.min(100, Math.round((joinedCount / capacity) * 100)) : 0}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* 报名名单 */}
                        <div className="pt-2 border-t border-[#F5DEC7] flex items-start gap-2 text-xs">
                          <span className="text-[#8C7A6B] shrink-0 pt-0.5">已报名：</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {joinedCount === 0 && (
                              <span className="text-[11px] text-[#A8988A]">还没有人报名，来做第一个？</span>
                            )}
                            {meetup.joinedBuddies.map((buddyName, bIdx) => {
                              const isMe = !!currentUserName && buddyName === currentUserName;
                              return (
                                <span
                                  key={`${buddyName}-${bIdx}`}
                                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                                    isMe
                                      ? 'bg-[#FFE8DE] text-[#D94834]'
                                      : 'bg-white text-[#574B40] border border-[#E8DACB]'
                                  }`}
                                >
                                  {buddyName}
                                  {isMe && <span className="ml-0.5 opacity-70">(我)</span>}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* 安全提示：常驻一行，报名的人和不报名的人都看得到 */}
                        <div className="pt-2 border-t border-[#F5DEC7]">
                          <MeetupSafetyNote />
                        </div>

                        {/* 活动群入口：报名后才解锁（数据层由 RLS 保证，非仅前端隐藏） */}
                        {meetup.groupEntry ? (
                          canSeeGroup ? (
                            <div className="bg-white border border-[#BBF7D0] rounded-xl p-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-[#15803D] flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  活动群入口（已解锁）
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyGroup(thread.id, meetup.groupEntry!)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-[#15803D] hover:text-[#166534] px-2 py-0.5 rounded-lg hover:bg-[#F0FDF4] cursor-pointer"
                                >
                                  {copiedGroupId === thread.id ? (
                                    <>
                                      <Check className="w-3 h-3" />
                                      已复制
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      复制
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-xs font-mono text-[#292524] break-all bg-[#F7FEF9] rounded-lg px-2 py-1.5">
                                {meetup.groupEntry}
                              </p>
                              {meetup.groupNote && (
                                <p className="text-[11px] text-[#8C7A6B]">{meetup.groupNote}</p>
                              )}
                              {!thread.isOrganizer && (
                                <p className="text-[10px] text-[#A8988A]">
                                  提示：这是组织者提供的联系方式，交易请自行确认，平台仅提供报名记录
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="bg-[#FAF5EF] border border-dashed border-[#E0D2C3] rounded-xl p-3 flex items-center gap-2">
                              <Lock className="w-3.5 h-3.5 text-[#A8988A] shrink-0" />
                              <span className="text-[11px] text-[#8C7A6B]">
                                活动群入口：<strong className="text-[#574B40]">报名后自动解锁</strong>
                                ，避免群信息被随手转发
                              </span>
                            </div>
                          )
                        ) : thread.isOrganizer ? (
                          <div className="bg-[#F7FEF9] border border-dashed border-[#BBF7D0] rounded-xl p-3 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                            <span className="text-[11px] text-[#15803D]">
                              你还没有填写活动群入口，编辑帖子即可补上（报名者才能看到）
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#F5ECE1]">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => onToggleThreadLike?.(thread.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                            thread.isLiked
                              ? 'bg-[#FFE8E8] text-[#E02424]'
                              : 'bg-[#FAF2EB] text-[#736357] hover:bg-[#F3E5D7]'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${thread.isLiked ? 'fill-current text-[#E02424]' : ''}`} />
                          <span>{thread.likes} 赞</span>
                        </button>

                        <button
                          onClick={() => setExpandedThreadId(isExpanded ? null : thread.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#736357] hover:text-[#292524] px-2 py-1 rounded-lg hover:bg-[#FAF2EB] transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#8B5CF6]" />
                          <span>{thread.replies.length} 条回复讨论</span>
                        </button>
                      </div>

                      <button
                        onClick={() => setExpandedThreadId(isExpanded ? null : thread.id)}
                        className="text-xs font-bold text-[#7C3AED] hover:underline cursor-pointer"
                      >
                        {isExpanded ? '收起讨论' : '展开回复 & 参与交流 →'}
                      </button>
                    </div>

                    {/* EXPANDED REPLIES STREAM */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-[#F1E5D8] bg-[#FFFBF8] rounded-2xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-[#4A3E36] mb-2 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>舞友交流回复 ({thread.replies.length})</span>
                        </h4>

                        {thread.replies.length === 0 ? (
                          <p className="text-xs text-[#A8988A] text-center py-3">
                            暂无回复，发表你的第一句心得或报名互动吧～
                          </p>
                        ) : (
                          thread.replies.map((reply) => (
                            <div key={reply.id} className="bg-white p-3 rounded-2xl border border-[#F0E4D8] text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={!reply.authorId}
                                    onClick={() =>
                                      reply.authorId &&
                                      setUserCard({
                                        id: reply.authorId,
                                        name: reply.author,
                                        avatarBg: reply.avatarBg || 'bg-violet-100 text-violet-700',
                                      })
                                    }
                                    title={reply.authorId ? `查看 ${reply.author} 的资料` : undefined}
                                    className={`flex items-center gap-1.5 font-bold text-[#292524] rounded-lg ${
                                      reply.authorId ? 'cursor-pointer hover:text-[#7C3AED]' : 'cursor-default'
                                    }`}
                                  >
                                    <span
                                      className={`w-5 h-5 rounded-full ${reply.avatarBg || 'bg-violet-100 text-violet-700'} text-[9px] font-display font-bold flex items-center justify-center`}
                                    >
                                      {reply.author.slice(0, 1)}
                                    </span>
                                    {reply.author}
                                  </button>
                                  {reply.authorRole && (
                                    <span className="text-[10px] bg-[#FAF2EB] text-[#78695C] px-1.5 py-0.2 rounded font-normal">
                                      {reply.authorRole}
                                    </span>
                                  )}
                                  {reply.isOwner && (
                                    <span className="text-[10px] bg-[#FFE0D1] text-[#E65B47] px-1.5 py-0.2 rounded font-semibold">
                                      楼主
                                    </span>
                                  )}
                                  {(reply.authorGender || reply.authorAge) && (
                                    <span className="text-[10px] bg-[#F7EFE7] text-[#8C7A6B] px-1.5 py-0.2 rounded font-normal">
                                      {[reply.authorGender, reply.authorAge ? `${reply.authorAge}岁` : '']
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className="text-[10px] text-[#A8988A] font-mono"
                                    title={reply.createdAtExact ? `发布于 ${reply.createdAtExact}` : undefined}
                                  >
                                    {reply.createdAtExact || reply.createdAt}
                                  </span>
                                  {!reply.isOwner && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setReportTarget({
                                          type: 'reply',
                                          id: reply.id,
                                          authorId: reply.authorId,
                                          authorName: reply.author,
                                          excerpt: reply.content,
                                        })
                                      }
                                      title="举报这条回复"
                                      aria-label={`举报 ${reply.author} 的回复`}
                                      className="p-1 rounded-md text-[#C4B5A8] hover:text-[#B4452F] hover:bg-[#FFF1EC] transition-colors cursor-pointer"
                                    >
                                      <Flag className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {reportedReplyIds[reply.id] ? (
                                <div className="flex items-start gap-1.5 rounded-lg bg-[#F7F4FF] px-2 py-1.5">
                                  <Flag className="w-3 h-3 text-[#7C3AED] shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-[#5B21B6] leading-relaxed">
                                    你已举报这条回复，正在进行核实。
                                    <span className="opacity-70">（内容按原样保留，不为你单方面删除别人的话）</span>
                                  </p>
                                </div>
                              ) : (
                                <p className="text-[#574B40] leading-relaxed">{reply.content}</p>
                              )}
                            </div>
                          ))
                        )}

                        {/* Inline Reply Form */}
                        <form onSubmit={(e) => handleSubmitThreadReply(thread.id, e)} className="mt-3 flex gap-2">
                          <input
                            type="text"
                            placeholder="写下你的交流想法、约练留言或求教..."
                            value={threadReplyText[thread.id] || ''}
                            onChange={(e) => setThreadReplyText({ ...threadReplyText, [thread.id]: e.target.value })}
                            className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-[#E8DACB] bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
                          />
                          <button
                            type="submit"
                            disabled={!threadReplyText[thread.id]?.trim()}
                            className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            <span>回复</span>
                          </button>
                        </form>
                      </div>
                    )}

                  </article>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW B: 我的真实舞友圈 (REAL DANCE FRIENDS)             */}
      {/* ======================================================== */}
      {activeTab === 'friends' && (
        <div className="space-y-5">
          {/* 线上好友 + 好友申请：与论坛账号打通的真实关系 */}
          <OnlineFriendsSection {...socialViewProps} />

          {/* 线下联系人：原「真实舞友 / 舞伴名册」合并后只保留这一份名单 */}
          <div className="bg-white border border-[#EFE3D5] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#292524] flex items-center gap-2">
                  <UserCheck2 className="w-5 h-5 text-[#E65B47]" />
                  <span>线下联系人</span>
                </h3>
                <span className="text-xs bg-[#FFEFE8] text-[#D94834] px-2 py-0.5 rounded-full font-bold">
                  {realFriends.length} 位常聚伙伴
                </span>
              </div>
              <p className="text-xs text-[#78695C] mt-1">
                记录线下舞室一起上课、互相录视频复盘的朋友（原「舞伴名册」已并入这里）。支持一键复制微信与在论坛发帖约练。
              </p>
            </div>

            <button
              onClick={openNewFriendModal}
              className="px-4 py-2.5 bg-[#FF7E67] hover:bg-[#E65B47] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 self-start sm:self-auto transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ 添加现实中的舞伴</span>
            </button>
          </div>

          {/* Real Friends Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300">
            {realFriends.length === 0 ? (
              <div className="col-span-full py-12 px-4 text-center bg-white border border-dashed border-[#E8DACB] rounded-3xl">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FFF2EA] text-[#E65B47] flex items-center justify-center mb-3">
                  <UserCheck2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#292524]">暂无真实舞友档案</h4>
                <p className="text-xs text-[#8C7A6B] mt-1 max-w-sm mx-auto">
                  这里会实时记录你新增的真实舞友，支持编辑、删除与在论坛一键约练。
                </p>
                <button
                  onClick={openNewFriendModal}
                  className="mt-4 px-4 py-2 bg-[#FF7E67] hover:bg-[#E65B47] text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  + 添加现实中的舞伴
                </button>
              </div>
            ) : (
              realFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="bg-white border border-[#EFE3D5] rounded-3xl p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl ${friend.avatarBg} font-display font-bold text-lg flex items-center justify-center shrink-0 border border-black/5`}>
                          {friend.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#292524]">{friend.name}</h4>
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              friend.status === '在线'
                                ? 'bg-emerald-50 text-emerald-700'
                                : friend.status === '练舞中'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                friend.status === '在线' ? 'bg-emerald-500' : friend.status === '练舞中' ? 'bg-amber-500' : 'bg-slate-400'
                              }`} />
                              {friend.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#8C7A6B] mt-0.5">{friend.danceStyle}</p>
                          {friend.createdAt && (
                            <p className="text-[10px] text-[#B0A090] mt-0.5">记录于 {formatRecordDate(friend.createdAt)}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditFriend(friend)}
                          className="w-7 h-7 flex items-center justify-center rounded-xl text-[#A8988A] hover:text-[#7C3AED] hover:bg-[#F3EEFF] border border-transparent hover:border-[#DDD0FA] transition-all duration-200 cursor-pointer"
                          title="编辑舞友档案"
                          aria-label={`编辑舞伴 ${friend.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setFriendToDelete(friend);
                            setDeletePermissionConfirmed(false);
                          }}
                          className="w-7 h-7 flex items-center justify-center rounded-xl text-[#B8A89A] hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all duration-200 cursor-pointer group/del shrink-0"
                          title="永久彻底删除舞友记录 (不可恢复)"
                          aria-label={`永久彻底删除舞伴 ${friend.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-stone-400 group-hover/del:text-rose-600 transition-transform duration-200 group-hover/del:scale-110 shrink-0" />
                        </button>
                      </div>
                    </div>

                  {/* Studio & Contact */}
                  <div className="mt-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[#5C4D42] bg-[#FAF2EB] p-2.5 rounded-xl">
                      <MapPin className="w-3.5 h-3.5 text-[#FF7E67] shrink-0" />
                      <span className="truncate">常去舞室: <strong>{friend.studio}</strong></span>
                    </div>

                    {/* WeChat Contact Box with One-Click Copy */}
                    <div className="flex items-center justify-between text-xs bg-[#FFF8F3] border border-[#F6DCBE] px-3 py-2 rounded-xl">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#8C7A6B]">微信号:</span>
                        <code className="font-mono font-bold text-[#292524]">{friend.contact}</code>
                      </div>
                      <button
                        onClick={() => handleCopyContact(friend.id, friend.contact)}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg transition-all ${
                          copiedFriendId === friend.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-[#7C3AED] border border-[#E2D5FE] hover:bg-[#F3EEFF]'
                        }`}
                      >
                        {copiedFriendId === friend.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>已复制!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>复制</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Notes */}
                    {friend.notes && (
                      <p className="text-xs text-[#78695C] bg-[#FFFDF9] border border-[#F2E5D8] p-2.5 rounded-xl leading-relaxed">
                        📝 <strong>舞伴备忘:</strong> {friend.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Action: Invite / Post to forum */}
                <div className="mt-4 pt-3 border-t border-[#F5ECE1] flex items-center justify-between">
                  <span className="text-[11px] text-[#A8988A] truncate max-w-[180px]">
                    {friend.recentTopic || '近期有练舞动态'}
                  </span>
                  <button
                    onClick={() => openComposerWithFriend(friend.name, friend.studio)}
                    className="px-3 py-1.5 bg-[#EDE9FE] hover:bg-[#DDD0FA] text-[#6D28D9] rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>在论坛发帖约Ta</span>
                  </button>
                </div>

              </div>
            )))}
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW C: 私信（好友之间一对一会话）                       */}
      {/* ======================================================== */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          <MessagesView {...socialViewProps} />
        </div>
      )}

      {/* 论坛点头像打开的用户资料卡：加好友 / 发私信入口 */}
      <UserCardModal
        target={userCard}
        threads={threads}
        social={social}
        currentUserId={currentUserId}
        isLoggedIn={isLoggedIn}
        actions={socialActionsWithLogin}
        onClose={() => setUserCard(null)}
      />

      {/* ======================================================== */}
      {/* MODAL 1: 发布论坛新帖 / 发起约练                      */}
      {/* ======================================================== */}
      {isNewThreadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl border border-[#EADCCE] max-h-[92vh] overflow-y-auto space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#F1E5D8]">
              <h3 className="text-base sm:text-lg font-bold text-[#292524] flex items-center gap-2">
                {editingThreadId ? <Pencil className="w-5 h-5 text-[#7C3AED]" /> : <MessageSquare className="w-5 h-5 text-[#7C3AED]" />}
                <span>{editingThreadId ? '编辑论坛帖子' : '发布论坛帖子 / 舞室约练'}</span>
              </h3>
              <button
                onClick={closeThreadModal}
                className="text-sm text-[#8C7A6B] hover:text-[#292524] p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishThread} className="space-y-4">
              
              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1.5">
                  1. 选择论坛板块 *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['舞室约练', '动作拆解', '扒舞音乐', '舞友随笔'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewThreadCategory(cat)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                        newThreadCategory === cat
                          ? 'bg-[#7C3AED] text-white border-[#6D28D9] shadow-2xs'
                          : 'bg-[#FAF2EB] text-[#736357] border-[#E8DACB] hover:bg-[#F3E5D7]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1.5">
                  2. 帖子标题 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：【静安星光】周六下午拼大教室练胸部Roll与扒舞..."
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-[#E8DACB] bg-[#FFFDF9] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
                />
              </div>

              {/* If Category is 舞室约练: Additional details */}
              {newThreadCategory === '舞室约练' && (
                <div className="bg-[#FFF8F3] border border-[#F6DCBE] p-3.5 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-[#A63C29] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#E65B47]" />
                    <span>约练场地与时间信息</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-[#78695C] block mb-1">舞室地点</span>
                      <input
                        type="text"
                        value={newThreadStudio}
                        onChange={(e) => setNewThreadStudio(e.target.value)}
                        placeholder="如：星光舞蹈工作室 (静安店)"
                        className="w-full text-xs p-2 rounded-lg border border-[#E8DACB] bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#78695C] block mb-1">约练时间段</span>
                      <input
                        type="text"
                        value={newThreadDate}
                        onChange={(e) => setNewThreadDate(e.target.value)}
                        placeholder="如：本周六 14:00-16:00"
                        className="w-full text-xs p-2 rounded-lg border border-[#E8DACB] bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-[#78695C] block mb-1">期望成行人数</span>
                      <input
                        type="number"
                        min="2"
                        max="10"
                        value={newThreadTargetCount}
                        onChange={(e) => setNewThreadTargetCount(parseInt(e.target.value, 10) || 4)}
                        className="w-full text-xs p-2 rounded-lg border border-[#E8DACB] bg-white"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-[#78695C] block mb-1">费用平摊说明 (选填)</span>
                      <input
                        type="text"
                        value={newThreadCost}
                        onChange={(e) => setNewThreadCost(e.target.value)}
                        placeholder="如：场地费人均约 35 元"
                        className="w-full text-xs p-2 rounded-lg border border-[#E8DACB] bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-[#78695C] block mb-1">组织者身份说明 (选填)</span>
                    <input
                      type="text"
                      value={newThreadOrganizerNote}
                      onChange={(e) => setNewThreadOrganizerNote(e.target.value)}
                      placeholder="如：XX 舞室爵士老师 / 练舞 3 年，已组织 8 场"
                      className="w-full text-xs p-2 rounded-lg border border-[#E8DACB] bg-white"
                    />
                  </div>

                  {/* 报名闭环核心：群入口只对报名者可见，不写在正文里 */}
                  <div className="pt-2.5 border-t border-[#F6DCBE] space-y-2">
                    <span className="text-[11px] font-bold text-[#15803D] flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      活动群入口（报名后才对舞友可见）
                    </span>
                    <input
                      type="text"
                      value={newThreadGroupEntry}
                      onChange={(e) => setNewThreadGroupEntry(e.target.value)}
                      placeholder="如：微信群「周六爵士练舞」/ 群号 / 邀请链接"
                      className="w-full text-xs p-2 rounded-lg border border-[#BBF7D0] bg-[#F7FEF9]"
                    />
                    <input
                      type="text"
                      value={newThreadGroupNote}
                      onChange={(e) => setNewThreadGroupNote(e.target.value)}
                      placeholder="入群说明 (选填)，如：进群请备注报名昵称"
                      className="w-full text-xs p-2 rounded-lg border border-[#BBF7D0] bg-[#F7FEF9]"
                    />
                    <p className="text-[10px] text-[#A8988A] leading-relaxed">
                      只有报名成功的舞友能看到这里的内容。请勿在正文里直接放收款码、群二维码——
                      那样会被自动折叠，反而没人看得到。
                    </p>
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1.5">
                  3. 讨论内容 / 约练说明 *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="写下你想和舞友交流的内容、约练的练习重点（如前半段练隔离，后半段录成片），或者请教某段卡点的细节..."
                  value={newThreadContent}
                  onChange={(e) => setNewThreadContent(e.target.value)}
                  className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-[#E8DACB] bg-[#FFFDF9] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
                />
                {detectOffsite(newThreadContent) && (
                  <div className="flex items-start gap-1.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-2.5 mt-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0 mt-0.5" />
                    <span className="text-[11px] text-[#92400E] leading-relaxed">
                      正文疑似包含站外收款或私下拉群信息，发布后会被折叠。建议把群入口填到上方「活动群入口」，
                      报名成功的舞友才能看到，也更安全。
                    </span>
                  </div>
                )}
              </div>

              {/* 发布前的公约提醒：一句话 + 可点开全文，不做强制勾选 */}
              <p className="text-[11px] text-[#A8988A] text-center leading-relaxed">
                {editingThreadId ? '保存即表示同意' : '发布即表示同意'}
                <button
                  type="button"
                  onClick={() => setIsRulesOpen(true)}
                  className="mx-1 text-[#7C3AED] font-bold hover:underline cursor-pointer"
                >
                  社区公约
                </button>
                ：禁广告与站外收款，约练请写清场地、时间与费用。
              </p>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F1E5D8]">
                <button
                  type="button"
                  onClick={closeThreadModal}
                  className="px-4 py-2 text-xs font-semibold text-[#78695C] hover:bg-[#FAF2EB] rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newThreadTitle.trim() || !newThreadContent.trim()}
                  className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  {editingThreadId ? '保存修改' : '确认发布'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: 添加现实中的舞伴 (ADD REAL FRIEND)            */}
      {/* ======================================================== */}
      {isAddFriendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-[#EADCCE] space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-[#F1E5D8]">
              <h3 className="text-base font-bold text-[#292524] flex items-center gap-2">
                {editingFriendId ? <Pencil className="w-5 h-5 text-[#E65B47]" /> : <UserPlus className="w-5 h-5 text-[#E65B47]" />}
                <span>{editingFriendId ? '编辑真实舞友档案' : '添加现实中的舞友'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsAddFriendOpen(false);
                  setEditingFriendId(null);
                }}
                className="text-sm text-[#8C7A6B] hover:text-[#292524] p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRealFriend} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                  舞友昵称/姓名 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：婷婷、小敏 (舞室同桌)"
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                  微信号 / 联络方式 *
                </label>
                <input
                  type="text"
                  required
                  placeholder="如：tingting_dance、138xxxx..."
                  value={newFriendContact}
                  onChange={(e) => setNewFriendContact(e.target.value)}
                  className="w-full text-xs sm:text-sm p-2.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                    常去舞室
                  </label>
                  <input
                    type="text"
                    placeholder="如：星光静安店"
                    value={newFriendStudio}
                    onChange={(e) => setNewFriendStudio(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                    常跳风格
                  </label>
                  <input
                    type="text"
                    placeholder="如：抒情爵士、基础课"
                    value={newFriendStyle}
                    onChange={(e) => setNewFriendStyle(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                    性别 (选填)
                  </label>
                  <div className="flex gap-2">
                    {(['女', '男'] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setNewFriendGender(newFriendGender === g ? null : g)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          newFriendGender === g
                            ? 'bg-[#7C3AED] text-white border-[#6D28D9]'
                            : 'bg-[#FAF2EB] text-[#736357] border-[#E8DACB] hover:bg-[#F3E5D7]'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                    年龄 (选填)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={80}
                    placeholder="如：24"
                    value={newFriendAge}
                    onChange={(e) => setNewFriendAge(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1">
                  舞友备忘 (选填)
                </label>
                <input
                  type="text"
                  placeholder="如：周二同班上课，约好一起练习胸部Roll"
                  value={newFriendNotes}
                  onChange={(e) => setNewFriendNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#E8DACB] bg-[#FFFDF9]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1E5D8]">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddFriendOpen(false);
                    setEditingFriendId(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-[#78695C] hover:bg-[#FAF2EB] rounded-xl"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!newFriendName.trim() || !newFriendContact.trim()}
                  className="px-5 py-2 bg-[#FF7E67] hover:bg-[#E65B47] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-2xs"
                >
                  {editingFriendId ? '保存修改' : '保存舞友'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL 3: Buddy Direct Invite Modal (Legacy Directory Support) */}
      {invitedBuddy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#EADCCE] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#292524] flex items-center gap-2">
                <span>💬 发送约练邀请</span>
              </h3>
              <button
                onClick={() => setInvitedBuddy(null)}
                className="text-xs text-[#8C7A6B] hover:text-[#292524] p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FAF2EB] p-3 rounded-2xl flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full ${invitedBuddy.avatarBg} font-bold flex items-center justify-center`}>
                {invitedBuddy.initials}
              </div>
              <div>
                <span className="font-bold text-xs text-[#292524]">{invitedBuddy.name}</span>
                <p className="text-[11px] text-[#78695C]">{invitedBuddy.studio} · {invitedBuddy.style}</p>
              </div>
            </div>

            {inviteSent ? (
              <div className="text-center py-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-sm font-bold text-emerald-800">🎉 约练邀请已同步发至论坛！</span>
                <p className="text-xs text-emerald-700 mt-1">
                  舞友与同伴都将在论坛约练板块中看到你的组队信息～
                </p>
                <button
                  onClick={() => setInvitedBuddy(null)}
                  className="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded-full text-xs font-semibold"
                >
                  关闭
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-[#574B40] leading-relaxed">
                  系统已为你准备了友好的约练招呼语：
                </p>
                <div className="bg-[#FFFDF9] border border-[#E8DACB] p-3 rounded-xl text-xs text-[#6B5A4D]">
                  &quot;嗨 {invitedBuddy.name}！在「舞蹈成长日记」里看到你常在 {invitedBuddy.studio} 练舞，我也在练舞，这周末要不要一起拼个教室练基础或者扒个舞？互相拍视频纠动作～&quot;
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setInvitedBuddy(null)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-[#736357] hover:bg-[#F7EFE7]"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      setInviteSent(true);
                      const inviteThread: ForumThread = {
                        id: `thread-inv-${Date.now()}`,
                        title: `【${invitedBuddy.studio}】向 @${invitedBuddy.name} 发起舞室约练`,
                        category: '舞室约练',
                        author: selfName,
                        authorRole: selfName,
                        avatarBg: 'bg-orange-100 text-orange-700',
                        createdAt: '刚刚',
                        likes: 1,
                        isLiked: true,
                        views: 1,
                        meetup: {
                          studio: invitedBuddy.studio,
                          date: '本周末',
                          targetCount: 2,
                          joinedBuddies: [selfName, invitedBuddy.name],
                          isJoined: true,
                        },
                        content: `向 @${invitedBuddy.name} 发出约练邀请：这周末一起在 ${invitedBuddy.studio} 拼大教室练舞拍视频复盘！`,
                        replies: [
                          {
                            id: `rep-inv-${Date.now()}`,
                            author: invitedBuddy.name,
                            authorRole: '舞伴回复',
                            avatarBg: invitedBuddy.avatarBg,
                            content: `收到啦 ${selfName}！我周六下午正好有空，到时候在舞室见！👯`,
                            createdAt: '刚刚',
                            likes: 1,
                          },
                        ],
                      };
                      onCreateThread?.(inviteThread);
                    }}
                    className="px-5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold shadow-2xs"
                  >
                    确认发送邀请
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PERMANENT DELETE CONFIRMATION & PERMISSION CHECK MODAL   */}
      {/* ======================================================== */}
      {friendToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-200/60 flex flex-col gap-5 max-h-[92vh] overflow-y-auto animate-scaleUp">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-stone-900">
                      永久彻底删除舞友记录
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      不可逆物理抹除
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    从本地数据存储中永久销毁，并级联清理关联引用
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isDeletingFriend) {
                    setFriendToDelete(null);
                    setDeletePermissionConfirmed(false);
                  }
                }}
                disabled={isDeletingFriend}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Friend Summary Card */}
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${friendToDelete.avatarBg} font-display font-bold text-sm flex items-center justify-center shrink-0 border border-black/5`}>
                  {friendToDelete.name.slice(0, 1)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-stone-900">{friendToDelete.name}</h4>
                  <p className="text-[11px] text-stone-500">{friendToDelete.danceStyle} · {friendToDelete.studio}</p>
                </div>
              </div>
              <span className="text-xs font-mono text-stone-600 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
                微信号: {friendToDelete.contact}
              </span>
            </div>

            {/* Permanent Destruction & Cascade Cleanup Details */}
            <div className="space-y-2 text-xs bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 text-rose-950">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <Database className="w-4 h-4 text-rose-600 shrink-0" />
                <span>永久销毁与级联清理说明：</span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-[11px] text-rose-900/90 pl-1">
                <li>
                  <strong>物理抹除</strong>：该舞友数据将从本地 IndexedDB 与永久数据仓库中<strong>永久物理删除</strong>，并非软删除或状态标记，删除后无法找回或恢复。
                </li>
                <li>
                  <strong>关联引用清理</strong>：系统将全面排查所有论坛约练活动（如已报名的拼舞室名单），自动移除该舞伴的姓名引用，<strong>彻底防止产生孤儿脏数据</strong>。
                </li>
              </ul>
            </div>

            {/* Permission Check & Authorization Guard */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>操作权限校验 (Permission Check)</span>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                  {selfName} (空间主人)
                </span>
              </div>
              <p className="text-[11px] text-amber-800/90">
                当前用户已通过空间所有者权限校验。为防止误触，请勾选确认声明以激活永久销毁指令：
              </p>
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white border border-amber-200/80 cursor-pointer hover:border-amber-300 transition-colors">
                <input
                  type="checkbox"
                  checked={deletePermissionConfirmed}
                  onChange={(e) => setDeletePermissionConfirmed(e.target.checked)}
                  disabled={isDeletingFriend}
                  className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-stone-300 cursor-pointer"
                />
                <span className="text-xs text-stone-800 font-medium leading-relaxed">
                  我已确认拥有管理权限，并明确知晓本操作将<strong>永久抹除该档案及全部活动引用</strong>，数据不可挽回。
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setFriendToDelete(null);
                  setDeletePermissionConfirmed(false);
                }}
                disabled={isDeletingFriend}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                取消保留
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                disabled={!deletePermissionConfirmed || isDeletingFriend}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer"
              >
                {isDeletingFriend ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>正在执行物理抹除...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>确认永久彻底删除</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating toast notification for permanent deletion feedback */}
      {deleteFeedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-stone-700 animate-slideUp backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{deleteFeedbackToast}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 社区治理：公约 / 举报 / 首次约练安全确认                 */}
      {/* ======================================================== */}
      <CommunityRules open={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      <ReportDialog
        target={reportTarget}
        currentUserName={currentUserName}
        onClose={() => setReportTarget(null)}
        onSubmitted={(t) => {
          if (t.type === 'thread') {
            setReportedThreadIds((prev) => ({ ...prev, [t.id]: true }));
          } else if (t.type === 'reply') {
            setReportedReplyIds((prev) => ({ ...prev, [t.id]: true }));
          }
        }}
      />

      <MeetupSafetyConfirm
        open={!!safetyThreadId}
        onCancel={() => setSafetyThreadId(null)}
        onConfirm={() => {
          ackMeetupSafety();
          const pendingId = safetyThreadId;
          setSafetyThreadId(null);
          if (pendingId) onToggleJoinMeetup?.(pendingId);
        }}
      />

    </div>
  );
};
