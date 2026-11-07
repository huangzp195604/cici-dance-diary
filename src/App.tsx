/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { GrooveMetronome } from './components/GrooveMetronome';
import { Timeline } from './components/Timeline';
import { UploadForm } from './components/UploadForm';
import { DanceBuddies } from './components/DanceBuddies';
import { AboutMe } from './components/AboutMe';
import { GrowthReport } from './components/GrowthReport';
import { MediaModal } from './components/MediaModal';
import { DancePost, DanceBuddy, WallMessage, ForumThread, RealFriend } from './types';
import { storage } from './utils/storage';
import { metronomeInstance } from './utils/audio';
import { useAuth, displayName } from './hooks/useAuth';
import { LoginModal } from './components/LoginModal';
import * as forumApi from './services/forumApi';

const TAB_KEYS = ['timeline', 'upload', 'buddies', 'growth', 'about'] as const;
type TabKey = (typeof TAB_KEYS)[number];

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
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [toast, setToast] = useState('');

  // 云端登录状态（会话自动恢复）
  const { user, ready, sendCode, verifyCode, signOut } = useAuth();
  const [userAvatar, setUserAvatar] = useState<string | null>(() => {
    return localStorage.getItem('cici_user_avatar') || '/assets/aistudio/image_f83d6670.png';
  });

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

  // 轻提示（自动消失）
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  /** 论坛写操作统一走这道门：未登录先弹登录框 */
  const requireLogin = (): boolean => {
    if (user) return true;
    setIsLoginOpen(true);
    return false;
  };

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
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPost?.id === postId) {
        setSelectedPost(null);
      }
    } catch (err) {
      console.error('Failed to permanently delete post:', err);
      throw err;
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
      author: 'Cici (普通爱好者)',
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
      author: 'Cici (普通爱好者)',
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
      await forumApi.createThread(thread, user!);
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
      await forumApi.toggleLike(threadId, user!);
    } catch (err: any) {
      setToast(err.message || '操作失败');
      await refreshForum();
    }
  };

  const handleAddThreadReply = async (threadId: string, replyText: string) => {
    if (!requireLogin()) return;
    try {
      await forumApi.addReply(threadId, replyText, user!);
      await refreshForum();
    } catch (err: any) {
      setToast(err.message || '回帖失败，请重试');
      throw err;
    }
  };

  const handleToggleJoinMeetup = async (threadId: string) => {
    if (!requireLogin()) return;
    try {
      await forumApi.toggleJoin(threadId, user!);
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
        userName={ready ? (user ? displayName(user) : null) : undefined}
        onLogin={() => setIsLoginOpen(true)}
        onLogout={async () => {
          await signOut();
          setToast('已退出登录');
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
            />
          </>
        )}

        {activeTab === 'growth' && (
          <GrowthReport onGoCheckIn={() => navigate('about')} />
        )}

        {activeTab === 'about' && (
          <AboutMe
            posts={posts}
            userAvatar={userAvatar}
            onUpdateAvatar={setUserAvatar}
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
        onSuccess={() => setToast('✨ 登录成功，欢迎加入舞友论坛！')}
        sendCode={sendCode}
        verifyCode={verifyCode}
      />

      {/* 7. 轻提示 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl bg-[#292524]/90 text-white text-sm font-medium shadow-2xl backdrop-blur-sm animate-[fadeIn_.2s_ease-out]">
          {toast}
        </div>
      )}

    </div>
  );
}
