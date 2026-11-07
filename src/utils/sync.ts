/**
 * 本地 ↔ 云端同步层
 *
 * 策略：本地（localStorage / IndexedDB）仍是唯一读写入口，保证离线可用与首屏速度；
 * 每次写入后把对应「数据域」防抖推到云端，登录时把云端整包拉回本地。
 *
 * 防串号：换账号登录时先清空本地数据域，否则会把上一个账号的数据推到新账号。
 */
import { pullUserData, pushUserData } from '../services/userDataApi';

/** 数据域 → localStorage 键（这些是纯文本/JSON 型数据） */
export const DOMAIN_KEYS: Record<string, string> = {
  skills: 'cici_jazz_skills_v1',
  checkins: 'cici_jazz_skill_checkins_v1',
  practice: 'cici_dance_start_date',
  about: 'cici_about_profile',
  avatar: 'cici_user_avatar',
  styles: 'cici_dance_styles_v2',
  tags: 'cici_personality_tags',
  signature: 'cici_personality_signature',
  tips: 'cici_beginner_tips_v1',
};

const KEY_DOMAINS: Record<string, string> = Object.fromEntries(
  Object.entries(DOMAIN_KEYS).map(([domain, key]) => [key, domain])
);

/** IndexedDB 集合型数据域（由 App 层负责读写，sync 只负责搬运） */
export const COLLECTION_DOMAINS = ['posts', 'buddies', 'messages', 'realFriends'] as const;
export type CollectionDomain = (typeof COLLECTION_DOMAINS)[number];

const LAST_USER_KEY = 'cici_sync_last_user';
const PUSH_DELAY = 700;

let currentUserId: string | null = null;
/** 拉取云端数据写回本地时置位，避免自己触发自己推送 */
let suppress = false;
let timer: ReturnType<typeof setTimeout> | null = null;

type Pending = { fromStorage: true } | { value: unknown };
const dirty = new Map<string, Pending>();

/** localStorage 里存的可能是 JSON，也可能是裸字符串（如 base64 头像） */
function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function serializePayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload);
}

export function setSyncUser(userId: string | null): void {
  if (currentUserId !== userId) {
    dirty.clear();
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  currentUserId = userId;
}

export function getSyncUserId(): string | null {
  return currentUserId;
}

function schedule(): void {
  if (!currentUserId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, PUSH_DELAY);
}

/** 写 localStorage 并排队同步（同步场景请用它替代 localStorage.setItem） */
export function syncSetItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  if (suppress) return;
  const domain = KEY_DOMAINS[key];
  if (!domain) return;
  dirty.set(domain, { fromStorage: true });
  schedule();
}

/** 删除 localStorage 并排队同步（云端写 null 表示该域已清空） */
export function syncRemoveItem(key: string): void {
  localStorage.removeItem(key);
  if (suppress) return;
  const domain = KEY_DOMAINS[key];
  if (!domain) return;
  dirty.set(domain, { value: null });
  schedule();
}

/** 集合型数据变更时调用（payload 直接传入，避免重复读 IndexedDB） */
export function queuePush(domain: string, payload: unknown): void {
  if (!currentUserId || suppress) return;
  dirty.set(domain, { value: payload });
  schedule();
}

/** 立刻把排队中的变更推到云端 */
export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!currentUserId || dirty.size === 0) return;

  const entries = Array.from(dirty.entries());
  dirty.clear();

  await Promise.all(
    entries.map(async ([domain, pending]) => {
      let payload: unknown;
      if ('fromStorage' in pending) {
        const key = DOMAIN_KEYS[domain];
        const raw = localStorage.getItem(key);
        payload = raw === null ? null : parsePayload(raw);
      } else {
        payload = pending.value;
      }
      try {
        await pushUserData(domain, payload);
      } catch (err) {
        console.warn(`云端同步失败（${domain}），稍后重试`, err);
        if (!dirty.has(domain)) dirty.set(domain, { value: payload });
      }
    })
  );
}

/** 清空本地全部业务数据（换账号时调用，避免数据串号） */
export function clearLocalDomains(): void {
  Object.values(DOMAIN_KEYS).forEach((key) => localStorage.removeItem(key));
}

/** 换账号检测：返回 true 表示这次登录换了人，本地需要先清空 */
export function prepareForUser(userId: string): boolean {
  const last = localStorage.getItem(LAST_USER_KEY);
  const switched = !!last && last !== userId;
  if (switched) clearLocalDomains();
  localStorage.setItem(LAST_USER_KEY, userId);
  return switched;
}

/**
 * 把云端数据整包拉回本地。
 * 返回发生变化的域，调用方据此决定是否重载页面（组件多从本地初始化状态）。
 */
export async function pullAllToLocal(): Promise<{
  changedDomains: string[];
  allDomains: string[];
  data: Record<string, unknown>;
}> {
  const data = await pullUserData();
  const allDomains = Object.keys(data);
  const changedDomains: string[] = [];

  suppress = true;
  try {
    Object.entries(data).forEach(([domain, payload]) => {
      const key = DOMAIN_KEYS[domain];
      if (!key) return;
      const next = serializePayload(payload);
      if (next === null) return;
      if (localStorage.getItem(key) !== next) {
        localStorage.setItem(key, next);
        changedDomains.push(domain);
      }
    });
  } finally {
    suppress = false;
  }

  return { changedDomains, allDomains, data };
}
