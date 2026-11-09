import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Download,
  Flame,
  Lock,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { SKILL_DATA_EVENT, computeGrowthStats, computeSkillStates, loadCheckIns, loadSkills } from '../utils/skillData';
import { getPracticeStartDate, PRACTICE_UPDATE_EVENT } from '../utils/practice';
import { downloadGrowthCard } from '../utils/growthCard';
import { DEMO_SKILLS, buildDemoCheckIns } from '../data/demoGrowth';
import type { JazzSkill, SkillCheckIn, SkillLevel } from '../types/skill';

const HEAT_COLORS = ['bg-[#F5EDE4]', 'bg-[#FFD9CF]', 'bg-[#FFB4A2]', 'bg-[#FF8A73]', 'bg-[#FF6B6B]'];
const LEVEL_ACCENT: Record<SkillLevel, string> = {
  1: '#10B981',
  2: '#0EA5E9',
  3: '#F59E0B',
  4: '#F43F5E',
  5: '#8B5CF6',
};

interface GrowthReportProps {
  /** 空状态下引导用户去技能树打卡 */
  onGoCheckIn?: () => void;
  /** 全站统一昵称：导出分享卡时不再写死 Cici */
  displayNickname?: string;
}

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, right, children }) => (
  <section className="rounded-3xl border border-[#F1E5D8] bg-white/80 backdrop-blur-sm p-5 sm:p-6 shadow-[0_2px_20px_rgba(180,150,120,0.06)]">
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="font-display text-lg font-extrabold text-[#292524] tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-[#A8988A] mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

const StatCard: React.FC<{
  icon: React.ReactNode;
  value: string;
  unit: string;
  label: string;
  hint?: string;
  accent: string;
}> = ({ icon, value, unit, label, hint, accent }) => (
  <div className="rounded-2xl border border-[#F1E5D8] bg-white p-4 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${accent}1A`, color: accent }}
      >
        {icon}
      </span>
      {hint && <span className="text-[10px] font-semibold text-[#B8A697]">{hint}</span>}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#292524] leading-none">{value}</span>
      <span className="text-xs font-semibold text-[#A8988A]">{unit}</span>
    </div>
    <span className="text-xs text-[#8C7A6B] font-medium">{label}</span>
  </div>
);

export const GrowthReport: React.FC<GrowthReportProps> = ({ onGoCheckIn, displayNickname }) => {
  const [skills, setSkills] = useState<JazzSkill[]>(loadSkills);
  const [checkIns, setCheckIns] = useState<SkillCheckIn[]>(loadCheckIns);
  const [now, setNow] = useState<Date>(() => new Date());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  // 示例预览：数据只存在内存里，绝不写入真实存储
  const [demoMode, setDemoMode] = useState(() =>
    typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).has('demo')
  );
  const demoCheckIns = useMemo(() => buildDemoCheckIns(), []);

  const toggleDemo = useCallback(() => {
    setDemoMode((prev) => {
      const next = !prev;
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('demo', '1');
      else url.searchParams.delete('demo');
      window.history.replaceState(null, '', url.toString());
      return next;
    });
  }, []);

  // 打卡页写入后同窗口广播；跨标签页由 storage 事件兜底
  useEffect(() => {
    const refresh = () => {
      setSkills(loadSkills());
      setCheckIns(loadCheckIns());
      setNow(new Date());
    };
    window.addEventListener(SKILL_DATA_EVENT, refresh);
    window.addEventListener(PRACTICE_UPDATE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SKILL_DATA_EVENT, refresh);
      window.removeEventListener(PRACTICE_UPDATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // 每分钟重算一次，跨零点后"今日是否打卡 / 连续天数"自动更新
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sourceSkills = demoMode ? DEMO_SKILLS : skills;
  const sourceCheckIns = demoMode ? demoCheckIns : checkIns;

  const stats = useMemo(
    () => computeGrowthStats(sourceSkills, sourceCheckIns, demoMode ? null : getPracticeStartDate(), now),
    [sourceSkills, sourceCheckIns, demoMode, now]
  );

  const nextSkill = useMemo(() => {
    const states = computeSkillStates(sourceSkills, sourceCheckIns);
    const candidates = states
      .filter((state) => state.status === 'available' || state.status === 'practicing')
      .sort((a, b) => {
        if (a.skill.difficulty !== b.skill.difficulty) return a.skill.difficulty - b.skill.difficulty;
        return b.records.length - a.records.length;
      });
    return candidates[0]?.skill ?? null;
  }, [sourceSkills, sourceCheckIns]);

  const trend = useMemo(() => {
    if (stats.previousFourWeeks === 0) return stats.recentFourWeeks > 0 ? 100 : 0;
    return Math.round(((stats.recentFourWeeks - stats.previousFourWeeks) / stats.previousFourWeeks) * 100);
  }, [stats.recentFourWeeks, stats.previousFourWeeks]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError('');
    try {
      await downloadGrowthCard(stats, { name: displayNickname || '舞者' });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '分享卡生成失败');
    } finally {
      setExporting(false);
    }
  }, [stats, displayNickname]);

  const radarData = stats.categoryProgress.map((item) => ({
    category: item.category,
    掌握率: Math.round(item.ratio * 100),
  }));
  const hasAnyMastered = stats.masteredCount > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* 示例预览提示 */}
      {demoMode && (
        <div className="rounded-2xl border border-[#F5DFC4] bg-[#FFF8EC] px-4 py-2.5 flex items-center justify-between gap-3">
          <span className="text-xs text-[#8C7A6B]">示例数据预览中：以下数字仅用于展示效果，不会写入你的打卡记录。</span>
          <button
            onClick={toggleDemo}
            className="text-xs font-bold text-[#B45309] hover:underline shrink-0 cursor-pointer"
          >
            退出预览
          </button>
        </div>
      )}

      {/* 顶部标题 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-extrabold tracking-[0.18em] text-[#B45309]">GROWTH REPORT</span>
            <span className="h-px w-8 bg-[#F0D8C6]" />
            <span className="text-[11px] font-semibold text-[#B8A697]">实时派生 · 不存统计字段</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#292524] tracking-tight">
            我的舞蹈成长报告
          </h1>
          <p className="text-sm text-[#8C7A6B] mt-2">
            从每一次技能打卡里长出来的数字。
            {stats.todayChecked ? (
              <span className="inline-flex items-center gap-1 ml-2 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> 今天已打卡
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 ml-2 text-[#C4B2A3] font-semibold">
                <CircleDashed className="w-3.5 h-3.5" /> 今天还没打卡
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <button
            onClick={handleExport}
            disabled={exporting || stats.totalCheckIns === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #FF8A73, #FF6B6B)' }}
          >
            <Download className="w-4 h-4" />
            {exporting ? '正在生成…' : '导出成长分享卡'}
          </button>
          {exportError && <span className="text-[11px] text-[#D94834]">{exportError}</span>}
          {!demoMode && stats.totalCheckIns === 0 && (
            <button
              onClick={toggleDemo}
              className="text-[11px] font-semibold text-[#B45309] hover:underline cursor-pointer"
            >
              先看看示例报告 →
            </button>
          )}
        </div>
      </div>

      {/* 空状态 */}
      {stats.totalCheckIns === 0 && (
        <div className="rounded-3xl border border-dashed border-[#EBD6C4] bg-[#FFF8F1] p-8 text-center">
          <div className="text-3xl mb-2">🌱</div>
          <h2 className="font-display text-lg font-extrabold text-[#292524]">成长报告还在等第一笔记录</h2>
          <p className="text-sm text-[#8C7A6B] mt-2 max-w-md mx-auto">
            去技能树给任意一个动作记一次「练习中」或「已掌握」，这里会立刻长出舞龄、连续打卡、技能分布和成就徽章。
          </p>
          {onGoCheckIn && (
            <button
              onClick={onGoCheckIn}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold text-[#D94834] bg-[#FFF1EC] border border-[#FFD5C8] hover:bg-[#FFE7DE] transition-colors cursor-pointer"
            >
              去技能树记一笔 <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<CalendarDays className="w-4 h-4" />}
          value={String(stats.practiceAgeDays)}
          unit="天"
          label="舞龄"
          hint={stats.firstPracticeDate ? `自 ${stats.firstPracticeDate}` : '未开始'}
          accent="#FF6B6B"
        />
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          value={String(stats.currentStreak)}
          unit="天"
          label="当前连续打卡"
          hint={`最长 ${stats.longestStreak} 天`}
          accent="#F59E0B"
        />
        <StatCard
          icon={<Award className="w-4 h-4" />}
          value={String(stats.masteredCount)}
          unit={`/ ${stats.totalSkillCount}`}
          label="已掌握动作"
          hint={`完成度 ${Math.round(stats.completionRatio * 100)}%`}
          accent="#10B981"
        />
        <StatCard
          icon={<Target className="w-4 h-4" />}
          value={String(stats.practiceDayCount)}
          unit="天"
          label="累计练习天数"
          hint={`共 ${stats.totalCheckIns} 次打卡`}
          accent="#8B5CF6"
        />
      </div>

      {/* 成长曲线 + 雷达 */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <SectionCard title="成长曲线" subtitle="柱状为当月打卡次数，曲线为累计掌握动作数">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.monthly} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1E5D8" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#A8988A' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#A8988A' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #F1E5D8',
                      fontSize: 12,
                      boxShadow: '0 8px 24px rgba(180,150,120,0.15)',
                    }}
                    labelStyle={{ color: '#292524', fontWeight: 700 }}
                  />
                  <Bar dataKey="checkIns" name="打卡次数" fill="#FFE1D6" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Area
                    type="monotone"
                    dataKey="cumulative"
                    name="累计掌握"
                    stroke="#FF6B6B"
                    strokeWidth={2.5}
                    fill="url(#growthGradient)"
                    dot={{ r: 3, fill: '#FF6B6B', strokeWidth: 0 }}
                  />
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {stats.monthly.length <= 1 && (
              <p className="text-[11px] text-[#B8A697] mt-2">记录满两个月后，曲线会更有看头。</p>
            )}
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="技能雷达" subtitle="10 个维度看你的爵士功底分布">
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#F1E5D8" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: '#8C7A6B' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="掌握率 (%)"
                    dataKey="掌握率"
                    stroke="#8B5CF6"
                    fill="#8B5CF6"
                    fillOpacity={0.22}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #F1E5D8',
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
              {!hasAnyMastered && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-[#B8A697] bg-white/80 px-3 py-1 rounded-full border border-[#F1E5D8]">
                    掌握第一个动作后点亮
                  </span>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 热力图 + 难度阶梯 */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <SectionCard
            title="练习热力图"
            subtitle="最近 12 周，每格是一天；颜色越深，当天打卡越多"
            right={
              <div className="flex items-center gap-1.5 text-[10px] text-[#B8A697]">
                <span>少</span>
                {HEAT_COLORS.map((color) => (
                  <span key={color} className={`w-3 h-3 rounded-[3px] ${color}`} />
                ))}
                <span>多</span>
              </div>
            }
          >
            <div className="flex gap-[3px] overflow-x-auto pb-1">
              <div className="flex flex-col gap-[3px] mr-1 pt-[1px]">
                {['一', '', '三', '', '五', '', '日'].map((label, index) => (
                  <span key={index} className="h-3.5 text-[9px] leading-[14px] text-[#C4B2A3] w-3">
                    {label}
                  </span>
                ))}
              </div>
              {stats.heatWeeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <div
                      key={cell.date}
                      title={`${cell.date} · ${cell.count > 0 ? `${cell.count} 次打卡` : '无记录'}`}
                      className={`w-3.5 h-3.5 rounded-[3px] ${HEAT_COLORS[cell.level]} transition-transform hover:scale-125 hover:ring-1 hover:ring-[#FF6B6B]/40`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8C7A6B]">
              <span>
                近 4 周 <b className="text-[#292524]">{stats.recentFourWeeks}</b> 次
              </span>
              <span>
                前 4 周 <b className="text-[#292524]">{stats.previousFourWeeks}</b> 次
              </span>
              <span
                className={`inline-flex items-center gap-1 font-bold ${
                  trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-[#D94834]' : 'text-[#A8988A]'
                }`}
              >
                {trend > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : trend < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : null}
                {trend > 0 ? `+${trend}%` : `${trend}%`} 练习强度
              </span>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2">
          <SectionCard title="难度阶梯" subtitle="上一难度掌握 1 个动作即解锁下一层">
            <div className="space-y-3">
              {stats.levelProgress.map((level) => {
                const locked = level.level > 1 && stats.levelProgress[level.level - 2].mastered < 1;
                return (
                  <div key={level.level}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 font-semibold text-[#574B40]">
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: locked ? '#D6C7B9' : LEVEL_ACCENT[level.level] }}
                        >
                          {level.level}
                        </span>
                        {level.title}
                        {locked && <Lock className="w-3 h-3 text-[#C4B2A3]" />}
                      </span>
                      <span className="text-[#A8988A] font-mono">
                        {level.mastered}/{level.total}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F5EDE4] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(level.ratio * 100, level.mastered > 0 ? 6 : 0)}%`,
                          backgroundColor: locked ? '#E0D3C6' : LEVEL_ACCENT[level.level],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* 洞察 */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="text-[11px] font-bold text-emerald-700 mb-1">最强项</div>
          <div className="font-display text-base font-extrabold text-[#292524]">
            {stats.strongestCategory && stats.strongestCategory.mastered > 0
              ? stats.strongestCategory.category
              : '待发现'}
          </div>
          <p className="text-[11px] text-[#8C7A6B] mt-1">
            {stats.strongestCategory && stats.strongestCategory.mastered > 0
              ? `已掌握 ${stats.strongestCategory.mastered}/${stats.strongestCategory.total} 个动作`
              : '先掌握 1 个动作，这里就会有答案'}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="text-[11px] font-bold text-[#B45309] mb-1">可补的短板</div>
          <div className="font-display text-base font-extrabold text-[#292524]">
            {stats.weakestCategory ? stats.weakestCategory.category : '—'}
          </div>
          <p className="text-[11px] text-[#8C7A6B] mt-1">
            {stats.weakestCategory
              ? `掌握 ${stats.weakestCategory.mastered}/${stats.weakestCategory.total}，从这里补最快`
              : '暂无技能数据'}
          </p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <div className="text-[11px] font-bold text-violet-700 mb-1">下一步建议</div>
          <div className="font-display text-sm font-extrabold text-[#292524] leading-snug">
            {nextSkill ? nextSkill.name : '全部动作都已掌握，去创作自己的作品吧'}
          </div>
          <p className="text-[11px] text-[#8C7A6B] mt-1">
            {nextSkill ? `${nextSkill.difficulty} 星 · ${nextSkill.category}` : '技能树已通关'}
          </p>
        </div>
      </div>

      {/* 成就墙 */}
      <SectionCard
        title="成就徽章"
        subtitle={`${stats.milestones.filter((m) => m.unlocked).length}/${stats.milestones.length} 枚已点亮`}
        right={<Sparkles className="w-4 h-4 text-[#F59E0B]" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {stats.milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={`rounded-2xl border p-3 transition-all ${
                milestone.unlocked
                  ? 'border-[#FFD9C4] bg-gradient-to-br from-[#FFF7EF] to-[#FFEDE2] shadow-[0_2px_10px_rgba(255,140,110,0.12)]'
                  : 'border-[#F1E5D8] bg-[#FBF7F3]'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className={`text-xl leading-none ${milestone.unlocked ? '' : 'grayscale opacity-40'}`}>
                  {milestone.emoji}
                </span>
                {milestone.unlocked ? (
                  <span className="text-[9px] font-bold text-[#D94834] bg-white/70 px-1.5 py-0.5 rounded-full">
                    已点亮
                  </span>
                ) : (
                  <span className="text-[9px] font-semibold text-[#C4B2A3]">
                    {milestone.current}/{milestone.target}
                  </span>
                )}
              </div>
              <div
                className={`mt-2 text-xs font-extrabold ${milestone.unlocked ? 'text-[#292524]' : 'text-[#A8988A]'}`}
              >
                {milestone.title}
              </div>
              <p className="text-[10px] text-[#B8A697] mt-0.5 leading-snug">{milestone.description}</p>
              <div className="mt-2 h-1 rounded-full bg-[#F1E5D8] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${milestone.ratio * 100}%`,
                    backgroundColor: milestone.unlocked ? '#FF6B6B' : '#DCCBB9',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
