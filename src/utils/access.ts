/**
 * 访问权限的单一事实来源（guest = 游客，member = 已登录）
 *
 * 设计原则：
 * 1. 记录类功能（时间线 / 上传 / 成长报告 / 关于我 / 节拍器）游客全量可用，
 *    数据落本机 IndexedDB，不弹登录墙 —— 首次使用的门槛降到 0。
 * 2. 涉及「和别人产生关系」的功能（论坛发帖回帖、好友、私信）必须登录，
 *    因为需要真实身份、也需要防刷；论坛只给少量公开预览。
 * 3. 同步是登录用户的增值项，不是使用前提。
 *
 * 所有 UI 上的权限文案都从这里取，避免「同一个功能在两个页面说法不一样」。
 */

export type AccessLevel = 'full' | 'local' | 'preview' | 'locked';

export interface AccessCell {
  level: AccessLevel;
  text: string;
}

export interface AccessRow {
  module: string;
  hint?: string;
  guest: AccessCell;
  member: AccessCell;
}

/** 游客在论坛能看到的公开话题条数：足够判断「这里有人」，又不足以替代登录 */
export const GUEST_FORUM_PREVIEW_LIMIT = 3;

export const ACCESS_ROWS: AccessRow[] = [
  {
    module: '时间线 / 作品记录',
    hint: '只有你自己能看到',
    guest: { level: 'full', text: '本机保存' },
    member: { level: 'full', text: '云端同步' },
  },
  {
    module: '上传视频 / 照片 / 文字',
    hint: '视频文件始终留在本机',
    guest: { level: 'full', text: '不限条数' },
    member: { level: 'full', text: '记录云同步' },
  },
  {
    module: '成长报告 / 技能打卡',
    guest: { level: 'full', text: '本地统计' },
    member: { level: 'full', text: '跨设备一致' },
  },
  {
    module: '关于我 / 头像 / 昵称',
    guest: { level: 'full', text: '本机生效' },
    member: { level: 'full', text: '跟账号走' },
  },
  {
    module: '8-Count 节拍器',
    guest: { level: 'full', text: '可用' },
    member: { level: 'full', text: '可用' },
  },
  {
    module: '舞友论坛 · 浏览',
    hint: '只展示少量公开信息',
    guest: { level: 'preview', text: `${GUEST_FORUM_PREVIEW_LIMIT} 条预览` },
    member: { level: 'full', text: '全部话题' },
  },
  {
    module: '发帖 / 回帖 / 点赞 / 报名',
    guest: { level: 'locked', text: '需登录' },
    member: { level: 'full', text: '可用' },
  },
  {
    module: '舞友（好友申请）',
    guest: { level: 'locked', text: '需登录' },
    member: { level: 'full', text: '可用' },
  },
  {
    module: '私信',
    guest: { level: 'locked', text: '需登录' },
    member: { level: 'full', text: '仅好友可见' },
  },
  {
    module: '换设备继续记录',
    guest: { level: 'locked', text: '不跟随' },
    member: { level: 'full', text: '自动拉回' },
  },
];

/** 数据同步机制的说明文案（权限弹窗、游客提示条共用） */
export const SYNC_NOTES: { title: string; body: string }[] = [
  {
    title: '游客期间：写入本机',
    body: '记录、打卡、头像、标签都直接存进这台设备的 IndexedDB，关掉网页再打开还在。视频文件不会上传，只留在本机。',
  },
  {
    title: '首次登录：自动并入账号',
    body: '登录那一刻，本机已有记录会被合并上传到你的账号（同名记录以云端为准，不会重复、不会丢），并入成功后开始云端同步。',
  },
  {
    title: '登录之后：改动即同步',
    body: '每次修改约 0.7 秒防抖推送到云端；断网时先存本机，网络恢复自动补推。换设备登录同一手机号即可拉回。',
  },
  {
    title: '退出登录：本机保留',
    body: '退出后回到游客状态，本机数据不会删除，重新登录同一账号继续同步。若在同一台设备登录另一个账号，为避免串号会清空本机数据。',
  },
];

/** 权限级别的配色：full 绿 / local 米 / preview 紫 / locked 橙 */
export function accessStyle(level: AccessLevel): string {
  switch (level) {
    case 'full':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'local':
      return 'bg-[#FFF6E8] text-[#9A6A20] border-[#F2DFC0]';
    case 'preview':
      return 'bg-[#F5F0FF] text-[#6D28D9] border-[#DDD0FA]';
    default:
      return 'bg-[#FFF1EC] text-[#B4452F] border-[#FFD5C8]';
  }
}

export function accessIcon(level: AccessLevel): 'check' | 'lock' | 'eye' {
  if (level === 'locked') return 'lock';
  if (level === 'preview') return 'eye';
  return 'check';
}
