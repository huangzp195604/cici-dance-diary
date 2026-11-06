/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { GrooveMetronome } from './components/GrooveMetronome';
import { Timeline } from './components/Timeline';
import { UploadForm } from './components/UploadForm';
import { DanceBuddies } from './components/DanceBuddies';
import { AboutMe } from './components/AboutMe';
import { MediaModal } from './components/MediaModal';
import { DancePost, DanceBuddy, WallMessage, ForumThread, RealFriend } from './types';
import { storage } from './utils/storage';
import { metronomeInstance } from './utils/audio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'upload' | 'buddies' | 'about'>('timeline');
  const [posts, setPosts] = useState<DancePost[]>([]);
  const [buddies, setBuddies] = useState<DanceBuddy[]>([]);
  const [messages, setMessages] = useState<WallMessage[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [realFriends, setRealFriends] = useState<RealFriend[]>([]);
  const [selectedPost, setSelectedPost] = useState<DancePost | null>(null);
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
      const loadedThreads = await storage.getThreads();
      const loadedFriends = await storage.getRealFriends();
      setPosts(loadedPosts);
      setBuddies(loadedBuddies);
      setMessages(loadedMessages);
      setThreads(loadedThreads);
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
    setActiveTab('timeline');
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

  // --- Forum Thread Operations ---
  const handleCreateThread = async (thread: ForumThread) => {
    await storage.saveThread(thread);
    setThreads((prev) => [thread, ...prev]);
  };

  const handleUpdateThread = async (thread: ForumThread) => {
    await storage.saveThread(thread);
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? thread : t)));
  };

  const handleDeleteThread = async (threadId: string) => {
    await storage.deleteThread(threadId);
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
  };

  const handleToggleThreadLike = async (threadId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    const isLiked = !thread.isLiked;
    const likes = isLiked ? thread.likes + 1 : Math.max(0, thread.likes - 1);
    const updated: ForumThread = { ...thread, isLiked, likes };

    await storage.saveThread(updated);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
  };

  const handleAddThreadReply = async (threadId: string, replyText: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    const newReply = {
      id: `rep-${Date.now()}`,
      author: 'Cici',
      authorRole: 'Cici',
      avatarBg: 'bg-orange-100 text-orange-700',
      content: replyText,
      createdAt: '刚刚',
      likes: 1,
      isLiked: true,
      isOwner: true,
    };

    const updated: ForumThread = {
      ...thread,
      replies: [...thread.replies, newReply],
    };

    await storage.saveThread(updated);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
  };

  const handleToggleJoinMeetup = async (threadId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread || !thread.meetup) return;

    const alreadyJoined = thread.meetup.joinedBuddies.includes('Cici');
    let newJoined: string[];
    if (alreadyJoined) {
      newJoined = thread.meetup.joinedBuddies.filter((n) => n !== 'Cici');
    } else {
      newJoined = [...thread.meetup.joinedBuddies, 'Cici'];
    }

    const updated: ForumThread = {
      ...thread,
      meetup: {
        ...thread.meetup,
        joinedBuddies: newJoined,
        isJoined: !alreadyJoined,
      },
    };

    await storage.saveThread(updated);
    setThreads((prev) => prev.map((t) => (t.id === threadId ? updated : t)));
  };

  // --- Real Friend Operations ---
  const handleAddRealFriend = async (friend: RealFriend) => {
    await storage.saveRealFriend(friend);
    setRealFriends((prev) => [friend, ...prev]);
  };

  const handleUpdateRealFriend = async (friend: RealFriend) => {
    const previous = realFriends.find((f) => f.id === friend.id);
    await storage.saveRealFriend(friend);
    setRealFriends((prev) => prev.map((f) => (f.id === friend.id ? friend : f)));

    // 姓名变更时同步更新论坛约练名单中的引用，避免出现孤儿数据
    if (previous && previous.name !== friend.name) {
      let changed = false;
      const nextThreads = threads.map((t) => {
        if (!t.meetup || !t.meetup.joinedBuddies.includes(previous.name)) return t;
        changed = true;
        return {
          ...t,
          meetup: {
            ...t.meetup,
            joinedBuddies: t.meetup.joinedBuddies.map((name) => (name === previous.name ? friend.name : name)),
          },
        };
      });
      if (changed) {
        const changedThreads = nextThreads.filter((t, idx) => t !== threads[idx]);
        await Promise.all(changedThreads.map((t) => storage.saveThread(t)));
        setThreads(nextThreads);
      }
    }
  };

  const handleDeleteRealFriend = async (friendId: string) => {
    const { cleanedThreads } = await storage.permanentlyDeleteRealFriend(friendId);
    setRealFriends((prev) => prev.filter((f) => f.id !== friendId));
    if (cleanedThreads && cleanedThreads.length > 0) {
      setThreads(cleanedThreads);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFDF9] bg-cream-grid selection:bg-[#FFE4D6] selection:text-[#C84B31]">
      
      {/* 1. Sticky Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        metronomeActive={metronomeActive}
        toggleMetronome={handleToggleMetronome}
        metronomeBeat={metronomeBeat}
        userAvatar={userAvatar}
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
            onOpenUpload={() => setActiveTab('upload')}
            onOpenBuddies={() => setActiveTab('buddies')}
            onSelectMedia={(post) => setSelectedPost(post)}
            onToggleLike={handleToggleLike}
            onAddComment={handleAddComment}
            onDeletePost={handleDeletePost}
          />
        )}

        {activeTab === 'upload' && (
          <UploadForm
            onAddPost={handleAddPost}
            onCancel={() => setActiveTab('timeline')}
          />
        )}

        {activeTab === 'buddies' && (
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
            <span>无需注册 · 本地轻量存储</span>
            <span>·</span>
            <span>Keep Dancing & Groove On 💃</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
