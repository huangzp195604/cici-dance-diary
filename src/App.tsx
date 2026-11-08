/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { GrooveMetronome } from './components/GrooveMetronome';
import { Timeline } from './components/Timeline';
import { UploadForm } from './components/UploadForm';
import { DanceBuddies } from './components/DanceBuddies';
import { AboutMe, DEFAULT_ABOUT_PROFILE } from './components/AboutMe';
import { GrowthReport } from './components/GrowthReport';
import { MediaModal } from './components/MediaModal';
import { DancePost, DanceBuddy, WallMessage, ForumThread, RealFriend } from './types';
import { storage } from './utils/storage';
import { deleteMediaForPost } from './utils/mediaStore';
import { metronomeInstance } from './utils/audio';
import { useAuth, displayName } from './hooks/useAuth';
import { LoginModal } from './components/LoginModal';
import { ProfileModal } from './components/ProfileModal';
import * as forumApi from './services/forumApi';
import * as userDataApi from './services/userDataApi';
import * as socialApi from './services/socialApi';
import { setSyncUser, prepareForUser, syncAllDomains, queuePush, flush, syncSetItem } from './utils/sync';
import { isManualSignOut } from './utils/authSession';
import { LogoutConfirmDialog } from './components/LogoutConfirmDialog';
import type { SocialData, UserProfile } from './types';
import type { SocialActions } from './components/SocialViews';

const TAB_KEYS = ['timeline', 'upload', 'buddies', 'growth', 'about'] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** 用户主动跳过登录后，6 小时内不再自动打扰；换 key 让旧的 sessionStorage 标记失效 */
const LOGIN_SKIP_KEY = 'cici_login_skipped_at_v2';

/**
 * 把昵称写进本地「关于我」域。
 * 保留 roleStage / bioText / habitTags 等其余字段，只覆盖 nickname；
 * syncSetItem 会顺带把 about 域推上云，未登录时也能先落地、登录后由对账补推。
 */
function writeAboutNickname(name: string): void {
  try {
    const raw = localStorage.getItem('cici_about_profile');
    const parsed = raw ? JSON.parse(raw) : null;
    syncSetItem(
      'cici_about_profile',
      JSON.stringify({
        ...DEFAULT_ABOUT_PROFILE,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        nickname: name,
      })
    );
  } catch {
    // 本地存储不可用时也不阻断改名
  }
}
const LOGIN_SKIP_WINDOW_MS = 6 * 60 * 60 * 1000;
/** 会话恢复异常时，最多再等这么久就无条件放行首屏登录引导 */
const AUTH_FALLBACK_MS = 3000;

