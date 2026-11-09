/**
 * 发帖 / 回复的内容校验：长度上限 + 明确违规词 + 刷屏检测
 *
 * 为什么需要：
 * 之前发帖只有「非空」一个校验，标题能写 500 字把卡片撑变形，正文能留手机号
 * 把公开区变成广告墙。举报是事后手段，发帖口才是第一道闸。
 *
 * 设计原则：
 * 1. 只拦「明确违规」的词（招代理、赌博、色情招揽），不做模糊联想，避免误伤
 *    正常的舞蹈表达；
 * 2. 站外收款/拉群仍走「提示 + 折叠」而不是硬拦（已有 detectOffsite 承担），
 *    因为真实约练确实需要群入口，硬拦会把人赶走；
 * 3. 每条提示都要说清「改哪里、怎么改」，不写「内容不合规」这种空话。
 */

/** 标题上限：一行卡片能完整显示两行的长度 */
export const THREAD_TITLE_MAX = 40;
/** 正文上限：约 1000 字中文，足够写清练习重点，又不至于变成小作文 */
export const THREAD_CONTENT_MAX = 2000;
/** 回复上限 */
export const REPLY_MAX = 500;

/** 明确违规词：命中即拦，附带可执行提示
 *  match 用于简单包含匹配；pattern 用于需要变体的（如「招舞蹈代理」「招募代理」）。
 *  只放明确违规的，不做模糊联想——「代理老师推荐」这种正常说法必须能过。
 */
const BLOCK_TERMS: Array<{ match: string; pattern?: RegExp; label: string; advice: string }> = [
  {
    match: '招代理',
    pattern: /招[^，。！？,.!?\s]{0,6}代理/,
    label: '招代理',
    advice: '社区不做生意，招代理、拉人头的内容会被删除。想推荐老师或舞室，请说清你和它的关系。',
  },
  {
    match: '代理加盟',
    label: '代理加盟',
    advice: '代理加盟属于商业推广，论坛里不能发。',
  },
  {
    match: '一件代发',
    label: '一件代发',
    advice: '一件代发、带货类内容属于广告，论坛里不能发。',
  },
  {
    match: '刷单',
    label: '刷单',
    advice: '刷单属于违规兼职信息，会被删除并可能封号。',
  },
  {
    match: '返利',
    label: '返利',
    advice: '返利、拉新奖励属于推广信息，论坛里不能发。',
  },
  {
    match: '日赚',
    label: '日赚',
    advice: '赚钱类广告不是这个社区的用途，请换一条内容。',
  },
  {
    match: '博彩',
    label: '博彩',
    advice: '博彩相关内容一律删除，并保留证据。',
  },
  {
    match: '赌博',
    label: '赌博',
    advice: '赌博相关内容一律删除，并保留证据。',
  },
  {
    match: '贷款秒批',
    label: '贷款广告',
    advice: '贷款类广告不能发。',
  },
  {
    match: '代开发票',
    label: '代开发票',
    advice: '代开发票涉嫌违法，不能发。',
  },
  {
    match: '约炮',
    label: '性邀约',
    advice: '以约练为名的性邀约会被封号，请删除后重发。',
  },
  {
    match: '包养',
    label: '性交易招揽',
    advice: '这类内容会被封号，请删除后重发。',
  },
  {
    match: '裸聊',
    label: '色情招揽',
    advice: '这类内容会被封号，请删除后重发。',
  },
];

/** 连环重复字符（刷屏）：同一字符连续 30 次以上 */
const SPAM_REPEAT = /(.)\1{29,}/;
/** 链接超过 3 条基本可以判定为广告贴 */
const LINK_RE = /https?:\/\/[^\s]+/g;
const MAX_LINKS = 3;

function firstBlockTerm(text: string): { match: string; pattern?: RegExp; label: string; advice: string } | null {
  const lower = text.toLowerCase();
  for (const item of BLOCK_TERMS) {
    if (item.pattern) {
      if (item.pattern.test(text)) return item;
      continue;
    }
    if (lower.includes(item.match.toLowerCase())) return item;
  }
  return null;
}

/** 校验帖子；返回 null 表示通过，否则返回给用户看的一句话 */
export function validateThreadInput(rawTitle: string, rawContent: string): string | null {
  const title = rawTitle.trim();
  const content = rawContent.trim();

  if (!title) return '标题还没写，至少写一句「跳什么舞、什么时候练」。';
  if (title.length > THREAD_TITLE_MAX) {
    return `标题 ${title.length} 字，超过 ${THREAD_TITLE_MAX} 字上限。写到「舞种 + 时间 + 地点」就够了，细节放正文。`;
  }
  if (!content) return '正文还没写，写点练习重点或约练安排吧。';
  if (content.length > THREAD_CONTENT_MAX) {
    return `正文 ${content.length} 字，超过 ${THREAD_CONTENT_MAX} 字上限。建议只留练习重点，其余可以拆成一条新帖。`;
  }

  const banned = firstBlockTerm(`${title}\n${content}`);
  if (banned) return `正文里有「${banned.label}」这类内容。${banned.advice}`;

  if (SPAM_REPEAT.test(content)) return '这段内容里有大段重复字符，容易被当成刷屏，改一下再发。';

  const links = content.match(LINK_RE) || [];
  if (links.length > MAX_LINKS) {
    return `正文里有 ${links.length} 条链接，看起来像广告贴。约练信息直接写在正文里，最多留 ${MAX_LINKS} 条参考链接。`;
  }

  return null;
}

/** 校验回复 */
export function validateReplyInput(rawText: string): string | null {
  const text = rawText.trim();
  if (!text) return null;
  if (text.length > REPLY_MAX) {
    return `回复 ${text.length} 字，超过 ${REPLY_MAX} 字上限，精简一下再发。`;
  }
  const banned = firstBlockTerm(text);
  if (banned) return `回复里有「${banned.label}」这类内容。${banned.advice}`;
  if (SPAM_REPEAT.test(text)) return '回复里有大段重复字符，改一下再发。';
  return null;
}

/** 字数提示：接近上限时给灰字提醒，超了变红（输入框下方用） */
export function lengthHint(current: number, max: number): { text: string; over: boolean } | null {
  if (current > max) return { text: `${current} / ${max} 字，超出 ${current - max} 字`, over: true };
  if (current > max * 0.8) return { text: `${current} / ${max} 字`, over: false };
  return null;
}
