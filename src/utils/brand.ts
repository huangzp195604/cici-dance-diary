/**
 * 全站品牌文案的唯一来源。
 *
 * 产品定位是「每个人自己的舞蹈成长日记」，不再绑定某个具体的人或某个舞种：
 * - 用户设置过昵称：`小美的舞蹈成长日记`
 * - 未设置 / 未登录：`你的舞蹈成长日记`
 *
 * 昵称本身仍由 App 统一提供（云端 profiles → 本地 about → 空），
 * 这里只负责把它拼成品牌标题，避免各组件各写一套导致「同一个站三个名字」。
 */

/** 未设置昵称时用于展示的占位称呼，仅出现在「关于我」资料卡等需要人名的位置 */
export const FALLBACK_NICKNAME = '舞者';

/** 站点固定名（不含人名），用于浏览器标题、页脚说明、分享兜底 */
export const SITE_NAME = '舞蹈成长日记';

/** 品牌主标题：有昵称则为「XX的舞蹈成长日记」，否则为「你的舞蹈成长日记」 */
export function brandTitle(nickname?: string | null): string {
  const name = (nickname || '').trim();
  if (!name || name === FALLBACK_NICKNAME) return `你的${SITE_NAME}`;
  return `${name}的${SITE_NAME}`;
}

/** 头像占位首字：取昵称首字符，没有则用「舞」 */
export function brandInitial(nickname?: string | null): string {
  const name = (nickname || '').trim();
  return name ? Array.from(name)[0] : '舞';
}
