import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, RotateCcw, X } from 'lucide-react';
import type { DancePost } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * 学舞起步日选择弹窗。
 *
 * 从 Timeline 里拆出来的原因不是「文件太长」，而是这段日历有自己完整的
 * 状态机（当前查看的月份、临时选中日、悬停预览、清除确认），
 * 和作品列表的筛选、展开、评论没有一处共享状态。
 * 拆开之后改日历不会再动到作品流，反之亦然。
 */
interface StartDateModalProps {
  open: boolean;
  /** 当前已设定的起步日；null 表示还没设置 */
  startDate: string | null;
  /** 用来在日历上标出「这一天练过舞」以及统计总场次 */
  posts: DancePost[];
  /** 已坚持天数（由父级按起步日算出，这里只负责显示） */
  practiceDays: number;
  onClose: () => void;
  /** 确认设定 / 清除（传 null）后回调，由父级负责持久化与提示 */
  onApply: (date: string | null) => void;
}

export const StartDateModal: React.FC<StartDateModalProps> = ({
  open,
  startDate,
  posts,
  practiceDays,
  onClose,
  onApply,
}) => {
  // Calendar Date Selection Modal State
  const [tempSelectedDate, setTempSelectedDate] = useState<string>(startDate ?? '');
  const [calendarViewYear, setCalendarViewYear] = useState<number>(() => {
    const p = (startDate ?? '').split('-').map(Number);
    return p[0] || new Date().getFullYear();
  });
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(() => {
    const p = (startDate ?? '').split('-').map(Number);
    return typeof p[1] === 'number' ? p[1] - 1 : new Date().getMonth();
  });
  const [hoveredCalendarDay, setHoveredCalendarDay] = useState<{ date: string; sessions: DancePost[] } | null>(null);
  // 清除起步日（练习天数归零）的二次确认弹窗
  const [isClearStartConfirmOpen, setIsClearStartConfirmOpen] = useState(false);

  // 每次打开（或外部改了起步日）都把临时选中同步回来
  useEffect(() => {
    setTempSelectedDate(startDate ?? '');
  }, [startDate, open]);

  // Marked dance sessions from selected start date forward
  const sessionsFromStartDate = useMemo(() => {
    if (!startDate) return [];
    return posts.filter((p) => p.date >= startDate);
  }, [posts, startDate]);

  // Map of post sessions by date string (on or after start date)
  const sessionDateMap = useMemo(() => {
    const map = new Map<string, DancePost[]>();
    if (!startDate) return map;
    posts.forEach((p) => {
      if (p.date >= startDate) {
        const list = map.get(p.date) || [];
        list.push(p);
        map.set(p.date, list);
      }
    });
    return map;
  }, [posts, startDate]);

  const handlePrevMonth = () => {
    if (calendarViewMonth === 0) {
      setCalendarViewMonth(11);
      setCalendarViewYear((y) => y - 1);
    } else {
      setCalendarViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarViewMonth === 11) {
      setCalendarViewMonth(0);
      setCalendarViewYear((y) => y + 1);
    } else {
      setCalendarViewMonth((m) => m + 1);
    }
  };

  // Calendar grid days generator for the active view month
  const calendarGridDays = useMemo(() => {
    const firstDay = new Date(calendarViewYear, calendarViewMonth, 1).getDay(); // 0 is Sun
    const firstDayMon = (firstDay + 6) % 7; // Monday = 0
    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarViewYear, calendarViewMonth, 0).getDate();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isAfter = (d: string) => !!startDate && d >= startDate;
    const cell = (dateStr: string, dayNum: number, isCurrentMonth: boolean, sessions: DancePost[]) => ({
      dateStr,
      dayNum,
      isCurrentMonth,
      isToday: dateStr === todayStr,
      isStartDate: dateStr === startDate,
      isTempSelected: dateStr === tempSelectedDate,
      isAfterStart: isAfter(dateStr),
      sessions,
    });

    const days: ReturnType<typeof cell>[] = [];

    // Prev month days
    for (let i = firstDayMon - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevM = calendarViewMonth === 0 ? 11 : calendarViewMonth - 1;
      const prevY = calendarViewMonth === 0 ? calendarViewYear - 1 : calendarViewYear;
      const dStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push(cell(dStr, dNum, false, sessionDateMap.get(dStr) || []));
    }

    // Current month days
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const dStr = `${calendarViewYear}-${String(calendarViewMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      days.push(cell(dStr, dNum, true, sessionDateMap.get(dStr) || []));
    }

    // Next month filler
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = calendarViewMonth === 11 ? 0 : calendarViewMonth + 1;
      const nextY = calendarViewMonth === 11 ? calendarViewYear + 1 : calendarViewYear;
      const dStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push(cell(dStr, i, false, sessionDateMap.get(dStr) || []));
    }

    return days;
  }, [calendarViewYear, calendarViewMonth, startDate, tempSelectedDate, sessionDateMap]);

  return (
    <>
      {/* ======================================================== */}
      {/* DANCE START DATE & CALENDAR INTERFACE (MODAL)           */}
      {/* ======================================================== */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-[#F2DFD4] flex flex-col gap-4 animate-scaleUp max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FF7E67] to-[#FFA07A] text-white flex items-center justify-center shadow-inner shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-[#292524]">学舞起步日与练舞打卡日历</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEAE3] text-[#E0523D] border border-[#FFD0C5]">
                      自由设定起步日
                    </span>
                  </div>
                  <p className="text-xs text-[#8C7A6B] mt-0.5">
                    从选定起步日开始标记每一场练舞打卡，坚持天数随着自然日自动累计更新
                  </p>
                </div>
              </div>
              <button
                onClick={() => onClose()}
                className="text-[#A8988A] hover:text-[#292524] p-1.5 rounded-xl hover:bg-[#FAF2EB] transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Active Start Date Highlight Card */}
            <div className="bg-gradient-to-r from-[#FFF5F0] via-[#FFF9F5] to-[#FFF0ED] border border-[#F8DED5] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-[11px] font-semibold text-[#8C7A6B] block">当前生效的学舞起步日:</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono font-extrabold text-base sm:text-lg text-[#D94834]">
                    {startDate || '未设置'}
                  </span>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-md text-[#78695C] border border-[#F2DACF] font-medium">
                    {startDate ? (
                      <>
                        已累计坚持 <strong className="text-[#D94834]">{practiceDays}</strong> 天
                      </>
                    ) : (
                      <>
                        练习天数 <strong className="text-[#D94834]">0</strong> 天
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-[#6B5749] border-t sm:border-t-0 sm:border-l border-[#F0DFD7] pt-2 sm:pt-0 sm:pl-4">
                <div>
                  <span className="block text-[11px] text-[#A69588]">从起步日已标记</span>
                  <span className="font-bold text-[#292524] text-sm">
                    {sessionsFromStartDate.length} <span className="text-xs font-normal text-[#8C7A6B]">场练舞</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Presets & Precision Date Picker */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#57463B] flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-[#FF7E67]" />
                  <span>选择或更改起步日:</span>
                </span>

                {/* Direct native date picker input */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#8C7A6B] text-[11px]">快捷指定日期:</span>
                  <input
                    type="date"
                    value={tempSelectedDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setTempSelectedDate(e.target.value);
                        const parts = e.target.value.split('-').map(Number);
                        if (parts[0] && parts[1]) {
                          setCalendarViewYear(parts[0]);
                          setCalendarViewMonth(parts[1] - 1);
                        }
                      }
                    }}
                    className="text-xs px-2.5 py-1 rounded-xl border border-[#E5D7CB] bg-white text-[#292524] focus:ring-2 focus:ring-[#FF7E67]/30 outline-none font-mono font-medium cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    label: '30 天前',
                    date: (() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 30);
                      return d.toISOString().slice(0, 10);
                    })(),
                  },
                  {
                    label: '60 天前',
                    date: (() => {
                      const d = new Date();
                      d.setDate(d.getDate() - 60);
                      return d.toISOString().slice(0, 10);
                    })(),
                  },
                  {
                    label: '今天起步',
                    date: new Date().toISOString().slice(0, 10),
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setTempSelectedDate(preset.date);
                      const parts = preset.date.split('-').map(Number);
                      if (parts[0] && parts[1]) {
                        setCalendarViewYear(parts[0]);
                        setCalendarViewMonth(parts[1] - 1);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      tempSelectedDate === preset.date
                        ? 'bg-[#FF7E67] text-white shadow-2xs font-bold'
                        : 'bg-[#F9EFE6] text-[#786457] hover:bg-[#F2E2D4]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Month Calendar Grid */}
            <div className="border border-[#F0E2D5] rounded-2xl p-3.5 bg-[#FFFDFB]">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-3 px-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg text-[#7A695C] hover:text-[#292524] hover:bg-[#F5EAE0] transition-colors cursor-pointer"
                  title="上一月"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-[#292524]">
                    {calendarViewYear} 年 {calendarViewMonth + 1} 月
                  </span>
                  <span className="text-[11px] text-[#A8988A]">(点击日期即可设定为起步日)</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg text-[#7A695C] hover:text-[#292524] hover:bg-[#F5EAE0] transition-colors cursor-pointer"
                  title="下一月"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day of Week Headers (Mon - Sun) */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                {['一', '二', '三', '四', '五', '六', '日'].map((dayName, idx) => (
                  <span
                    key={dayName}
                    className={`text-[11px] font-bold py-1 ${idx >= 5 ? 'text-[#D94834]' : 'text-[#8C7A6B]'}`}
                  >
                    {dayName}
                  </span>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarGridDays.map((day) => {
                  const hasSessions = day.sessions.length > 0;
                  const isSelected = day.dateStr === tempSelectedDate;

                  return (
                    <div
                      key={day.dateStr}
                      onClick={() => setTempSelectedDate(day.dateStr)}
                      onMouseEnter={() => {
                        if (hasSessions) {
                          setHoveredCalendarDay({ date: day.dateStr, sessions: day.sessions });
                        }
                      }}
                      onMouseLeave={() => setHoveredCalendarDay(null)}
                      className={`relative min-h-[46px] p-1 rounded-xl flex flex-col items-center justify-between border transition-all cursor-pointer select-none group ${
                        isSelected
                          ? 'bg-[#FF7E67] text-white border-[#FF654B] shadow-sm font-bold scale-[1.02] z-10'
                          : day.isStartDate
                            ? 'bg-[#FFF0EB] border-[#FFC7B8] text-[#D94834] font-bold'
                            : day.isAfterStart && hasSessions
                              ? 'bg-[#FFF8F5] border-[#FFD5C8] text-[#292524] hover:bg-[#FFEAE2]'
                              : day.isCurrentMonth
                                ? 'bg-white border-transparent text-[#443831] hover:bg-[#F9EFE6]'
                                : 'bg-transparent border-transparent text-[#C2B5A8] opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full px-0.5">
                        <span className="text-xs leading-none font-semibold">{day.dayNum}</span>
                        {day.isToday && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#FF7E67]'}`}
                            title="今天"
                          />
                        )}
                      </div>

                      {/* Marking badge for dance sessions or start date */}
                      <div className="w-full flex items-center justify-center mt-0.5">
                        {isSelected ? (
                          <span className="text-[9px] px-1 rounded bg-white/25 text-white font-bold leading-tight">
                            起步
                          </span>
                        ) : day.isStartDate ? (
                          <span className="text-[9px] px-1 rounded bg-[#FFD7CE] text-[#C8402D] font-bold leading-tight">
                            🌱起步
                          </span>
                        ) : day.isAfterStart && hasSessions ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#E65B47] bg-[#FFEAE3] px-1 py-0.2 rounded-full border border-[#FFD3C7]">
                            <span>💃</span>
                            <span>{day.sessions.length > 1 ? day.sessions.length : ''}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tooltip detail for hovered session day */}
              {hoveredCalendarDay && (
                <div className="mt-2.5 p-2 bg-[#FFF4ED] border border-[#FED0BE] rounded-xl text-xs text-[#574438] flex items-center justify-between gap-2 animate-fadeIn">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[#D94834]">{hoveredCalendarDay.date} 练舞记录:</span>
                    <span className="truncate max-w-[280px]">
                      {hoveredCalendarDay.sessions.map((s) => s.title).join(' / ')}
                    </span>
                  </div>
                  <span className="text-[10px] bg-white px-2 py-0.5 rounded-md font-semibold text-[#D94834] shrink-0 border border-[#FFD0C0]">
                    已记录打卡
                  </span>
                </div>
              )}
            </div>

            {/* Calendar Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7A695C] px-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#FF7E67] border border-[#FF654B] inline-block" />
                  <span>新选定起步日</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-[#FFEAE3] border border-[#FFD3C7] text-[8px] flex items-center justify-center">
                    💃
                  </span>
                  <span>从起步日标记的练舞场次</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#FF7E67] inline-block" />
                  <span>今天</span>
                </span>
              </div>
              <span className="text-[#A8988A]">修改后系统会自动从新日期重新标记</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[#F1E5D8]">
              <button
                type="button"
                onClick={() => setIsClearStartConfirmOpen(true)}
                className="text-xs font-semibold text-[#8C7A6B] hover:text-[#292524] flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-[#FAF2EB] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>清除起步日（练习天数归零）</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="px-4 py-2 text-xs font-semibold text-[#78695C] hover:text-[#292524] hover:bg-[#FAF2EB] rounded-xl transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => tempSelectedDate && onApply(tempSelectedDate)}
                  disabled={!tempSelectedDate}
                  className="px-5 py-2 bg-[#FF7E67] hover:bg-[#E65B47] disabled:bg-[#E8D5CC] disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>确认设定起步日{tempSelectedDate ? ` (${tempSelectedDate})` : ''}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 清除起步日 · 二次确认弹窗 */}
      <ConfirmDialog
        open={isClearStartConfirmOpen}
        title="确认清除学舞起步日？"
        description="清除后练习天数会立即归零，且需要重新设置起步日才能继续累计。作品记录不会受影响。"
        details={[
          startDate ? `当前起步日：${startDate}` : '当前尚未设置起步日',
          '练习天数将重置为 0 天',
          '已上传的舞蹈作品不会被删除',
        ]}
        confirmLabel="确认清除起步日"
        onCancel={() => setIsClearStartConfirmOpen(false)}
        onConfirm={() => {
          setIsClearStartConfirmOpen(false);
          onApply(null);
        }}
      />
    </>
  );
};
