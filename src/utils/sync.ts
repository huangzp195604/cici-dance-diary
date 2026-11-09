/**
 * 本地 ↔ 云端同步层
 *
 * 策略：本地（localStorage / IndexedDB）仍是唯一读写入口，保证离线可用与首屏速度；
 * 每次写入后把对应「数据域」防抖推到云端，登录时做一次双向对账。
 *
 * 为什么需要「对账」：集合型数据（posts/buddies/messages/realFriends）在 App 里有
 * useEffect 兜底，登录完成后一定会整包 push；但 localStorage 型数据域（头像、
 * 自定义舞种、个性标签、技能打卡…）只在写入那一刻排队。用户未登录时的写入
 * 会因为 currentUserId 为空而推不出去，登录时 dirty 又被清空，于是这些域
 * 永远上不了云，换设备就丢。syncAllDomains() 在登录后统一补齐这段历史欠账。
 *
 * 冲突规则（last-write-wins）：每个域记一个本地修改时间，云端有 updated_at。
 * - 本地修改时间晚于云端 → 以本地为准回写云端（离线编辑不丢）
 * - 否则云端有值 → 写回本地（换设备拉取）
 * - 云端没有该域、本地有值 → 补推到云端
 * - 云端该域为 null（用户删过）→ 本地也删除，不再让旧数据复活
 * 防串号：换账号登录时先清空本地数据域，否则会把上一个账号的数据推到新账号。
 */
import { pullUserData, pullUserDataWithMeta, pushUserData } from '../services/userDataApi';

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
const MTIME_KEY = 'cici_sync_local_mtime_v1';
const PUSH_DELAY = 700;

let currentUserId: string | null = null;
/** 拉取云端数据写回本地时置位，避免自己触发自己推送 */
let suppress = false;
let timer: ReturnType<typeof setTimeout> | null = null;

type Pending = { fromStorage: true } | { value: unknown };
const dirty = new Map<string, Pending>();

type LocalStamp = { at: number; deleted?: boolean };

function readStamps(): Record<string, LocalStamp> {
  try {
    return JSON.parse(localStorage.getItem(MTIME_KEY) || '{}') as Record<string, LocalStamp>;
  } catch {
    return {};
  }
}

function writeStamps(stamps: Record<string, LocalStamp>): void {
  try {
    localStorage.setItem(MTIME_KEY, JSON.stringify(stamps));
  } catch {
    // 隐私模式下写不了也不该阻断业务写入
  }
}

/** 记一次本地修改，登录对账时用来判断本地是否比云端新 */
function stamp(domain: string, deleted = false): void {
  const stamps = readStamps();
  stamps[domain] = deleted ? { at: Date.now(), deleted: true } : { at: Date.now() };
  writeStamps(stamps);
}

function clearStamp(domain: string): void {
  const stamps = readStamps();
  if (stamps[domain]) {
    delete stamps[domain];
    writeStamps(stamps);
  }
}

/** localStorage 里存的可能是 JSON，也可能是裸字符串（如 base64 头像） */
function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * 规范化比较：Postgres jsonb 会把对象键重排，直接比 JSON.stringify
 * 会把「内容完全相同」误判成变更，进而反复 reload。这里按键排序后比较。
 */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonical(raw: string | null): string | null {
  if (raw === null) return null;
  const parsed = parsePayload(raw);
  // 只有对象/数组需要按键排序；裸字符串、JSON 字符串字面量都按原文比较，
  // 否则 `"文字"` 会被解析成 `文字` 而误判成内容变了。
  if (parsed && typeof parsed === 'object') return JSON.stringify(sortDeep(parsed));
  return raw;
}

function serializePayload(payload: unknown): string | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === 'string') return payload;
  return JSON.stringify(sortDeep(payload));
}

export function setSyncUser(userId: string | null): void {
  if (currentUserId !== userId) {
    // 未登录期间的增量队列在这里丢弃是安全的：登录后 syncAllDomains() 会
    // 用「本地修改时间 vs 云端时间」做全量对账，把该补的都补上。
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

function schedule(delay = PUSH_DELAY): void {
  if (!currentUserId) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delay);
}

/** 写 localStorage 并排队同步（同步场景请用它替代 localStorage.setItem） */
export function syncSetItem(key: string, value: string): void {
  localStorage.setItem(key, value);
  if (suppress) return;
  const domain = KEY_DOMAINS[key];
  if (!domain) return;
  stamp(domain);
  dirty.set(domain, { fromStorage: true });
  schedule();
}

/** 删除 localStorage 并排队同步（云端写 null 表示该域已清空） */
export function syncRemoveItem(key: string): void {
  localStorage.removeItem(key);
  if (suppress) return;
  const domain = KEY_DOMAINS[key];
  if (!domain) return;
  stamp(domain, true);
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
        const raw = key ? localStorage.getItem(key) : null;
        payload = raw === null ? null : parsePayload(raw);
      } else {
        payload = pending.value;
      }
      try {
        await pushUserData(domain, payload);
        if (DOMAIN_KEYS[domain]) clearStamp(domain);
      } catch (err) {
        console.warn(`云端同步失败（${domain}），稍后重试`, err);
        if (!dirty.has(domain)) dirty.set(domain, { value: payload });
      }
    })
  );

  // 失败重试：网络恢复后能自动补推，但拉开间隔，离线时不至于每 0.7 秒狂发
  if (dirty.size > 0 && currentUserId) schedule(5000);
}

