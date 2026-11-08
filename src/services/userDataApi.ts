/**
 * 用户数据云同步层
 *
 * 两张表各司其职：
 * - profiles   ：昵称 + 性别 + 年龄。公开可读（论坛要展示昵称），仅本人可写。
 * - user_data  ：个人私有数据的键值仓库（domain → jsonb）。RLS 只允许本人读写。
 *
 * 设计取舍：个人数据量很小、结构经常变，用「一个 domain 一行」而不是给每个
 * 实体建表——新增数据域只要加一个 domain 常量，不用改表结构。
 */
import { cloud } from './cloud';
import type { Gender, UserProfile } from '../types';

const db = cloud.database as any;

function errText(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (e?.code === '42P01') return '云端数据表尚未创建，请稍后再试';
  if (e?.code === '42501') return '没有权限访问云端数据（可能未登录）';
  return e?.message || '云端请求失败，请检查网络后重试';
}

interface ProfileRow {
  user_id: string;
  nickname: string | null;
  gender: string | null;
  age: number | null;
}

function toProfile(row: ProfileRow): UserProfile {
  return {
    user_id: row.user_id,
    nickname: row.nickname,
    gender: row.gender === '男' || row.gender === '女' ? (row.gender as Gender) : null,
    age: typeof row.age === 'number' ? row.age : null,
  };
}

/** 批量取资料（论坛一次渲染多作者，避免 N 次查询） */
export async function fetchProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, UserProfile>();
  if (unique.length === 0) return map;

  const res = await db.from('profiles').select('*').in('user_id', unique);
  if (res.error) {
    // 资料读取失败不该阻塞论坛：降级为用帖子里的 owner_name
    console.warn('读取用户资料失败，已降级', res.error);
    return map;
  }
  ((res.data || []) as unknown as ProfileRow[]).forEach((row) => map.set(row.user_id, toProfile(row)));
  return map;
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const res = await db.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (res.error) throw new Error(errText(res.error));
  return res.data ? toProfile(res.data as unknown as ProfileRow) : null;
}

/** 保存资料：不存在则创建，存在则更新（按 user_id 幂等） */
export async function saveProfile(
  userId: string,
  input: { nickname: string; gender: Gender | null; age: number | null }
): Promise<void> {
  const nickname = input.nickname.trim();
  if (!nickname) throw new Error('昵称不能为空');

  const payload = {
    nickname,
    gender: input.gender,
    age: input.age,
    updated_at: new Date().toISOString(),
  };

  const existing = await db.from('profiles').select('user_id').eq('user_id', userId).maybeSingle();
  if (existing.error) throw new Error(errText(existing.error));

  if (existing.data) {
    const upd = await db.from('profiles').update(payload).eq('user_id', userId).select();
    if (upd.error) throw new Error(errText(upd.error));
  } else {
    const ins = await db
      .from('profiles')
      .insert({ user_id: userId, ...payload })
      .select();
    if (ins.error) throw new Error(errText(ins.error));
  }
}

/** 拉取当前用户全部私有数据域 */
export async function pullUserData(): Promise<Record<string, unknown>> {
  const res = await db.from('user_data').select('domain, payload');
  if (res.error) throw new Error(errText(res.error));

  const out: Record<string, unknown> = {};
  ((res.data || []) as unknown as { domain: string; payload: unknown }[]).forEach((row) => {
    out[row.domain] = row.payload;
  });
  return out;
}

/**
 * 拉取私有数据域 + 各域的云端更新时间（毫秒时间戳）。
 * 登录时用它做「谁更新」对账：本地离线修改比云端新时，以本地为准回写云端，
 * 避免用户在没登录时改的头像 / 标签被云端旧数据反向覆盖。
 */
export async function pullUserDataWithMeta(): Promise<{
  data: Record<string, unknown>;
  meta: Record<string, number>;
}> {
  let res = await db.from('user_data').select('domain, payload, updated_at');
  // 兼容极早期建表（没有 updated_at 列）：降级为不带时间，由调用方按「云端权威」处理
  if (res.error) res = await db.from('user_data').select('domain, payload');
  if (res.error) throw new Error(errText(res.error));

  const data: Record<string, unknown> = {};
  const meta: Record<string, number> = {};
  ((res.data || []) as unknown as { domain: string; payload: unknown; updated_at?: string }[]).forEach(
    (row) => {
      data[row.domain] = row.payload;
      const ts = row.updated_at ? Date.parse(row.updated_at) : NaN;
      if (Number.isFinite(ts)) meta[row.domain] = ts;
    }
  );
  return { data, meta };
}

/** 写入单个数据域（存在则覆盖） */
export async function pushUserData(domain: string, payload: unknown): Promise<void> {
  const row = { payload: payload === undefined ? null : payload, updated_at: new Date().toISOString() };

  const existing = await db.from('user_data').select('domain').eq('domain', domain).maybeSingle();
  if (existing.error) throw new Error(errText(existing.error));

  if (existing.data) {
    const upd = await db.from('user_data').update(row).eq('domain', domain).select();
    if (upd.error) throw new Error(errText(upd.error));
  } else {
    const ins = await db.from('user_data').insert({ domain, ...row }).select();
    if (ins.error) throw new Error(errText(ins.error));
  }
}