/** 从 URL hash 还原标签页，便于直接分享 /#growth 这类深链 */
const readTabFromHash = (): TabKey => {
  if (typeof window === 'undefined') return 'timeline';
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (TAB_KEYS as readonly string[]).includes(raw) ? (raw as TabKey) : 'timeline';
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>(readTabFromHash);

  // 标签页与 URL hash 双向同步
  const navigate = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.history.replaceState(null, '', `#${tab}`);
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => setActiveTab(readTabFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [posts, setPosts] = useState<DancePost[]>([]);
  const [buddies, setBuddies] = useState<DanceBuddy[]>([]);
  const [messages, setMessages] = useState<WallMessage[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [realFriends, setRealFriends] = useState<RealFriend[]>([]);
  const [selectedPost, setSelectedPost] = useState<DancePost | null>(null);
  const [forumError, setForumError] = useState('');
  const [forumLoading, setForumLoading] = useState(true);
  /** 好友关系 / 私信 / 会话：只在登录后从云端拉取 */
  const [social, setSocial] = useState<SocialData | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState('');
  const [activeChatPeerId, setActiveChatPeerId] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  /** 退出登录必须二次确认：手机上退出图标紧挨昵称按钮，误触率很高 */
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  /** 会话恢复兜底定时器到点；为 true 时即使 ready 仍为 false 也要弹登录引导 */
  const [authWaitDone, setAuthWaitDone] = useState(false);
  /** 本次弹窗是否由系统自动打开（会话迟到恢复为已登录时需要自动收起） */
  const autoPromptedRef = useRef(false);
  const [toast, setToast] = useState('');

  // 云端登录状态（会话自动恢复）
  const { user, ready, authHint, sendCode, verifyCode, signOut } = useAuth();
  const [userAvatar, setUserAvatar] = useState<string | null>(() => {
    return localStorage.getItem('cici_user_avatar') || '/assets/aistudio/image_f83d6670.png';
  });

  // 个人资料（昵称/性别/年龄）与同步状态
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  /**
   * 昵称唯一权威源：登录后以云端 profiles.nickname 为准，未登录回退本地「关于我」。
   * 时间线、关于我、成长报告、导航栏、论坛都读这一个值，避免「同一个人三个名字」。
   */
  const [localNickname, setLocalNickname] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('cici_about_profile');
      const parsed = raw ? JSON.parse(raw) : null;
      return typeof parsed?.nickname === 'string' && parsed.nickname.trim()
        ? parsed.nickname
        : DEFAULT_ABOUT_PROFILE.nickname;
    } catch {
      return DEFAULT_ABOUT_PROFILE.nickname;
    }
  });
  const displayNickname = profile?.nickname || localNickname;

  /** 「关于我」里改昵称：本机即时生效，已登录则同步写云端 profiles 供跨设备使用 */
  const handleNicknameChange = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setLocalNickname(trimmed);
      writeAboutNickname(trimmed);
      if (!user) return;
      // 乐观更新：离线 / 云端写入失败时也先让全站显示新名字，不卡住界面
      setProfile((prev) => ({
        user_id: user.id,
        nickname: trimmed,
        gender: prev?.gender ?? null,
        age: prev?.age ?? null,
      }));
      try {
        await userDataApi.saveProfile(user.id, {
          nickname: trimmed,
          gender: profile?.gender ?? null,
          age: profile?.age ?? null,
        });
      } catch {
        setToast('昵称已在本机更新，云端同步失败，请稍后重试');
      }
    },
    [user, profile]
  );
  const [profileRequired, setProfileRequired] = useState(false);
  /** 云端数据拉取完成前不允许反向推送，否则会用旧本地数据覆盖云端 */
  const [cloudHydrated, setCloudHydrated] = useState(false);

  // Metronome states
  const [metronomeActive, setMetronomeActive] = useState<boolean>(false);
  const [metronomeBeat, setMetronomeBeat] = useState<number>(0);
  const [bpm, setBpm] = useState<number>(92);
  const [isMetronomeBarOpen, setIsMetronomeBarOpen] = useState<boolean>(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      const loadedPosts = await storage.getPosts();
      const loadedBuddies = await storage.getBuddies();
      const loadedMessages = await storage.getMessages();
      const loadedFriends = await storage.getRealFriends();
      setPosts(loadedPosts);
      setBuddies(loadedBuddies);
      setMessages(loadedMessages);
      setRealFriends(loadedFriends);
    }
    loadData();

    // Setup metronome listener
    metronomeInstance.setOnBeat((count) => {
      setMetronomeBeat(count);
    });

    // Listen for avatar updates in localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cici_user_avatar') {
        setUserAvatar(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      metronomeInstance.stop();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ---- 全站数据同步：登录后拉云端覆盖本地；未登录继续用本地 ----
  useEffect(() => {
    if (!ready) return;

    if (!user) {
      setSyncUser(null);
      setCloudHydrated(false);
      setProfile(null);
      setIsLogoutConfirmOpen(false);
      sessionStorage.removeItem('cici_sync_reloaded');
      sessionStorage.removeItem('cici_sync_reload_fp');
      return;
    }

    let cancelled = false;
    setSyncUser(user.id);

    (async () => {
      // 换账号：先清空本地集合数据，避免把上一个账号的数据推到新账号
      const switched = prepareForUser(user.id);
      if (switched) {
        await storage.resetToDefaults();
        if (cancelled) return;
        setPosts([]);
        setBuddies([]);
        setMessages([]);
        setRealFriends([]);
      }

      try {
        // 双向对账：云端优先拉回本地，同时把「从没上过云」或「离线改得更新」
        // 的本地域补推到云端，头像 / 自定义标签 / 技能打卡等不会再换设备就丢
        const { changedDomains, uploadedDomains, data } = await syncAllDomains();
        if (cancelled) return;
        if (uploadedDomains.length > 0) {
          console.info('已补齐云端缺失的数据域：', uploadedDomains.join(', '));
        }

        const cloudPosts = data['posts'];
        if (Array.isArray(cloudPosts)) {
          await storage.replaceAll('posts', cloudPosts as DancePost[]);
          if (!cancelled) setPosts(cloudPosts as DancePost[]);
        }
        const cloudBuddies = data['buddies'];
        if (Array.isArray(cloudBuddies)) {
          await storage.replaceAll('buddies', cloudBuddies as DanceBuddy[]);
          if (!cancelled) setBuddies(cloudBuddies as DanceBuddy[]);
        }
        const cloudMessages = data['messages'];
        if (Array.isArray(cloudMessages)) {
          await storage.replaceAll('messages', cloudMessages as WallMessage[]);
          if (!cancelled) setMessages(cloudMessages as WallMessage[]);
        }
        const cloudFriends = data['realFriends'];
        if (Array.isArray(cloudFriends)) {
          await storage.replaceAll('realFriends', cloudFriends as RealFriend[]);
          if (!cancelled) setRealFriends(cloudFriends as RealFriend[]);
        }

        // 资料：昵称为空时强制补填，否则论坛里只能显示「舞友」
        const loadedProfile = await userDataApi.fetchProfile(user.id);
        if (cancelled) return;
        setProfile(loadedProfile);
        if (loadedProfile?.nickname) {
          setLocalNickname(loadedProfile.nickname);
          // 账号昵称是权威：换设备登录后，把本地「关于我」里的旧昵称一起校正并推上云
          try {
            const raw = localStorage.getItem('cici_about_profile');
            const parsed = raw ? JSON.parse(raw) : null;
            if (!parsed || parsed.nickname !== loadedProfile.nickname) {
              writeAboutNickname(loadedProfile.nickname);
            }
          } catch {
            writeAboutNickname(loadedProfile.nickname);
          }
        } else {
          setProfileRequired(true);
          setIsProfileOpen(true);
        }

        // 技能打卡 / 关于我 / 头像等在组件里从 localStorage 初始化 state，
        // 云端写回本地后要重载一次才能生效。用「用户 + 变更域」指纹防死循环，
        // 同时允许退出再登录 / 换账号时重新刷新，不再整个会话只 reload 一次。
        if (changedDomains.length > 0) {
          const fingerprint = `${user.id}|${[...changedDomains].sort().join(',')}`;
          if (sessionStorage.getItem('cici_sync_reload_fp') !== fingerprint) {
            sessionStorage.setItem('cici_sync_reload_fp', fingerprint);
            window.location.reload();
            return;
          }
        }

        setUserAvatar(localStorage.getItem('cici_user_avatar') || '/assets/aistudio/image_f83d6670.png');
        setCloudHydrated(true);
      } catch (err) {
        console.warn('云端数据同步失败，继续使用本地数据', err);
        if (!cancelled) {
          setCloudHydrated(true);
          setToast('云端数据同步失败，当前显示本地数据');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  // ---- 集合型数据变更 → 防抖推送云端（必须在拉取完成之后）----
  useEffect(() => {
    if (!cloudHydrated || !user) return;
    queuePush('posts', posts);
  }, [posts, cloudHydrated, user]);

  useEffect(() => {
    if (!cloudHydrated || !user) return;
    queuePush('buddies', buddies);
  }, [buddies, cloudHydrated, user]);

  useEffect(() => {
    if (!cloudHydrated || !user) return;
    queuePush('messages', messages);
  }, [messages, cloudHydrated, user]);

  useEffect(() => {
    if (!cloudHydrated || !user) return;
    queuePush('realFriends', realFriends);
  }, [realFriends, cloudHydrated, user]);

  // ---- 论坛：数据源在云端，登录状态变化后重拉（点赞/报名状态与本人绑定）----
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function loadForum() {
      setForumLoading(true);
      try {
        const cloudThreads = await forumApi.fetchForum(user ?? null);
        if (!cancelled) {
          setThreads(cloudThreads);
          setForumError('');
        }
      } catch (err: any) {
        if (!cancelled) setForumError(err.message || '论坛加载失败');
      } finally {
        if (!cancelled) setForumLoading(false);
      }
    }
    loadForum();

    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  // ---- 好友与私信：登录后拉取，停留在论坛页时轻量轮询 ----
  const refreshSocial = useCallback(async (silent = false) => {
    if (!user) {
      setSocial(null);
      setSocialError('');
      return;
    }
    if (!silent) setSocialLoading(true);
    try {
      const data = await socialApi.fetchSocial(user);
      setSocial(data);
      setSocialError('');
    } catch (err: any) {
      setSocialError(err.message || '好友数据加载失败');
    } finally {
      if (!silent) setSocialLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!ready || !user) {
      setSocial(null);
      setActiveChatPeerId(null);
      return;
    }
    void refreshSocial();
    if (activeTab !== 'buddies') return;
    const timer = window.setInterval(() => void refreshSocial(true), 10000);
    return () => window.clearInterval(timer);
  }, [ready, user, refreshSocial, activeTab]);

  /**
   * 旧版「舞伴名册」并入「线下联系人」：只在本地执行一次，按姓名去重。
   * 原 buddies 数据不删除（云端仍保留备份），历史记录不会丢。
   */
  useEffect(() => {
    if (!cloudHydrated || buddies.length === 0) return;
    const KEY = 'cici_contacts_merged_v1';
    if (localStorage.getItem(KEY)) return;
    const names = new Set(realFriends.map((f) => f.name.trim().toLowerCase()));
    const merged: RealFriend[] = buddies
      .filter((b) => !names.has((b.name || '').trim().toLowerCase()))
      .map((b) => ({
        id: `buddy_${b.id}`,
        name: b.name,
        contact: '',
        studio: b.studio || '',
        danceStyle: b.style || '',
        notes: b.bio || '',
        avatarBg: b.avatarBg || 'bg-indigo-100 text-indigo-700',
        initials: b.initials,
        stage: b.stage,
        followersCount: b.followersCount,
        isFollowed: b.isFollowed,
        currentPractice: b.currentPractice,
        status: '空闲',
        createdAt: b.createdAt,
        source: 'buddy',
      }));
    if (merged.length > 0) {
      setRealFriends((prev) => [...merged, ...prev]);
      setToast(`已把 ${merged.length} 位舞伴并入线下联系人`);
    }
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // 隐私模式下无法写入也不阻断
    }
  }, [cloudHydrated, buddies, realFriends]);

  const socialActions: SocialActions = useMemo(
    () => ({
      onAddFriend: async (peerId: string, note: string) => {
        if (!user) throw new Error('请先登录');
        const result = await socialApi.sendFriendRequest(peerId, note, user);
        setToast(result === 'accepted' ? '已互相加为好友，可以发私信了' : '好友申请已发出，等对方同意');
        await refreshSocial(true);
      },
      onRespond: async (relationId: string, accept: boolean) => {
        if (!user) throw new Error('请先登录');
        await socialApi.respondFriendRequest(relationId, accept, user);
        setToast(accept ? '已成为好友，可以发私信了' : '已拒绝该申请');
        await refreshSocial(true);
      },
      onRemoveFriend: async (relationId: string) => {
        await socialApi.removeFriendship(relationId);
        setToast('已删除好友关系');
        await refreshSocial(true);
      },
      onSendMessage: async (peerId: string, content: string) => {
        if (!user) throw new Error('请先登录');
        await socialApi.sendDirectMessage(peerId, content, user);
        await refreshSocial(true);
      },
      onMarkRead: (peerId: string) => {
        if (!user) return;
        void socialApi
          .markConversationRead(peerId, user)
          .then(() => refreshSocial(true))
          .catch(() => {});
      },
      onOpenChat: (peerId: string) => {
        setActiveChatPeerId(peerId);
        navigate('buddies');
      },
      onRefresh: () => {
        void refreshSocial();
      },
      onLogin: () => setIsLoginOpen(true),
    }),
    [user, refreshSocial, navigate]
  );

  // 轻提示（自动消失）
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // 会话正在校验 / 会话过期时用轻提示告知，不打断当前操作、不强行弹窗
  useEffect(() => {
    if (authHint) setToast(authHint);
  }, [authHint]);

  /**
   * 打开网页时主动引导登录。
   *
   * 真机上"没弹窗"的三个坑，这里逐一规避：
   * 1. 会话恢复请求被拦截 / 抛错 → ready 迟迟不来：加独立超时兜底放行首屏；
   *    但本地已有会话时绝不抢先判成未登录，避免「每次打开都要重登」。
   * 2. 旧实现用 sessionStorage 且"弹窗打开前"就写标记：只要页面加载过一次，
   *    哪怕弹窗因任何原因没渲染出来，整个会话都不会再弹。改为只有用户明确
   *    点关闭 /「先逛逛」才记一次跳过，并带 6 小时过期（localStorage，跨标签可查）。
   * 3. 分享链接加 ?login=1 可强制打开，方便真机验证与手动登录。
   */
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setAuthWaitDone(true), AUTH_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  const markLoginSkipped = useCallback(() => {
    autoPromptedRef.current = false;
    try {
      localStorage.setItem(LOGIN_SKIP_KEY, String(Date.now()));
    } catch {
      // 隐私模式禁用 localStorage 时不阻断本次关闭
    }
  }, []);

  useEffect(() => {
    const forceLogin = new URLSearchParams(window.location.search).has('login');
    if (forceLogin) {
      setIsLoginOpen(true);
      return;
    }
    if (user) return;
    if (!ready && !authWaitDone) return;
    // 曾登录设备遇到网络抖动 / 续期暂时失败时，useAuth 会保留已登录态并后台校准，
    // 此时 user 有值，根本不会走到这里；只有 SDK 明确清除会话后才重新引导登录。
    // 用户主动登出后也不自动打扰，登录按钮仍常驻，想登再点即可。
    if (isManualSignOut()) return;

    let skippedAt = 0;
    try {
      skippedAt = Number(localStorage.getItem(LOGIN_SKIP_KEY) || 0);
    } catch {
      // 读不到就当作从未跳过
    }
    if (skippedAt && Date.now() - skippedAt < LOGIN_SKIP_WINDOW_MS) return;

    autoPromptedRef.current = true;
    setIsLoginOpen(true);
  }, [ready, authWaitDone, user]);

  /** 超时兜底先判未登录、会话随后恢复为已登录时，收起自动弹出的登录框 */
  useEffect(() => {
    if (user && autoPromptedRef.current) {
      autoPromptedRef.current = false;
      setIsLoginOpen(false);
    }
  }, [user]);

  /** 论坛写入统一带上当前昵称：owner_name 为空会让所有人显示成「舞友」 */
  const withAuthorName = (u: { id: string; name: string }) =>
    profile?.nickname ? { ...u, name: profile.nickname } : u;

  /** 论坛写操作统一走这道门：未登录先弹登录框 */
  const requireLogin = (): boolean => {
    if (user) return true;
    setIsLoginOpen(true);
    return false;
  };

  /** 二次确认通过后才真正退出；先把待同步的数据冲刷上云，避免退出瞬间丢改动 */
  const handleConfirmLogout = useCallback(async () => {
    setIsLogoutConfirmOpen(false);
    try {
      await flush();
      sessionStorage.removeItem('cici_sync_reloaded');
      sessionStorage.removeItem('cici_sync_reload_fp');
      await signOut();
      setToast('已退出登录，本地数据已保留，重新登录同一手机号即可继续同步');
    } catch (err) {
      console.warn('退出登录失败', err);
      setToast('退出失败，请稍后重试');
    }
  }, [signOut]);

  const refreshForum = async () => {
    try {
      const cloudThreads = await forumApi.fetchForum(user ?? null);
      setThreads(cloudThreads);
      setForumError('');
    } catch (err: any) {
      setForumError(err.message || '论坛刷新失败');
    }
  };

  const handleToggleMetronome = () => {
    const nextState = metronomeInstance.toggle();
    setMetronomeActive(nextState);
    if (nextState) {
      setIsMetronomeBarOpen(true);
    }
  };

  // --- Post Operations ---
  const handleAddPost = async (newPost: DancePost) => {
    await storage.savePost(newPost);
    setPosts((prev) => [newPost, ...prev]);
    navigate('timeline');
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await storage.deletePost(postId);
      const removed = posts.find((p) => p.id === postId);
      if (removed) void deleteMediaForPost(removed.mediaUrl);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPost?.id === postId) {
        setSelectedPost(null);
      }
    } catch (err) {
      console.error('Failed to permanently delete post:', err);
      throw err;
    }
  };

  /** 保存作品标签：先持久化（IndexedDB / localStorage 快照），成功后再更新界面状态；
   *  posts 变化会自动触发云端同步，保证列表、筛选、统计与云数据一致 */
  const handleUpdatePostTags = async (postId: string, categories: string[]) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) throw new Error('作品不存在或已被删除');
    const updated: DancePost = { ...post, categories };
    await storage.savePost(updated);
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    if (selectedPost?.id === postId) {
      setSelectedPost(updated);
    }
  };

  const handleToggleLike = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const isLiked = !post.isLiked;
    const likes = isLiked ? post.likes + 1 : Math.max(0, post.likes - 1);
    const updated: DancePost = { ...post, isLiked, likes };

    await storage.savePost(updated);
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    if (selectedPost?.id === postId) {
      setSelectedPost(updated);
    }
  };

  const handleAddComment = async (postId: string, commentText: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const newComment = {
      id: `c-${Date.now()}`,
      author: displayNickname,
      avatarBg: 'bg-[#FFE4D4] text-[#E65B47]',
      content: commentText,
      createdAt: '刚刚',
      isOwner: true,
    };

    const updated: DancePost = {
      ...post,
      comments: [...post.comments, newComment],
    };

    await storage.savePost(updated);
    setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    if (selectedPost?.id === postId) {
      setSelectedPost(updated);
    }
  };

  // --- Buddy Operations ---
  const handleToggleFollow = async (buddyId: string) => {
    const buddy = buddies.find((b) => b.id === buddyId);
    if (!buddy) return;

    const isFollowed = !buddy.isFollowed;
    const followersCount = isFollowed ? buddy.followersCount + 1 : Math.max(0, buddy.followersCount - 1);
    const updated: DanceBuddy = { ...buddy, isFollowed, followersCount };

    await storage.saveBuddy(updated);
    setBuddies((prev) => prev.map((b) => (b.id === buddyId ? updated : b)));
  };

  const handleAddBuddy = async (buddy: DanceBuddy) => {
    await storage.saveBuddy(buddy);
    setBuddies((prev) => [...prev, buddy]);
  };

  const handleUpdateBuddy = async (buddy: DanceBuddy) => {
    await storage.saveBuddy(buddy);
    setBuddies((prev) => prev.map((b) => (b.id === buddy.id ? buddy : b)));
  };

  const handleDeleteBuddy = async (buddyId: string) => {
    await storage.deleteBuddy(buddyId);
    setBuddies((prev) => prev.filter((b) => b.id !== buddyId));
  };

  // --- Message Wall Operations ---
  const handleAddMessage = async (msg: WallMessage) => {
    await storage.saveMessage(msg);
    setMessages((prev) => [msg, ...prev]);
  };

  const handleToggleMessageLike = async (msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    const isLiked = !msg.isLiked;
    const likes = isLiked ? msg.likes + 1 : Math.max(0, msg.likes - 1);
    const updated: WallMessage = { ...msg, isLiked, likes };

    await storage.saveMessage(updated);
    setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
  };

  const handleAddReply = async (msgId: string, replyText: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;

    const newReply = {
      id: `r-${Date.now()}`,
      author: displayNickname,
      content: replyText,
      createdAt: '刚刚',
    };

    const updated: WallMessage = {
      ...msg,
      replies: [...msg.replies, newReply],
    };

    await storage.saveMessage(updated);
    setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)));
  };

  const handleDeleteMessage = async (msgId: string) => {
    await storage.deleteMessage(msgId);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  };

  // --- Forum Thread Operations（云端版：公开读，写入需登录，安全由 RLS 保障）---
  const handleCreateThread = async (thread: ForumThread) => {
    if (!requireLogin()) return;
    try {
      await forumApi.createThread(thread, withAuthorName(user!));
      await refreshForum();
      setToast('🎉 发帖成功，全站舞友都能看到啦');
    } catch (err: any) {
      setToast(err.message || '发帖失败，请重试');
      throw err;
    }
  };

  const handleUpdateThread = async (thread: ForumThread) => {
    try {
      await forumApi.updateThread(thread);
      await refreshForum();
    } catch (err: any) {
      setToast(err.message || '修改失败');
      throw err;
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await forumApi.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setToast('帖子已删除');
    } catch (err: any) {
      setToast(err.message || '删除失败');
      throw err;
    }
  };

  const handleToggleThreadLike = async (threadId: string) => {
    if (!requireLogin()) return;
    const target = threads.find((t) => t.id === threadId);
    if (target) {
      // 乐观更新：先翻本地状态，失败再回滚刷新
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? { ...t, isLiked: !t.isLiked, likes: t.isLiked ? Math.max(0, t.likes - 1) : t.likes + 1 }
            : t
        )
      );
    }
    try {
      await forumApi.toggleLike(threadId, withAuthorName(user!));
    } catch (err: any) {
      setToast(err.message || '操作失败');
      await refreshForum();
    }
  };

  const handleAddThreadReply = async (threadId: string, replyText: string) => {
    if (!requireLogin()) return;
    try {
      await forumApi.addReply(threadId, replyText, withAuthorName(user!));
      await refreshForum();
    } catch (err: any) {
      setToast(err.message || '回帖失败，请重试');
      throw err;
    }
  };

  const handleToggleJoinMeetup = async (threadId: string) => {
    if (!requireLogin()) return;
    try {
      await forumApi.toggleJoin(threadId, withAuthorName(user!));
      await refreshForum();
    } catch (err: any) {
      setToast(err.message || '操作失败');
      await refreshForum();
    }
  };

  // --- Real Friend Operations ---
  const handleAddRealFriend = async (friend: RealFriend) => {
    await storage.saveRealFriend(friend);
    setRealFriends((prev) => [friend, ...prev]);
  };

  const handleUpdateRealFriend = async (friend: RealFriend) => {
    await storage.saveRealFriend(friend);
    setRealFriends((prev) => prev.map((f) => (f.id === friend.id ? friend : f)));
    // 注：论坛已迁移到云端，约练报名名单以云数据库为准，不再做本地姓名联动
  };

  const handleDeleteRealFriend = async (friendId: string) => {
    await storage.permanentlyDeleteRealFriend(friendId);
    setRealFriends((prev) => prev.filter((f) => f.id !== friendId));
    // 注：论坛已迁移到云端，本地清理结果不再回写 threads，避免覆盖云端数据
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF9] bg-cream-grid selection:bg-[#FFE4D6] selection:text-[#C84B31]">
      
      {/* 1. Sticky Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigate}
        metronomeActive={metronomeActive}
        toggleMetronome={handleToggleMetronome}
        metronomeBeat={metronomeBeat}
        userAvatar={userAvatar}
        userName={ready ? (user ? profile?.nickname || displayName(user) : null) : undefined}
        onLogin={() => setIsLoginOpen(true)}
        onLogout={() => setIsLogoutConfirmOpen(true)}
        onOpenProfile={() => {
          setProfileRequired(false);
          setIsProfileOpen(true);
        }}
      />

      {/* 2. Interactive Jazz Metronome & Groove Bar (Collapsible) */}
      <GrooveMetronome
        isOpen={isMetronomeBarOpen}
        onClose={() => setIsMetronomeBarOpen(false)}
        currentBeat={metronomeBeat}
        bpm={bpm}
        setBpm={setBpm}
        isRunning={metronomeActive}
        onToggle={handleToggleMetronome}
      />

      {/* 3. Main Content Router */}
      <main className="flex-1 pb-16">
        {activeTab === 'timeline' && (
          <Timeline
            posts={posts}
            buddies={buddies}
            userAvatar={userAvatar}
            onUpdateAvatar={setUserAvatar}
            onOpenUpload={() => navigate('upload')}
            onOpenBuddies={() => navigate('buddies')}
            onSelectMedia={(post) => setSelectedPost(post)}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onDeletePost={handleDeletePost}
            onUpdatePostTags={handleUpdatePostTags}
            displayNickname={displayNickname}
          />
        )}

        {activeTab === 'upload' && (
          <UploadForm
            onAddPost={handleAddPost}
            onCancel={() => navigate('timeline')}
          />
        )}

        {activeTab === 'buddies' && (
          <>
            {forumLoading && (
              <div className="max-w-4xl mx-auto mt-4 px-4">
                <div className="rounded-2xl border border-[#F1E5D8] bg-[#FFF8F1] px-4 py-3 text-sm text-[#8C7A6B] text-center">
                  正在从云端加载舞友论坛…
                </div>
              </div>
            )}
            {forumError && (
              <div className="max-w-4xl mx-auto mt-4 px-4">
                <div className="rounded-2xl border border-[#FFD5C8] bg-[#FFF1EC] px-4 py-3 text-sm text-[#D94834] text-center">
                  论坛加载失败：{forumError}
                  <button onClick={refreshForum} className="ml-2 underline font-semibold hover:text-[#B93A28]">
                    点击重试
                  </button>
                </div>
              </div>
            )}
            <DanceBuddies
            buddies={buddies}
            messages={messages}
            threads={threads}
            realFriends={realFriends}
            onToggleFollow={handleToggleFollow}
            onAddBuddy={handleAddBuddy}
            onUpdateBuddy={handleUpdateBuddy}
            onDeleteBuddy={handleDeleteBuddy}
            onAddMessage={handleAddMessage}
            onToggleMessageLike={handleToggleMessageLike}
            onAddReply={handleAddReply}
            onCreateThread={handleCreateThread}
            onUpdateThread={handleUpdateThread}
            onDeleteThread={handleDeleteThread}
            onToggleThreadLike={handleToggleThreadLike}
            onAddThreadReply={handleAddThreadReply}
            onToggleJoinMeetup={handleToggleJoinMeetup}
            onAddRealFriend={handleAddRealFriend}
            onUpdateRealFriend={handleUpdateRealFriend}
            onDeleteRealFriend={handleDeleteRealFriend}
            currentUserName={profile?.nickname || user?.name}
            social={social}
            socialLoading={socialLoading}
            socialError={socialError}
            currentUserId={user?.id}
            isLoggedIn={!!user}
            activeChatPeerId={activeChatPeerId}
            onSelectChat={setActiveChatPeerId}
            socialActions={socialActions}
            onLoginRequired={() => setIsLoginOpen(true)}
            />
          </>
        )}

        {activeTab === 'growth' && (
          <GrowthReport onGoCheckIn={() => navigate('about')} displayNickname={displayNickname} />
        )}

        {activeTab === 'about' && (
          <AboutMe
            posts={posts}
            userAvatar={userAvatar}
            onUpdateAvatar={setUserAvatar}
            displayNickname={displayNickname}
            onNicknameChange={handleNicknameChange}
          />
        )}
      </main>

      {/* 4. Full Media Lightbox / Slow-mo Player */}
      <MediaModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        onToggleLike={handleToggleLike}
        onAddComment={handleAddComment}
      />

      {/* 5. Quiet, warm footer */}
      <footer className="border-t border-[#F0E4D7] bg-[#FFF8F1] py-8 text-center text-xs text-[#8C7A6B]">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#FFEAE0] text-[#E65B47] flex items-center justify-center font-bold text-[10px]">
              C
            </span>
            <span className="font-semibold text-[#4A3E36]">Cici&apos;s Jazz Diary</span>
            <span>· 献给所有在业余时间里热爱律动的人</span>
          </div>
          <div className="flex items-center gap-4 text-[#A8988A]">
            <span>论坛云端同步 · 数据跟账号走</span>
            <span>·</span>
            <span>Keep Dancing & Groove On 💃</span>
          </div>
        </div>
      </footer>

      {/* 6. 云端登录弹窗 */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onDismiss={() => {
          markLoginSkipped();
          setIsLoginOpen(false);
        }}
        onSuccess={() => setToast('✨ 登录成功，欢迎加入舞友论坛！')}
        sendCode={sendCode}
        verifyCode={verifyCode}
      />

      {/* 6.2 退出登录二次确认：手机上退出图标紧贴昵称按钮，必须确认才放行 */}
      <LogoutConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onCancel={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* 6.5 个人资料：昵称 / 性别 / 年龄 */}
      {user && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          userId={user.id}
          initial={profile}
          required={profileRequired}
          onSaved={async (saved) => {
            setProfile(saved);
            const savedName = saved.nickname?.trim() || DEFAULT_ABOUT_PROFILE.nickname;
            setLocalNickname(savedName);
            // 个人资料改名后，时间线 / 关于我 / 成长报告必须立刻跟着变，并随 about 域上云
            writeAboutNickname(savedName);
            setProfileRequired(false);
            setToast(`资料已保存，全站昵称已更新为「${savedName}」`);
            await refreshForum();
          }}
        />
      )}

      {/* 7. 轻提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl bg-[#292524]/90 text-white text-sm font-medium shadow-2xl backdrop-blur-sm animate-[fadeIn_.2s_ease-out]">
          {toast}
        </div>
      )}

    </div>
  );
}
