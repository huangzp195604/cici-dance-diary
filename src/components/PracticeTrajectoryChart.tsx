import React, { useState, useMemo } from 'react';
import { TrendingUp, Calendar, Sparkles, Activity, CheckCircle, Flame } from 'lucide-react';
import { DancePost } from '../types';
import { usePracticeDays } from '../utils/practice';

interface PracticeTrajectoryChartProps {
  posts: DancePost[];
}

interface MonthlyData {
  monthKey: string; // e.g. "2025-12"
  label: string; // e.g. "2025.12"
  count: number;
  stages: { 入门: number; 进阶: number; 挑战: number };
  posts: DancePost[];
  milestoneTitle?: string;
  milestoneNote?: string;
}

export const PracticeTrajectoryChart: React.FC<PracticeTrajectoryChartProps> = ({ posts }) => {
  const [chartMode, setChartMode] = useState<'trend' | 'heatmap'>('trend');
  const [hoveredMonth, setHoveredMonth] = useState<MonthlyData | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number; titles: string[] } | null>(null);

  // Persisted practice days: 0 by default, auto-increments after the user sets a start date
  const practiceDays = usePracticeDays();

  // 根据真实打卡作品的标题与内容，生成当月阶段小结
  const stageMeta: Record<string, { emoji: string; label: string }> = {
    入门: { emoji: '🌱', label: '入门起步' },
    进阶: { emoji: '🌿', label: '进阶突破' },
    挑战: { emoji: '🔥', label: '挑战尝试' },
  };

  const buildMonthSummary = (monthPosts: DancePost[]) => {
    if (monthPosts.length === 0) {
      return {
        milestoneTitle: '🌙 本月暂无打卡',
        milestoneNote: '本月还没有上传作品，上传后会自动根据标题与内容生成小结。',
      };
    }

    const stageCounts: Record<string, number> = { 入门: 0, 进阶: 0, 挑战: 0 };
    const categoryCounts: Record<string, number> = {};
    monthPosts.forEach((post) => {
      stageCounts[post.stage] = (stageCounts[post.stage] ?? 0) + 1;
      post.categories.forEach((category) => {
        categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
      });
    });

    const topStage = Object.keys(stageCounts).reduce((a, b) =>
      stageCounts[a] >= stageCounts[b] ? a : b
    );
    const topCategory =
      Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0] ?? '舞蹈';
    const meta = stageMeta[topStage] ?? { emoji: '💃', label: '持续练习' };

    const latest = [...monthPosts].sort((a, b) => a.date.localeCompare(b.date)).slice(-1)[0];
    const rawNote = (latest.notes ?? '').replace(/\s+/g, ' ').trim();
    const excerpt = rawNote.length > 32 ? `${rawNote.slice(0, 32)}…` : rawNote;

    return {
      milestoneTitle: `${meta.emoji} ${meta.label} · ${topCategory}`,
      milestoneNote: `《${latest.title}》${excerpt ? `：${excerpt}` : ''}${
        monthPosts.length > 1 ? `（本月共 ${monthPosts.length} 篇打卡）` : ''
      }`,
    };
  };

  // 1. Process Monthly Aggregation for Trend Line（近 4 个自然月，只统计真实打卡记录）
  const monthlyData = useMemo<MonthlyData[]>(() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (3 - index), 1);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthPosts = posts.filter((post) => post.date?.slice(0, 7) === monthKey);
      const stages = { 入门: 0, 进阶: 0, 挑战: 0 };
      monthPosts.forEach((post) => {
        if (post.stage in stages) {
          stages[post.stage]++;
        }
      });

      return {
        monthKey,
        label: monthKey.replace('-', '.'),
        count: monthPosts.length,
        stages,
        posts: monthPosts,
        ...buildMonthSummary(monthPosts),
      };
    });
  }, [posts]);

  // 2. Process Heatmap Data (Last 16 Weeks: 112 days，仅统计真实打卡)
  const heatmapData = useMemo(() => {
    const now = new Date();
    const refDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days: { dateStr: string; dayOfWeek: number; count: number; titles: string[] }[] = [];

    // Map existing posts by day string "YYYY-MM-DD"
    const postDayMap: Record<string, string[]> = {};
    posts.forEach((p) => {
      const dateKey = p.date?.slice(0, 10);
      if (!dateKey) return;
      if (!postDayMap[dateKey]) postDayMap[dateKey] = [];
      postDayMap[dateKey].push(p.title);
    });

    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Generate 16 weeks * 7 = 112 days back
    const totalDays = 112;
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(refDate);
      d.setDate(d.getDate() - i);
      const dateStr = toDateStr(d);
      const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Mon, 6 = Sun

      // 只使用真实上传记录，不再生成任何模拟练习打卡
      const titles = postDayMap[dateStr] || [];

      days.push({
        dateStr,
        dayOfWeek,
        count: titles.length,
        titles,
      });
    }

    return days;
  }, [posts]);

  // 近 16 周真实打卡总量与周均
  const heatmapTotalSessions = useMemo(
    () => heatmapData.reduce((sum, day) => sum + day.count, 0),
    [heatmapData]
  );
  const heatmapWeeklyAvg = heatmapTotalSessions > 0 ? (heatmapTotalSessions / 16).toFixed(1) : null;

  // 底部轨迹小结：完全由用户真实打卡的标题与内容生成
  const progressionSummary = useMemo(() => {
    if (posts.length === 0) {
      return '还没有打卡记录。上传第一支舞蹈作品后，这里会根据你记录的真实标题与内容自动生成练习轨迹小结。';
    }

    const sorted = [...posts].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const latest = sorted[sorted.length - 1];
    const toMonthLabel = (date: string) => `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月`;
    const categoryCount = new Set(posts.flatMap((post) => post.categories)).size;
    const practiceDayCount = new Set(posts.map((post) => post.date.slice(0, 10))).size;

    return `从 ${toMonthLabel(first.date)}的第一篇《${first.title}》开始，到 ${toMonthLabel(
      latest.date
    )}共记录 ${posts.length} 篇打卡、累计 ${practiceDayCount} 个练习日，覆盖 ${categoryCount} 个舞种。继续按自己的节奏，记录每一次真实进步！`;
  }, [posts]);

  // SVG Line Chart Dimensions
  const chartWidth = 680;
  const chartHeight = 220;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 30;
  const paddingBottom = 40;

  const maxCount = Math.max(4, ...monthlyData.map((d) => d.count)) + 1;
  const points = monthlyData.map((d, index) => {
    const x = paddingLeft + (index / (monthlyData.length - 1 || 1)) * (chartWidth - paddingLeft - paddingRight);
    const y = chartHeight - paddingBottom - (d.count / maxCount) * (chartHeight - paddingTop - paddingBottom);
    return { x, y, data: d };
  });

  // Build SVG path
  const pathD = points.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[idx - 1];
    const cpX1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (curr.x - prev.x) * 0.5;
    const cpY2 = curr.y;
    return `${acc} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
  }, '');

  // Fill area path (closed polygon)
  const areaD = points.length > 0 
    ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`
    : '';

  return (
    <section className="bg-white border border-[#EFE3D5] rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
      
      {/* 1. Header with Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-display font-extrabold text-[#292524] tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#FF7E67]" />
              <span>练舞努力轨迹与频率趋势</span>
            </h3>
            <span className="text-xs bg-[#FFF2EB] text-[#E65B47] px-2 py-0.5 rounded-full font-semibold">
              见证从零到进阶
            </span>
          </div>
          <p className="text-xs text-[#78695C] mt-1">
            基于你沉淀的 {posts.length} 篇作品与 {practiceDays} 天练舞日记，用数据清晰呈现每一次突破。
          </p>
        </div>

        {/* Clean Segmented Control Switcher */}
        <div className="flex items-center gap-1 p-1 bg-[#FAF2EB] rounded-2xl border border-[#E8DACB] self-start sm:self-auto">
          <button
            onClick={() => setChartMode('trend')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              chartMode === 'trend'
                ? 'bg-white text-[#E65B47] shadow-2xs'
                : 'text-[#78695C] hover:text-[#292524]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>月度突破折线图</span>
          </button>

          <button
            onClick={() => setChartMode('heatmap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              chartMode === 'heatmap'
                ? 'bg-white text-[#E65B47] shadow-2xs'
                : 'text-[#78695C] hover:text-[#292524]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>16周打卡热力图</span>
          </button>
        </div>
      </div>

      {/* 2. MODE A: TREND LINE & BREAKTHROUGH CURVE */}
      {chartMode === 'trend' && (
        <div className="space-y-4">
          
          {/* SVG Chart Container */}
          <div className="bg-[#FFFDFB] border border-[#F2E5D8] rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-48 sm:h-64 overflow-visible"
            >
              <defs>
                <linearGradient id="coralAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF7E67" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#FF7E67" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFA07A" />
                  <stop offset="50%" stopColor="#FF7E67" />
                  <stop offset="100%" stopColor="#E65B47" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Grid lines */}
              {[0, 1, 2, 3, 4].map((gridVal) => {
                const y = chartHeight - paddingBottom - (gridVal / maxCount) * (chartHeight - paddingTop - paddingBottom);
                return (
                  <g key={gridVal}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#F0E3D6"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[10px] fill-[#A8988A] font-mono"
                    >
                      {gridVal}
                    </text>
                  </g>
                );
              })}

              {/* Area Gradient */}
              {areaD && <path d={areaD} fill="url(#coralAreaGrad)" />}

              {/* Main Trend Spline */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="url(#lineGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data Nodes & Milestone Markers */}
              {points.map((pt, idx) => {
                const isHovered = hoveredMonth?.monthKey === pt.data.monthKey;
                return (
                  <g
                    key={idx}
                    className="cursor-pointer transition-transform group"
                    onMouseEnter={() => setHoveredMonth(pt.data)}
                    onMouseLeave={() => setHoveredMonth(null)}
                  >
                    {/* Pulsing ring for latest point */}
                    {idx === points.length - 1 && (
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="10"
                        className="fill-[#FF7E67]/20 animate-ping"
                      />
                    )}

                    {/* Outer circle */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isHovered ? 7 : 5.5}
                      fill="#FFFFFF"
                      stroke="#E65B47"
                      strokeWidth="3"
                      className="transition-all duration-150"
                    />

                    {/* X-axis Label */}
                    <text
                      x={pt.x}
                      y={chartHeight - 12}
                      textAnchor="middle"
                      className={`text-[11px] font-mono transition-colors ${
                        isHovered ? 'fill-[#E65B47] font-bold' : 'fill-[#78695C]'
                      }`}
                    >
                      {pt.data.label}
                    </text>

                    {/* Milestone pill over node（仅有真实打卡时展示） */}
                    {pt.data.count > 0 && pt.data.milestoneTitle && (
                      <g transform={`translate(${pt.x}, ${pt.y - 18})`}>
                        <rect
                          x="-32"
                          y="-10"
                          width="64"
                          height="18"
                          rx="9"
                          className={`${
                            isHovered ? 'fill-[#E65B47]' : 'fill-[#FFEBE2]'
                          } transition-colors`}
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          className={`text-[9px] font-semibold ${
                            isHovered ? 'fill-white' : 'fill-[#A63C29]'
                          }`}
                        >
                          {pt.data.count} 篇作品
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip Card */}
            {hoveredMonth && (
              <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md border border-[#F0E1D3] p-3 rounded-2xl shadow-md text-xs w-56 animate-fadeIn pointer-events-none">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[#292524]">{hoveredMonth.label} 练舞记录</span>
                  <span className="text-[#E65B47] font-mono font-bold">{hoveredMonth.count} 篇</span>
                </div>
                <p className="text-[11px] text-[#FF7E67] font-semibold">{hoveredMonth.milestoneTitle}</p>
                <p className="text-[11px] text-[#78695C] mt-0.5 leading-snug">{hoveredMonth.milestoneNote}</p>
                <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-[#F5ECE1] text-[10px] text-[#8C7A6B]">
                  <span>入门: {hoveredMonth.stages['入门']}</span>
                  <span>·</span>
                  <span>进阶: {hoveredMonth.stages['进阶']}</span>
                  <span>·</span>
                  <span>挑战: {hoveredMonth.stages['挑战']}</span>
                </div>
              </div>
            )}
          </div>

          {/* Breakthrough Milestones Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {monthlyData.map((m) => (
              <div
                key={m.monthKey}
                className="bg-[#FFFDF9] border border-[#F0E4D8] hover:border-[#FF7E67] p-3.5 rounded-2xl transition-all"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-mono font-bold text-[#E65B47]">{m.label}</span>
                  <span className="text-[11px] text-[#8C7A6B] bg-[#FAF2EB] px-2 py-0.5 rounded-md font-mono">
                    {m.count} 次沉淀
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[#292524]">{m.milestoneTitle}</h4>
                <p className="text-[11px] text-[#78695C] mt-1 leading-snug">{m.milestoneNote}</p>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* 3. MODE B: 16-WEEK PRACTICE ACTIVITY HEATMAP */}
      {chartMode === 'heatmap' && (
        <div className="space-y-4">
          <div className="bg-[#FFFDF9] border border-[#F2E5D8] rounded-2xl p-4 sm:p-5 overflow-x-auto">
            <div className="min-w-[620px]">
              
              {/* Day of Week Labels + Matrix Grid */}
              <div className="flex gap-2">
                
                {/* Y-axis days */}
                <div className="flex flex-col justify-between py-1 text-[10px] text-[#A8988A] font-medium w-8 shrink-0">
                  <span>周一</span>
                  <span>周三</span>
                  <span>周五</span>
                  <span>周日</span>
                </div>

                {/* 16 Weeks Columns */}
                <div className="flex-1 grid grid-flow-col grid-rows-7 gap-1.5">
                  {heatmapData.map((cell, idx) => {
                    const isPracticed = cell.count > 0;
                    const hasWork = cell.titles.length > 0;
                    
                    let bgClass = 'bg-[#F5ECE3] hover:ring-2 hover:ring-[#E8DACB]';
                    if (cell.count === 1) bgClass = 'bg-[#FED6C7] hover:ring-2 hover:ring-[#FF9A84]';
                    else if (cell.count === 2) bgClass = 'bg-[#FF9A84] hover:ring-2 hover:ring-[#E65B47]';
                    else if (cell.count >= 3) bgClass = 'bg-[#E65B47] hover:ring-2 hover:ring-[#C8412F]';

                    return (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-md transition-all cursor-pointer ${bgClass} ${
                          hasWork ? 'ring-1.5 ring-[#E65B47]/80 ring-offset-1' : ''
                        }`}
                        onMouseEnter={() => setHoveredDay({ date: cell.dateStr, count: cell.count, titles: cell.titles })}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>

              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between text-xs text-[#8C7A6B] mt-4 pt-3 border-t border-[#F5ECE1]">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span>带外边框的方块代表该天产出了成片/打卡记录</span>
                </div>

                <div className="flex items-center gap-2 text-[11px]">
                  <span>较少</span>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-[#F5ECE3]" />
                    <span className="w-3 h-3 rounded bg-[#FED6C7]" />
                    <span className="w-3 h-3 rounded bg-[#FF9A84]" />
                    <span className="w-3 h-3 rounded bg-[#E65B47]" />
                  </div>
                  <span>高频练习</span>
                </div>
              </div>

            </div>
          </div>

          {/* Hovered Day Tooltip Bar */}
          <div className="bg-[#FFF9F3] border border-[#F5E6D8] p-3 rounded-2xl flex items-center justify-between text-xs text-[#635346]">
            {hoveredDay ? (
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-[#FF7E67] shrink-0" />
                <span>
                  <strong>{hoveredDay.date}</strong>：
                  {hoveredDay.count > 0 ? `练习打卡 ${hoveredDay.count} 次` : '休息放松日'}
                  {hoveredDay.titles.length > 0 && (
                    <span className="text-[#E65B47] font-semibold ml-1">
                      （作品: {hoveredDay.titles.join('、')}）
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#A8988A]">
                <Sparkles className="w-4 h-4 text-[#FF7E67]" />
                <span>鼠标悬停在方块上查看具体日期的练舞与作品打卡记录</span>
              </div>
            )}

            <div className="text-[11px] font-mono text-[#8C7A6B] hidden sm:block">
              {heatmapWeeklyAvg
                ? `近16周共 ${heatmapTotalSessions} 次 · 周均 ${heatmapWeeklyAvg} 次`
                : '近16周暂无打卡记录'}
            </div>
          </div>

        </div>
      )}

      {/* 4. Bottom Progression Summary */}
      <div className="bg-[#FAF2EB] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#6B5A4D]">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>努力轨迹小结：</strong>{progressionSummary}
          </span>
        </div>
      </div>

    </section>
  );
};
