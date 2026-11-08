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
import { storage, normalizePost } from './utils/storage';
import { deleteMediaForPost } from './utils/mediaStore';
import { metronomeInstance } from './utils/audio';
import { useAuth, displayName } from './hooks/useAuth';
import { LoginModal } from './components/LoginModal';
import { ProfileModal } from './components/ProfileModal';
import * as forumApi from './services/forumApi';
import * as userDataApi from './services/userDataApi';
import * as socialApi from './services/socialApi';
import {
  setSyncUser,
  prepareForUser,
  syncAllDomains,
  queuePush,
  flush,
  syncSetItem,
  isFirstBindOnDevice,
  mergeCollections,
} from './utils/sync';
import { isManualSignOut } from './utils/authSession';
import { brandTitle, brandInitial } from './utils/brand';
import { LogoutConfirmDialog } from './components/LogoutConfirmDialog';
import { GuestModeBar } from './components/GuestModeBar';
import { AccessCompareModal } from './components/AccessCompareModal';
import { LoginGateDialog } from './components/LoginGateDialog';
import { WelcomeModal } from './components/WelcomeModal';
import type { SocialData, UserProfile } from './types';
import type { SocialActions } from './components/SocialViews';

const TAB_KEYS = ['timeline', 'upload', 'buddies', 'growth', 'about'] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** 首次进入的「游客 / 登录」选择只出现一次，之后由顶部游客提示条常驻提醒 */
const WELCOME_SEEN_KEY = 'cici_guest_welcome_seen_v1';
/** 游客提示条手动收起：只对本次会话生效，下次打开仍会提醒「数据在本机」 */
const GUEST_BAR_KEY = 'cici_guest_bar_hidden_v1';

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
// 旧版自动弹窗的 6 小时跳过窗口已随「游客模式」下线，key 仅用于兼容已有本地标记
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
  /** 上传页默认的记录方式：从空状态引导点「先写一句话」时切到 text */
  const [uploadMode, setUploadMode] = useState<'media' | 'text'>('media');

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

  // 离开上传页后回到默认「传视频/照片」，避免下次从导航进入时残留文字模式
  useEffect(() => {
    if (activeTab !== 'upload') setUploadMode('media');
  }, [activeTab]);
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
  /** 首次进入的游客 / 登录二选一 */
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  /** 权限对比（游客 vs 登录）说明弹窗 */
  const [accessOpen, setAccessOpen] = useState(false);
  /** 顶部游客提示条是否被本次会话收起 */
  const [guestBarHidden, setGuestBarHidden] = useState(() => {
    try {
      return sessionStorage.getItem(GUEST_BAR_KEY) === '1';
    } catch {
      return false;
    }
  });
  /** 「这里需要登录」的提示层：先解释再给出口，不直接甩验证码 */
  const [loginGate, setLoginGate] = useState<{
    title: string;
    description: string;
    benefits?: string[];
  } | null>(null);

  // 云端登录状态（会话自动恢复）
  const { user, ready, authHint, sendCode, verifyCode, signOut } = useAuth();
  /**
   * 游客态：会话校验完成且没有账号。
   * 会话仍在恢复（ready=false）时不判游客，避免首屏闪一下「游客模式」再变回登录态。
   */
  const isGuest = ready && !user;
  const [userAvatar, setUserAvatar] = useState<string | null>(() => {
    return localStorage.getItem('cici_user_avatar') || '';
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

  // 浏览器标签页标题也跟随账号昵称，与导航栏品牌保持一致
  useEffect(() => {
    document.title = `${brandTitle(displayNickname)} | Your Dance Diary`;
  }, [displayNickname]);

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
      // 本机从没绑定过账号：本地数据就是游客自己记的，登录时并进账号而不是被覆盖
      const guestHandoff = isFirstBindOnDevice();
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
      /** 游客期间新增、账号云端还没有的记录数（用于登录后的并入提示） */
      let handoffCount = 0;

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
          // 云端 jsonb 可能来自早期版本或别的客户端，字段不一定齐；
          // 先归一化再合并，避免缺 notes 的旧记录把时间线整页打白
          const safeCloudPosts = (cloudPosts as DancePost[]).map(normalizePost);
          // 游客 → 登录：把本机独有的作品并进来，云端同 id 的以云端为准
          const { items, addedCount } = guestHandoff
            ? mergeCollections<DancePost>(await storage.getPosts(), safeCloudPosts)
            : { items: safeCloudPosts, addedCount: 0 };
          handoffCount += addedCount;
          items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          await storage.replaceAll('posts', items);
          if (!cancelled) setPosts(items);
          if (addedCount > 0) queuePush('posts', items);
        }
        const cloudBuddies = data['buddies'];
        if (Array.isArray(cloudBuddies)) {
          const { items, addedCount } = guestHandoff
            ? mergeCollections<DanceBuddy>(await storage.getBuddies(), cloudBuddies as DanceBuddy[])
            : { items: cloudBuddies as DanceBuddy[], addedCount: 0 };
          handoffCount += addedCount;
          await storage.replaceAll('buddies', items);
          if (!cancelled) setBuddies(items);
          if (addedCount > 0) queuePush('buddies', items);
        }
        const cloudMessages = data['messages'];
        if (Array.isArray(cloudMessages)) {
          const { items, addedCount } = guestHandoff
            ? mergeCollections<WallMessage>(await storage.getMessages(), cloudMessages as WallMessage[])
            : { items: cloudMessages as WallMessage[], addedCount: 0 };
          handoffCount += addedCount;
          await storage.replaceAll('messages', items);
          if (!cancelled) setMessages(items);
          if (addedCount > 0) queuePush('messages', items);
        }
        const cloudFriends = data['realFriends'];
        if (Array.isArray(cloudFriends)) {
          const { items, addedCount } = guestHandoff
            ? mergeCollections<RealFriend>(await storage.getRealFriends(), cloudFriends as RealFriend[])
            : { items: cloudFriends as RealFriend[], addedCount: 0 };
          handoffCount += addedCount;
          await storage.replaceAll('realFriends', items);
          if (!cancelled) setRealFriends(items);
          if (addedCount > 0) queuePush('realFriends', items);
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

        setUserAvatar(localStorage.getItem('cici_user_avatar') || '');
        setCloudHydrated(true);
        if (handoffCount > 0) {
          setToast(`已把游客期间的 ${handoffCount} 条记录并入你的账号，正在云端同步`);
        }
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

  // 会话恢复兜底：超时后放行首屏，避免网络慢时用户一直看白屏
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setAuthWaitDone(true), AUTH_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  /**
   * 打开网页时只做一次「游客 / 登录」选择，不再直接甩手机验证码。
   *
   * 变化原因：游客模式成为正式入口后，第一屏弹登录框会把最想试的人挡在门外。
   * 现在的规则——
   * 1. 每台设备只在第一次访问时出现选择弹窗（localStorage 记一次），关闭后不再打扰；
   * 2. 主动登出过的人不弹（他清楚登录入口在哪里）；
   * 3. 正在填写上传表单时不打断；
   * 4. 分享链接加 ?login=1 仍可强制打开登录框，便于真机验证。
   * 其余时候靠顶部游客提示条常驻提醒「数据在本机 + 可登录同步」。
   */
  useEffect(() => {
    const forceLogin = new URLSearchParams(window.location.search).has('login');
    if (forceLogin) {
      setIsLoginOpen(true);
      return;
    }
    if (user) return;
    if (!ready && !authWaitDone) return;
    if (isManualSignOut()) return;
    if (activeTab === 'upload') return;
    try {
      if (localStorage.getItem(WELCOME_SEEN_KEY)) return;
    } catch {
      // 隐私模式读不到就当作没看过，最多多弹一次
    }
    setWelcomeOpen(true);
  }, [ready, authWaitDone, user, activeTab]);

  /** 超时兜底先判未登录、会话随后恢复为已登录时，收起自动弹出的登录框与欢迎弹窗 */
  useEffect(() => {
    if (user && autoPromptedRef.current) {
      autoPromptedRef.current = false;
      setIsLoginOpen(false);
    }
    if (user) setWelcomeOpen(false);
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

  /** 游客选择「先开始记录」：记住这个选择，之后只靠顶部提示条轻提醒 */
  const startAsGuest = useCallback(() => {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // 写不进去也不影响本次使用
    }
    setWelcomeOpen(false);
  }, []);

  const dismissGuestBar = useCallback(() => {
    setGuestBarHidden(true);
    try {
      sessionStorage.setItem(GUEST_BAR_KEY, '1');
    } catch {
      // 忽略
    }
  }, []);

  /**
   * 游客点论坛帖子 / 发帖按钮：先解释「为什么这里要登录」，
   * 而不是直接甩一个验证码弹窗。权限对比入口也在提示层里。
   */
  const promptForumLogin = useCallback(() => {
    setLoginGate({
      title: '登录后查看完整帖子',
      description:
        '论坛是这里的公开区：完整正文、全部回复、约练报名名单与活动群入口只对登录舞友开放，游客只能看到少量公开预览。',
    });
  }, []);

  const openLoginFromGate = useCallback(() => {
    setLoginGate(null);
    setIsLoginOpen(true);
  }, []);

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
    // 游客写入成功但没上云：明确告诉他记录没丢，只是还在这台设备上
    if (!user) setToast('已保存到本机 · 登录后会自动并入账号');
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
        brandName={displayNickname}
        isGuest={isGuest}
        onOpenAccess={() => setAccessOpen(true)}
        onLogin={() => setIsLoginOpen(true)}
        onLogout={() => setIsLogoutConfirmOpen(true)}
        onOpenProfile={() => {
          setProfileRequired(false);
          setIsProfileOpen(true);
        }}
      />

      {/* 1.2 游客提示条：常驻说明「数据在本机」，登录只是可选升级 */}
      {isGuest && !guestBarHidden && (
        <GuestModeBar
          localRecordCount={posts.length}
          onLogin={() => setIsLoginOpen(true)}
          onShowAccess={() => setAccessOpen(true)}
          onDismiss={dismissGuestBar}
        />
      )}

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
            onOpenUpload={(mode) => {
              setUploadMode(mode ?? 'media');
              navigate('upload');
            }}
            onOpenBuddies={() => navigate('buddies')}
            onSelectMedia={(post) => setSelectedPost(post)}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onDeletePost={handleDeletePost}
            onUpdatePostTags={handleUpdatePostTags}
            displayNickname={displayNickname}
            isGuest={isGuest}
            onLogin={() => setIsLoginOpen(true)}
          />
        )}

        {activeTab === 'upload' && (
          <UploadForm
            onAddPost={handleAddPost}
            onCancel={() => navigate('timeline')}
            initialMode={uploadMode}
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
            onForumLocked={promptForumLogin}
            onShowAccess={() => setAccessOpen(true)}
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
              {brandInitial(displayNickname)}
            </span>
            <span className="font-semibold text-[#4A3E36]">{brandTitle(displayNickname)}</span>
            <span>· 个人私密成长空间，时间线仅自己可见</span>
          </div>
          <div className="flex items-center gap-3 text-[#A8988A] flex-wrap justify-center">
            <button
              type="button"
              onClick={() => setAccessOpen(true)}
              className="underline underline-offset-2 hover:text-[#6B5A4D] cursor-pointer"
            >
              {isGuest ? '游客模式 · 数据存本机' : '云同步已开启 · 数据跟账号走'}
            </button>
            <span>·</span>
            <span>论坛为公开区，需登录</span>
            <span>·</span>
            <span>Keep Dancing &amp; Groove On 💃</span>
          </div>
        </div>
      </footer>

      {/* 6. 云端登录弹窗 */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onDismiss={() => {
          autoPromptedRef.current = false;
          setIsLoginOpen(false);
        }}
        onSuccess={() => setToast('✨ 登录成功，本机记录会自动并入你的账号')}
        onShowAccess={() => setAccessOpen(true)}
        sendCode={sendCode}
        verifyCode={verifyCode}
      />

      {/* 6.1 首次访问：游客 / 登录 二选一 */}
      <WelcomeModal
        open={welcomeOpen}
        onGuest={startAsGuest}
        onLogin={() => {
          startAsGuest();
          setIsLoginOpen(true);
        }}
        onShowAccess={() => setAccessOpen(true)}
        onClose={startAsGuest}
      />

      {/* 6.15 权限差异与同步机制说明 */}
      <AccessCompareModal
        isOpen={accessOpen}
        onClose={() => setAccessOpen(false)}
        isGuest={isGuest}
        localRecordCount={posts.length}
        onLogin={() => setIsLoginOpen(true)}
      />

      {/* 6.2 论坛等需登录功能的提示层 */}
      <LoginGateDialog
        open={!!loginGate}
        title={loginGate?.title || ''}
        description={loginGate?.description || ''}
        benefits={loginGate?.benefits}
        onLogin={openLoginFromGate}
        onCancel={() => setLoginGate(null)}
        onShowAccess={() => {
          setLoginGate(null);
          setAccessOpen(true);
        }}
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
