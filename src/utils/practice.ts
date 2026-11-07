import { useEffect, useState } from 'react';
import { syncRemoveItem, syncSetItem } from './sync';

/** 用户设定的学舞起步日（即开始记录的日期），未设置时练习天数为 0 */
export const PRACTICE_START_DATE_KEY = 'cici_dance_start_date';
/** 同窗口内跨组件同步练习天数变化 */
export const PRACTICE_UPDATE_EVENT = 'cici-practice-update';

const DAY_MS = 1000 * 60 * 60 * 24;

export function getPracticeStartDate(): string | null {
  try {
    return localStorage.getItem(PRACTICE_START_DATE_KEY);
  } catch {
    return null;
  }
}

export function setPracticeStartDate(date: string | null): void {
  try {
    if (date) {
      syncSetItem(PRACTICE_START_DATE_KEY, date);
    } else {
      syncRemoveItem(PRACTICE_START_DATE_KEY);
    }
  } catch {
    // 存储不可用时仍保持当前会话内状态可用
  }
  window.dispatchEvent(new Event(PRACTICE_UPDATE_EVENT));
}

/**
 * 从起步日（用户首次开始记录的时间点）按自然日累计练习天数。
 * 未设置起步日时返回 0；设置当天记为第 1 天。
 */
export function computePracticeDays(startDate: string | null, now: Date = new Date()): number {
  if (!startDate) return 0;
  const [year, month, day] = startDate.split('-').map(Number);
  if (!year || !month || !day) return 0;
  const startMidnight = new Date(year, month - 1, day);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor((todayMidnight.getTime() - startMidnight.getTime()) / DAY_MS) + 1;
  return Math.max(0, diffDays);
}

/** 自动跟踪练习天数：跨天、跨标签页或起步日变更时都会刷新 */
export function usePracticeDays(): number {
  const [practiceDays, setPracticeDays] = useState<number>(() =>
    computePracticeDays(getPracticeStartDate())
  );

  useEffect(() => {
    const refresh = () => setPracticeDays(computePracticeDays(getPracticeStartDate()));
    refresh();

    const timer = window.setInterval(refresh, 60 * 1000);
    window.addEventListener(PRACTICE_UPDATE_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener(PRACTICE_UPDATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return practiceDays;
}