/** 清空本地全部业务数据（换账号时调用，避免数据串号） */
export function clearLocalDomains(): void {
  Object.values(DOMAIN_KEYS).forEach((key) => localStorage.removeItem(key));
  writeStamps({});
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
 * 本机是否还没绑定过任何账号。
 * 必须在校验登录态之前读取：它是「游客数据交接」的判定依据——
 * 这台设备从没登录过，那本地的东西一定是游客自己记的，登录时要并进账号，
 * 不能被云端整表覆盖掉。
 */
export function isFirstBindOnDevice(): boolean {
  return !localStorage.getItem(LAST_USER_KEY);
}

/**
 * 游客数据并入账号：按 id 取并集。
 * - 同 id 以云端为准（云端是账号的权威副本，避免旧本地记录把已编辑的覆盖回去）
 * - 本地独有的（游客期间新写的）排在前面，登录后第一眼就能看到
 * 返回 addedCount 用于「已并入 N 条记录」的提示。
 */
export function mergeCollections<T extends { id: string }>(local: T[], cloud: T[]): { items: T[]; addedCount: number } {
  const cloudIds = new Set(cloud.map((item) => item.id));
  const onlyLocal = local.filter((item) => !cloudIds.has(item.id));
  if (onlyLocal.length === 0) return { items: cloud, addedCount: 0 };
  return { items: [...onlyLocal, ...cloud], addedCount: onlyLocal.length };
}

/**
 * 登录后的双向对账（取代旧的单向 pullAllToLocal）。
 *
 * 返回 changedDomains（本地被云端改动，需要刷新组件 state）、
 * uploadedDomains（本地补推到云端的域）、data（云端全部域，含集合型）。
 */
export async function syncAllDomains(): Promise<{
  changedDomains: string[];
  uploadedDomains: string[];
  allDomains: string[];
  data: Record<string, unknown>;
}> {
  let result: { data: Record<string, unknown>; meta: Record<string, number> };
  try {
    result = await pullUserDataWithMeta();
  } catch (err) {
    // 云端暂时不可用时降级为只读拉取，不让对账阻断首屏
    console.warn('带时间戳的云端拉取失败，降级为普通拉取', err);
    result = { data: await pullUserData(), meta: {} };
  }

  const { data, meta } = result;
  const allDomains = Object.keys(data);
  const changedDomains: string[] = [];
  const uploadedDomains: string[] = [];
  const stamps = readStamps();

  suppress = true;
  try {
    await Promise.all(
      Object.entries(DOMAIN_KEYS).map(async ([domain, key]) => {
        const raw = localStorage.getItem(key);
        const hasCloudRow = Object.prototype.hasOwnProperty.call(data, domain);
        const cloudPayload = data[domain];
        const cloudHasValue = hasCloudRow && cloudPayload !== null && cloudPayload !== undefined;
        const cloudDeleted = hasCloudRow && (cloudPayload === null || cloudPayload === undefined);
        const cloudTime = meta[domain];
        // 只有云端确实带回时间、且本地有更晚的修改记录时，才认为本地更新
        const preferLocal = typeof cloudTime === 'number' && !!stamps[domain] && stamps[domain].at > cloudTime;

        if (preferLocal) {
          const value = stamps[domain].deleted || raw === null ? null : parsePayload(raw);
          await pushUserData(domain, value);
          uploadedDomains.push(domain);
          clearStamp(domain);
          return;
        }

        if (cloudHasValue) {
          const next = serializePayload(cloudPayload);
          if (canonical(raw) !== canonical(next)) {
            if (next === null) localStorage.removeItem(key);
            else localStorage.setItem(key, next);
            changedDomains.push(domain);
          }
          clearStamp(domain);
          return;
        }

        // 云端显式删除过：本地同步删除，避免旧数据复活
        if (cloudDeleted) {
          if (raw !== null) {
            localStorage.removeItem(key);
            changedDomains.push(domain);
          }
          clearStamp(domain);
          return;
        }

        // 云端从没有过这个域、本地有值：补推历史欠账（本次修复的核心）
        if (raw !== null && raw !== '') {
          await pushUserData(domain, parsePayload(raw));
          uploadedDomains.push(domain);
        }
        clearStamp(domain);
      })
    );
  } finally {
    suppress = false;
  }

  return { changedDomains, uploadedDomains, allDomains, data };
}

/** @deprecated 兼容旧调用名，语义已升级为双向对账 */
export const pullAllToLocal = syncAllDomains;
