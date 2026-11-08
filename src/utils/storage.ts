import { DancePost, DanceBuddy, WallMessage, ForumThread, RealFriend } from '../types';
import {
  LEGACY_DEMO_POSTS,
  LEGACY_DEMO_BUDDIES,
  LEGACY_DEMO_MESSAGES,
  LEGACY_DEMO_THREADS,
  LEGACY_DEMO_REAL_FRIENDS,
} from '../data/initialData';

const DB_NAME = 'cici_dance_diary_db';
const DB_VERSION = 2;
const STORE_POSTS = 'posts';
const STORE_BUDDIES = 'buddies';
const STORE_MESSAGES = 'messages';
const STORE_THREADS = 'threads';
const STORE_REAL_FRIENDS = 'real_friends';

const LS_POSTS = 'cici_posts';
const LS_BUDDIES = 'cici_buddies';
const LS_MESSAGES = 'cici_messages';
const LS_THREADS = 'cici_threads';
const LS_REAL_FRIENDS = 'cici_real_friends';

/** 历史演示数据 ID，仅用于清理旧版本落库数据，不再作为初始内容写入 */
const LEGACY_POST_IDS = LEGACY_DEMO_POSTS.map((p) => p.id);
const LEGACY_BUDDY_IDS = LEGACY_DEMO_BUDDIES.map((b) => b.id);
const LEGACY_MESSAGE_IDS = LEGACY_DEMO_MESSAGES.map((m) => m.id);
const LEGACY_THREAD_IDS = LEGACY_DEMO_THREADS.map((t) => t.id);
const LEGACY_REAL_FRIEND_IDS = LEGACY_DEMO_REAL_FRIENDS.map((f) => f.id);

/**
 * 帖子字段兜底
 *
 * 数据有三个来源：本机 IndexedDB、云端 jsonb、早期版本遗留。任何一处缺字段
 * （老记录没有 notes、categories 被写成 null），时间线的筛选里
 * `post.notes.toLowerCase()` 就会抛错 —— 一条旧记录足以让整个日记白屏打不开。
 * 这里统一补齐，宁可显示空字符串，也不要让页面崩掉。
 */
export function normalizePost(p: DancePost): DancePost {
  if (!p || typeof p !== 'object') return p;
  return {
    ...p,
    title: typeof p.title === 'string' ? p.title : '',
    notes: typeof p.notes === 'string' ? p.notes : '',
    categories: Array.isArray(p.categories) ? p.categories.filter((c) => typeof c === 'string') : [],
    mediaType: p.mediaType === 'video' || p.mediaType === 'image' ? p.mediaType : 'text',
    mediaUrl: typeof p.mediaUrl === 'string' ? p.mediaUrl : '',
    date: typeof p.date === 'string' ? p.date : '',
    likes: typeof p.likes === 'number' ? p.likes : 0,
    comments: Array.isArray(p.comments) ? p.comments : [],
    stage: p.stage || '入门',
  };
}

class StorageManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error('IndexedDB not supported'));
          return;
        }
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_POSTS)) {
            db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_BUDDIES)) {
            db.createObjectStore(STORE_BUDDIES, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
            db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_THREADS)) {
            db.createObjectStore(STORE_THREADS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_REAL_FRIENDS)) {
            db.createObjectStore(STORE_REAL_FRIENDS, { keyPath: 'id' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  // --- 通用读取 / 写入 / 删除 ---

  /**
   * 读取集合：优先 IndexedDB；读取后清理历史演示记录（物理删除），
   * IndexedDB 不可用时回退到 localStorage 快照。
   */
  private async readCollection<T extends { id: string }>(
    storeName: string,
    lsKey: string,
    legacyIds: string[]
  ): Promise<T[]> {
    try {
      const db = await this.getDB();
      const items = await new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
      return await this.purgeLegacy(storeName, lsKey, items, legacyIds);
    } catch (e) {
      console.warn(`IndexedDB read fallback for ${storeName}:`, e);
      return this.readFallback<T>(lsKey, legacyIds);
    }
  }

  /** 清理旧版本写入的演示记录，保证页面从真实数据（空状态）开始 */
  private async purgeLegacy<T extends { id: string }>(
    storeName: string,
    lsKey: string,
    items: T[],
    legacyIds: string[]
  ): Promise<T[]> {
    const cleaned = items.filter((item) => !legacyIds.includes(item.id));
    if (cleaned.length === items.length) return items;

    try {
      const db = await this.getDB();
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const id of legacyIds) {
        store.delete(id);
      }
    } catch (e) {
      console.warn(`IndexedDB legacy cleanup error for ${storeName}:`, e);
    }
    // 同步兜底 localStorage，防止旧演示数据在回退时重新出现
    localStorage.setItem(lsKey, JSON.stringify(cleaned));
    return cleaned;
  }

  private readFallback<T extends { id: string }>(lsKey: string, legacyIds: string[]): T[] {
    const raw = localStorage.getItem(lsKey);
    if (!raw) {
      localStorage.setItem(lsKey, '[]');
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as T[];
      const cleaned = parsed.filter((item) => !legacyIds.includes(item.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(lsKey, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      localStorage.setItem(lsKey, '[]');
      return [];
    }
  }

  private async writeItem<T extends { id: string }>(
    storeName: string,
    lsKey: string,
    legacyIds: string[],
    item: T,
    prepend = true
  ): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch (e) {
      console.warn(`IndexedDB write fallback for ${storeName}:`, e);
    }

    const current = this.readFallback<T>(lsKey, legacyIds);
    const idx = current.findIndex((entry) => entry.id === item.id);
    if (idx >= 0) current[idx] = item;
    else if (prepend) current.unshift(item);
    else current.push(item);
    localStorage.setItem(lsKey, JSON.stringify(current));
  }

  private async writeMany<T extends { id: string }>(
    storeName: string,
    lsKey: string,
    legacyIds: string[],
    items: T[]
  ): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch (e) {
      console.warn(`IndexedDB bulk write fallback for ${storeName}:`, e);
    }
    localStorage.setItem(lsKey, JSON.stringify(items.filter((item) => !legacyIds.includes(item.id))));
  }

  private async deleteItem(
    storeName: string,
    lsKey: string,
    legacyIds: string[],
    id: string
  ): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn(`IndexedDB delete fallback for ${storeName}:`, e);
    }
    // 同时清理 localStorage 快照，避免兜底时数据复活
    const current = this.readFallback(lsKey, legacyIds).filter((item) => item.id !== id);
    localStorage.setItem(lsKey, JSON.stringify(current));
  }

  // --- Posts ---
  async getPosts(): Promise<DancePost[]> {
    const items = await this.readCollection<DancePost>(STORE_POSTS, LS_POSTS, LEGACY_POST_IDS);
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.map(normalizePost);
  }

  async savePost(post: DancePost): Promise<void> {
    await this.writeItem(STORE_POSTS, LS_POSTS, LEGACY_POST_IDS, post, true);
  }

  async deletePost(id: string): Promise<void> {
    await this.deleteItem(STORE_POSTS, LS_POSTS, LEGACY_POST_IDS, id);
  }

  // --- Buddies ---
  async getBuddies(): Promise<DanceBuddy[]> {
    return this.readCollection<DanceBuddy>(STORE_BUDDIES, LS_BUDDIES, LEGACY_BUDDY_IDS);
  }

  async saveBuddy(buddy: DanceBuddy): Promise<void> {
    await this.writeItem(STORE_BUDDIES, LS_BUDDIES, LEGACY_BUDDY_IDS, buddy, false);
  }

  async deleteBuddy(id: string): Promise<void> {
    await this.deleteItem(STORE_BUDDIES, LS_BUDDIES, LEGACY_BUDDY_IDS, id);
  }

  // --- Messages ---
  async getMessages(): Promise<WallMessage[]> {
    return this.readCollection<WallMessage>(STORE_MESSAGES, LS_MESSAGES, LEGACY_MESSAGE_IDS);
  }

  async saveMessage(msg: WallMessage): Promise<void> {
    await this.writeItem(STORE_MESSAGES, LS_MESSAGES, LEGACY_MESSAGE_IDS, msg, true);
  }

  async deleteMessage(id: string): Promise<void> {
    await this.deleteItem(STORE_MESSAGES, LS_MESSAGES, LEGACY_MESSAGE_IDS, id);
  }

  // --- Forum Threads ---
  async getThreads(): Promise<ForumThread[]> {
    return this.readCollection<ForumThread>(STORE_THREADS, LS_THREADS, LEGACY_THREAD_IDS);
  }

  async saveThread(thread: ForumThread): Promise<void> {
    await this.writeItem(STORE_THREADS, LS_THREADS, LEGACY_THREAD_IDS, thread, true);
  }

  async deleteThread(id: string): Promise<void> {
    await this.deleteItem(STORE_THREADS, LS_THREADS, LEGACY_THREAD_IDS, id);
  }

  // --- Real Friends ---
  async getRealFriends(): Promise<RealFriend[]> {
    return this.readCollection<RealFriend>(STORE_REAL_FRIENDS, LS_REAL_FRIENDS, LEGACY_REAL_FRIEND_IDS);
  }

  /**
   * 用云端数据整表覆盖本地集合（登录同步时使用）。
   * 先清空再写入，避免云端已删除的记录在本地残留。
   */
  async replaceAll(
    domain: 'posts' | 'buddies' | 'messages' | 'realFriends',
    items: { id: string }[]
  ): Promise<void> {
    const map = {
      posts: [STORE_POSTS, LS_POSTS, LEGACY_POST_IDS] as const,
      buddies: [STORE_BUDDIES, LS_BUDDIES, LEGACY_BUDDY_IDS] as const,
      messages: [STORE_MESSAGES, LS_MESSAGES, LEGACY_MESSAGE_IDS] as const,
      realFriends: [STORE_REAL_FRIENDS, LS_REAL_FRIENDS, LEGACY_REAL_FRIEND_IDS] as const,
    };
    const [storeName, lsKey, legacyIds] = map[domain];

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear();
        items.forEach((item) => store.put(item));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      localStorage.setItem(lsKey, JSON.stringify(items));
      return;
    } catch (e) {
      console.warn(`IndexedDB bulk replace fallback for ${storeName}:`, e);
    }
    localStorage.setItem(lsKey, JSON.stringify(items));
  }

  async saveRealFriend(friend: RealFriend): Promise<void> {
    await this.writeItem(STORE_REAL_FRIENDS, LS_REAL_FRIENDS, LEGACY_REAL_FRIEND_IDS, friend, true);
  }

  async permanentlyDeleteRealFriend(id: string): Promise<{ deletedFriend: RealFriend | null; cleanedThreads: ForumThread[] }> {
    // 1. 先定位记录，拿到舞友姓名用于级联清理
    const allFriends = await this.getRealFriends();
    const friendToDelete = allFriends.find((f) => f.id === id) || null;
    const friendName = friendToDelete?.name;

    // 2. 永久删除真实舞友档案
    await this.deleteItem(STORE_REAL_FRIENDS, LS_REAL_FRIENDS, LEGACY_REAL_FRIEND_IDS, id);

    // 3. 级联清理论坛约练名单中的姓名引用
    let cleanedThreads: ForumThread[] = [];
    try {
      const currentThreads = await this.getThreads();
      let threadsChanged = false;

      cleanedThreads = currentThreads.map((t) => {
        if (t.meetup && friendName && t.meetup.joinedBuddies.includes(friendName)) {
          threadsChanged = true;
          const newJoined = t.meetup.joinedBuddies.filter((name) => name !== friendName);
          return {
            ...t,
            meetup: {
              ...t.meetup,
              joinedBuddies: newJoined,
              // 删除的是通讯录联系人，不应影响「我」自己的参加状态
              isJoined: t.meetup.isJoined,
            },
          };
        }
        return t;
      });

      if (threadsChanged) {
        await this.writeMany(STORE_THREADS, LS_THREADS, LEGACY_THREAD_IDS, cleanedThreads);
      } else {
        cleanedThreads = currentThreads;
      }
    } catch (e) {
      console.warn('Cascade thread cleanup error:', e);
      cleanedThreads = await this.getThreads();
    }

    return { deletedFriend: friendToDelete, cleanedThreads };
  }

  async deleteRealFriend(id: string): Promise<void> {
    await this.permanentlyDeleteRealFriend(id);
  }

  /** 清空全部本地数据，不再写入任何演示内容 */
  async resetToDefaults(): Promise<void> {
    localStorage.removeItem(LS_POSTS);
    localStorage.removeItem(LS_BUDDIES);
    localStorage.removeItem(LS_MESSAGES);
    localStorage.removeItem(LS_THREADS);
    localStorage.removeItem(LS_REAL_FRIENDS);
    try {
      const db = await this.getDB();
      const tx = db.transaction(
        [STORE_POSTS, STORE_BUDDIES, STORE_MESSAGES, STORE_THREADS, STORE_REAL_FRIENDS],
        'readwrite'
      );
      tx.objectStore(STORE_POSTS).clear();
      tx.objectStore(STORE_BUDDIES).clear();
      tx.objectStore(STORE_MESSAGES).clear();
      tx.objectStore(STORE_THREADS).clear();
      tx.objectStore(STORE_REAL_FRIENDS).clear();
    } catch (e) {
      console.warn('Reset IndexedDB fallback:', e);
    }
  }
}

export const storage = new StorageManager();
