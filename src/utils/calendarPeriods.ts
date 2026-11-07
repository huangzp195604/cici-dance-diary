/**
 * 自然月日历周期工具（纯函数，无 React / 浏览器依赖，便于按真实日历验证）
 *
 * 规则：
 * - 统计区间从「上月 1 号」开始，到「今天」结束；跨年、大小月、闰年由 Date 自动处理。
 * - 周次在每个自然月内从 1 号重新起算：1-7 第一周、8-14 第二周、15-21 第三周、
 *   22-28 第四周、29-月末 第五周（月末不足 7 天时该周自然缩短）。
 * - 月份归属、起始日、周次编号全部按实际日历动态计算，不写死任何天数。
 */

export const CN_MONTHS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
] as const;

export const CN_WEEK_ORDINALS = ['第一', '第二', '第三', '第四', '第五', '第六'] as const;

/** 横轴刻度落在每月 1 号及 8/15/22/29 号：每月从 1 号重新起算 */
const AXIS_TICK_DAYS = [1, 8, 15, 22, 29] as const;

const pad2 = (value: number) => String(value).padStart(2, '0');

export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const toMonthDay = (date: Date): string =>
  `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`;

export interface CalendarDay {
  /** YYYY-MM-DD，字典序等同于时间序，可直接做区间过滤 */
  dateKey: string;
  /** 横轴 / 括号里显示的 MM.DD */
  axisLabel: string;
  /** Tooltip 里的完整日期 */
  fullDateLabel: string;
  /** 中文月份，如「十一月」 */
  monthCN: string;
  /** 月份唯一键，跨年也不会串 */
  monthKey: string;
  dayOfMonth: number;
  /** 月内第几周，0 起；每月 1 号重置为 0 */
  weekIndex: number;
  /** 中文序数，如「第一」 */
  weekOrdinalCN: string;
}

export interface CalendarWeek {
  id: string;
  monthCN: string;
  weekOrdinalCN: string;
  weekIndex: number;
  /** 完整表述：十一月的第一周（11.01-11.07） */
  label: string;
  startLabel: string;
  endLabel: string;
  dateKeys: string[];
}

/**
 * 生成「上月 1 号 → 今天」的日历骨架。
 * 若今天是 11 月 7 日，结果为 10.01 ~ 11.07；
 * 若今天是 1 月 1 日，结果为上年 12.01 ~ 本年 01.01（Date 自动跨年）。
 */
export function buildCalendarDays(now: Date = new Date()): CalendarDay[] {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: CalendarDay[] = [];

  for (const current = new Date(start); current.getTime() <= end.getTime(); current.setDate(current.getDate() + 1)) {
    const dayOfMonth = current.getDate();
    const weekIndex = Math.floor((dayOfMonth - 1) / 7);
    days.push({
      dateKey: toDateKey(current),
      axisLabel: toMonthDay(current),
      fullDateLabel: `${current.getFullYear()}年${current.getMonth() + 1}月${dayOfMonth}日`,
      monthCN: CN_MONTHS[current.getMonth()],
      monthKey: `${current.getFullYear()}-${current.getMonth() + 1}`,
      dayOfMonth,
      weekIndex,
      weekOrdinalCN: CN_WEEK_ORDINALS[weekIndex] ?? `第${weekIndex + 1}`,
    });
  }
  return days;
}

/**
 * 按「自然月 + 月内周次」把连续日期切成周区间。
 * 跨月时绝不合并：10.29-10.31 属十月第五周，11.01-11.07 另起十一月第一周。
 */
export function buildCalendarWeeks(days: CalendarDay[]): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  let current: CalendarWeek | null = null;

  for (const day of days) {
    const id = `${day.monthKey}-w${day.weekIndex}`;
    if (!current || current.id !== id) {
      current = {
        id,
        monthCN: day.monthCN,
        weekOrdinalCN: day.weekOrdinalCN,
        weekIndex: day.weekIndex,
        label: '',
        startLabel: day.axisLabel,
        endLabel: day.axisLabel,
        dateKeys: [],
      };
      weeks.push(current);
    }
    current.endLabel = day.axisLabel;
    current.dateKeys.push(day.dateKey);
  }

  for (const week of weeks) {
    week.label = `${week.monthCN}的${week.weekOrdinalCN}周（${week.startLabel}-${week.endLabel}）`;
  }
  return weeks;
}

/** 横轴刻度值（对应 XAxis 的 dataKey=axisLabel），只保留真实存在于区间内的日期 */
export function buildMonthStartTicks(days: CalendarDay[]): string[] {
  return days
    .filter((day) => (AXIS_TICK_DAYS as readonly number[]).includes(day.dayOfMonth))
    .map((day) => day.axisLabel);
}
