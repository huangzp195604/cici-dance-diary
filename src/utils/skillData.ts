/**
 * 爵士舞技能数据层：存储读写 + 状态派生 + 成长统计
 *
 * 设计原则
 * 1. 单一事实来源：技能库与打卡记录只存在这里，页面组件不自己解析 localStorage。
 * 2. 状态全部派生：解锁 / 练习中 / 已掌握 不落库，永远按原始记录实时计算，
 *    避免"统计数字与实际记录对不上"的数据漂移。
 * 3. 只读统计：成长报告只消费这里算出来的数字，不写任何数据。
 */
import type {
  CheckInStatus,
  JazzSkill,
  SkillCategory,
  SkillCheckIn,
  SkillLevel,
  SkillStateStatus,
  SkillWithState,
} from '../types/skill';
import { computePracticeDays } from './practice';
import { syncSetItem } from './sync';

export const SKILLS_STORAGE_KEY = 'cici_jazz_skills_v1';
export const CHECKINS_STORAGE_KEY = 'cici_jazz_skill_checkins_v1';
/** 打卡页与成长报告页之间的同窗口数据变更信号（storage 事件只在跨标签页触发） */
export const SKILL_DATA_EVENT = 'cici-skill-data-change';

const notifyChange = () => {
  try {
    window.dispatchEvent(new Event(SKILL_DATA_EVENT));
  } catch {
    // 非浏览器环境（构建期）静默跳过
  }
};

export const SKILL_CATEGORIES: SkillCategory[] = [
  '基础律动',
  '隔离控制',
  '身体开发',
  '脚步与重心',
  '旋转技巧',
  '高跟 Jazz',
  '地面技巧',
  '音乐性',
  '表现力',
  '编舞与创作',
];

export const LEVEL_TITLES: Record<SkillLevel, string> = {
  1: '入门基础',
  2: '基础组合',
  3: '进阶技巧',
  4: '高阶组合',
  5: '舞台与创作',
};

/**
 * 默认爵士舞技能库：按真实难度 1-5 星整理，
 * 仅作为动作词典，不含任何模拟打卡记录。
 */
export const DEFAULT_JAZZ_SKILLS: JazzSkill[] = [
  // ---------- 1 星：入门基础 ----------
  {
    id: 'skill-groove-bounce',
    name: '基础律动 Bounce（Down/Up Beat）',
    category: '基础律动',
    difficulty: 1,
    description: '跟随 80-100 BPM 稳定完成上下律动，膝盖放松、重心有弹性。',
  },
  {
    id: 'skill-head-isolation',
    name: '头部前后左右隔离 Head Isolation',
    category: '隔离控制',
    difficulty: 1,
    description: '头部单独完成前后左右出点，肩颈不跟随晃动。',
  },
  {
    id: 'skill-shoulder-isolation',
    name: '肩部前后左右隔离 Shoulder Isolation',
    category: '隔离控制',
    difficulty: 1,
    description: '左右肩交替前后转动，胸腔与胯部保持稳定。',
  },
  {
    id: 'skill-chest-isolation',
    name: '胸腔前后左右隔离 Chest Isolation',
    category: '隔离控制',
    difficulty: 1,
    description: '胸腔四方向出点清晰，下半身不代偿。',
  },
  {
    id: 'skill-hip-isolation',
    name: '胯部左右前后隔离 Hip Isolation',
    category: '隔离控制',
    difficulty: 1,
    description: '胯部单方向出点，上半身尽量保持正对前方。',
  },
  {
    id: 'skill-jazz-hands',
    name: 'Jazz 手位与手臂延伸',
    category: '基础律动',
    difficulty: 1,
    description: '掌握基础手位，手臂线条有延伸感，发力不耸肩。',
  },
  {
    id: 'skill-weight-shift',
    name: '重心转移与左右换重心',
    category: '脚步与重心',
    difficulty: 1,
    description: '左右重心干净切换，脚掌与脚踝保持稳定。',
  },
  {
    id: 'skill-step-touch',
    name: 'Step Touch / Kick Ball Change',
    category: '脚步与重心',
    difficulty: 1,
    description: '基础步伐与踢换步，节奏清楚，落点稳定。',
  },
  {
    id: 'skill-eight-count',
    name: '8-Count 数拍与基础组合',
    category: '音乐性',
    difficulty: 1,
    description: '能听清 8 拍结构，并把基础动作放进拍子里完成。',
  },
  {
    id: 'skill-posture-line',
    name: '身体站姿与直线控制 Posture & Line',
    category: '身体开发',
    difficulty: 1,
    description: '脊柱延展、肩胯对齐，静态线条干净。',
  },

  // ---------- 2 星：基础组合 ----------
  {
    id: 'skill-chest-roll',
    name: '胸部四周滚动 Chest Roll',
    category: '身体开发',
    difficulty: 2,
    description: '胸腔完成前后左右连贯绕环，靠墙练习后能找到分离感。',
  },
  {
    id: 'skill-body-wave',
    name: '身体波浪 Body Wave',
    category: '身体开发',
    difficulty: 2,
    description: '从头到胯连贯传导波浪，胸腹不塌腰。',
  },
  {
    id: 'skill-side-wave',
    name: '侧身波浪 Side Wave',
    category: '身体开发',
    difficulty: 2,
    description: '侧向完成身体波浪，肋骨与胯部依次传导。',
  },
  {
    id: 'skill-hip-roll',
    name: '胯部绕环 Hip Roll',
    category: '身体开发',
    difficulty: 2,
    description: '胯部完成水平绕环，上下身分离稳定。',
  },
  {
    id: 'skill-jazz-walk',
    name: 'Jazz Walk 与爵士步伐',
    category: '脚步与重心',
    difficulty: 2,
    description: '带延伸和态度的行走步伐，能配合音乐切换方向。',
  },
  {
    id: 'skill-pivot-turn',
    name: 'Pivot Turn 基础转体',
    category: '旋转技巧',
    difficulty: 2,
    description: '半圈或一圈转体，留头与收势稳定。',
  },
  {
    id: 'skill-pose-hit',
    name: '定点 Pose 与 Hit',
    category: '表现力',
    difficulty: 2,
    description: '卡点上定点成形，动作干净有停顿感。',
  },
  {
    id: 'skill-on-beat',
    name: '基础音乐卡点 On Beat Hit',
    category: '音乐性',
    difficulty: 2,
    description: '能在重拍上准确发力，动作与鼓点同步。',
  },
  {
    id: 'skill-freestyle-start',
    name: '即兴起步 Freestyle Basics',
    category: '编舞与创作',
    difficulty: 2,
    description: '用 3-5 个熟悉动作跟随音乐完成简单即兴。',
  },
  {
    id: 'skill-isolation-combo',
    name: '多部位隔离组合',
    category: '隔离控制',
    difficulty: 2,
    description: '头、肩、胸、胯按顺序或同时完成隔离组合。',
  },
  {
    id: 'skill-contraction',
    name: '身体延展与收缩 Contraction & Release',
    category: '身体开发',
    difficulty: 2,
    description: '脊柱的收缩与释放有控制，呼吸配合动作。',
  },

  // ---------- 3 星：进阶技巧 ----------
  {
    id: 'skill-spotting-turn',
    name: '二位转留头留眼 Spotting Turn',
    category: '旋转技巧',
    difficulty: 3,
    description: '完成一圈以上定点转，视线留头、身体不晃。',
  },
  {
    id: 'skill-pas-de-bourree',
    name: '三连步 Pas de Bourrée',
    category: '脚步与重心',
    difficulty: 3,
    description: '三步换重心衔接转体或步伐，脚下干净。',
  },
  {
    id: 'skill-hair-whip',
    name: '甩头与发丝控制 Hair Whip',
    category: '表现力',
    difficulty: 3,
    description: '甩头借助身体发力，颈部安全且线条利落。',
  },
  {
    id: 'skill-floorwork-basic',
    name: '地面起身与滚地基础 Floorwork',
    category: '地面技巧',
    difficulty: 3,
    description: '安全完成落地、滚地与起身，动作衔接流畅。',
  },
  {
    id: 'skill-core-hit',
    name: '中段核心爆发 Core Hit',
    category: '隔离控制',
    difficulty: 3,
    description: '核心瞬间收紧带动胸腔出点，力量集中不外散。',
  },
  {
    id: 'skill-syncopation',
    name: '快歌切分音卡点 Syncopation',
    category: '音乐性',
    difficulty: 3,
    description: '在切分音与弱拍上完成发力，节奏层次清楚。',
  },
  {
    id: 'skill-heels-walk',
    name: '高跟基础行走与重心',
    category: '高跟 Jazz',
    difficulty: 3,
    description: '穿粗跟稳定行走、转身，脚踝与膝盖保持安全。',
  },
  {
    id: 'skill-choreo-short',
    name: '短句编舞记忆与复现',
    category: '编舞与创作',
    difficulty: 3,
    description: '快速记住 4 个 8 拍以内的短句并完整复现。',
  },
  {
    id: 'skill-emotion-face',
    name: '面部情绪与眼神表达',
    category: '表现力',
    difficulty: 3,
    description: '动作中加入情绪变化与眼神方向，表达不空。',
  },
  {
    id: 'skill-layering',
    name: '身体层次与轻重对比 Layering',
    category: '身体开发',
    difficulty: 3,
    description: '同一动作做出快慢、轻重与大小的层次变化。',
  },

  // ---------- 4 星：高阶组合 ----------
  {
    id: 'skill-double-spin',
    name: '连续双圈旋转 Double Spotting',
    category: '旋转技巧',
    difficulty: 4,
    description: '稳定完成两圈以上定点转，收势不抢拍。',
  },
  {
    id: 'skill-heels-balance',
    name: '细跟平衡与 Move',
    category: '高跟 Jazz',
    difficulty: 4,
    description: '细跟状态下完成移动、转体与定点，重心稳定。',
  },
  {
    id: 'skill-floor-drop',
    name: '地面 Drop / Slide 过渡',
    category: '地面技巧',
    difficulty: 4,
    description: '安全完成下坠、滑步与地面过渡，保护膝盖。',
  },
  {
    id: 'skill-dynamics',
    name: '爆发力层次 Dynamics Layering',
    category: '表现力',
    difficulty: 4,
    description: '同一组合中实现强弱、快慢、收放的明显对比。',
  },
  {
    id: 'skill-fast-choreo',
    name: '大段编舞快速学习（8×8）',
    category: '编舞与创作',
    difficulty: 4,
    description: '一节课内掌握 8 个 8 拍以上的编舞并顺完。',
  },
  {
    id: 'skill-group-sync',
    name: '群舞同步与走位',
    category: '编舞与创作',
    difficulty: 4,
    description: '多人队形中保持动作同步、间距与走位准确。',
  },
  {
    id: 'skill-improv-solo',
    name: '即兴 Solo 音乐性编排',
    category: '音乐性',
    difficulty: 4,
    description: '根据音乐结构自主组织 30 秒以上即兴 Solo。',
  },
  {
    id: 'skill-heels-combo',
    name: '高跟爵士组合 Heels Combo',
    category: '高跟 Jazz',
    difficulty: 4,
    description: '完整完成一段高跟爵士组合，兼顾力量与线条。',
  },

  // ---------- 5 星：舞台与创作 ----------
  {
    id: 'skill-performance',
    name: '舞台表现与镜头感 Performance',
    category: '表现力',
    difficulty: 5,
    description: '面向观众或镜头完成完整作品，表情、视线与能量稳定。',
  },
  {
    id: 'skill-choreo-create',
    name: '高阶编舞创作与重组',
    category: '编舞与创作',
    difficulty: 5,
    description: '能围绕音乐主题自主创作并重组完整舞段。',
  },
  {
    id: 'skill-fusion',
    name: '多风格融合 Jazz Funk × Contemporary',
    category: '编舞与创作',
    difficulty: 5,
    description: '融合两种以上风格，动作语汇衔接自然不生硬。',
  },
  {
    id: 'skill-full-stage',
    name: '完整作品舞台呈现',
    category: '表现力',
    difficulty: 5,
    description: '独立完成 2 分钟以上作品，具备完整起承转合。',
  },
  {
    id: 'skill-master-class',
    name: '大师课动作复刻与个人风格',
    category: '编舞与创作',
    difficulty: 5,
    description: '高难度大师课组合可复刻，并形成稳定的个人表达。',
  },
];

// ---------------------------------------------------------------- 存储读写

export const loadSkills = (): JazzSkill[] => {
  try {
    const raw = localStorage.getItem(SKILLS_STORAGE_KEY);
    if (raw === null) return DEFAULT_JAZZ_SKILLS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as JazzSkill[]) : DEFAULT_JAZZ_SKILLS;
  } catch {
    return DEFAULT_JAZZ_SKILLS;
  }
};

export const loadCheckIns = (): SkillCheckIn[] => {
  try {
    const raw = localStorage.getItem(CHECKINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SkillCheckIn[]) : [];
  } catch {
    return [];
  }
};

export const saveSkills = (skills: JazzSkill[]): void => {
  try {
    syncSetItem(SKILLS_STORAGE_KEY, JSON.stringify(skills));
  } catch {
    // 配额或隐私模式下静默失败，页面仍可用当前会话状态
  }
  notifyChange();
};

export const saveCheckIns = (checkIns: SkillCheckIn[]): void => {
  try {
    syncSetItem(CHECKINS_STORAGE_KEY, JSON.stringify(checkIns));
  } catch {
    // 同上
  }
  notifyChange();
};

// ---------------------------------------------------------------- 状态派生

/**
 * 按技能聚合打卡记录，再根据难度层级推导解锁 / 完成状态。
 * 规则：上一难度层至少掌握 1 个动作才解锁下一层。
 */
export function computeSkillStates(skills: JazzSkill[], checkIns: SkillCheckIn[]): SkillWithState[] {
  const recordsBySkill = new Map<string, SkillCheckIn[]>();
  checkIns.forEach((record) => {
    const list = recordsBySkill.get(record.skillId) ?? [];
    list.push(record);
    recordsBySkill.set(record.skillId, list);
  });

  const masteredByLevel: Record<SkillLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  skills.forEach((skill) => {
    const records = recordsBySkill.get(skill.id) ?? [];
    if (records.some((record) => record.status === 'mastered')) {
      masteredByLevel[skill.difficulty] += 1;
    }
  });

  return skills.map((skill) => {
    const records = [...(recordsBySkill.get(skill.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    const locked = skill.difficulty > 1 && masteredByLevel[(skill.difficulty - 1) as SkillLevel] < 1;
    const hasMastered = records.some((record) => record.status === 'mastered');
    const status: SkillStateStatus = locked
      ? 'locked'
      : hasMastered
        ? 'mastered'
        : records.length > 0
          ? 'practicing'
          : 'available';
    return { skill, status, locked, records };
  });
}

// ---------------------------------------------------------------- 日期工具

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDay = (key: string): Date | null => {
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const midnight = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// ---------------------------------------------------------------- 统计模型

export interface CategoryProgress {
  category: SkillCategory;
  total: number;
  mastered: number;
  practicing: number;
  ratio: number; // 0-1
}

export interface LevelProgress {
  level: SkillLevel;
  title: string;
  total: number;
  mastered: number;
  ratio: number;
}

export interface MonthPoint {
  month: string; // YYYY-MM
  label: string; // e.g. 11月
  mastered: number; // 当月新掌握
  cumulative: number; // 累计掌握
  checkIns: number; // 当月打卡次数
}

export interface HeatCell {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  current: number;
  target: number;
  ratio: number;
}

export interface GrowthStats {
  totalCheckIns: number;
  practiceDayCount: number; // 有打卡的自然日数
  practiceAgeDays: number; // 舞龄（起步日至今天数）
  currentStreak: number;
  longestStreak: number;
  masteredCount: number;
  practicingCount: number;
  totalSkillCount: number;
  completionRatio: number;
  todayChecked: boolean;
  firstPracticeDate: string | null;
  lastPracticeDate: string | null;
  categoryProgress: CategoryProgress[];
  levelProgress: LevelProgress[];
  monthly: MonthPoint[];
  heatWeeks: HeatCell[][];
  recentFourWeeks: number;
  previousFourWeeks: number;
  milestones: Milestone[];
  strongestCategory: CategoryProgress | null;
  weakestCategory: CategoryProgress | null;
}

/** 计算连续打卡：从最近一天往回数，断档即止 */
function computeStreaks(sortedDates: string[], today: Date): { current: number; longest: number } {
  if (sortedDates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDates.length; i += 1) {
    const prev = parseDay(sortedDates[i - 1]);
    const curr = parseDay(sortedDates[i]);
    if (!prev || !curr) continue;
    const gap = Math.round((midnight(curr).getTime() - midnight(prev).getTime()) / DAY_MS);
    run = gap === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const last = parseDay(sortedDates[sortedDates.length - 1]);
  if (!last) return { current: 0, longest };
  const sinceLast = Math.round((midnight(today).getTime() - midnight(last).getTime()) / DAY_MS);
  if (sinceLast > 1) return { current: 0, longest };

  let current = 1;
  for (let i = sortedDates.length - 1; i > 0; i -= 1) {
    const prev = parseDay(sortedDates[i - 1]);
    const curr = parseDay(sortedDates[i]);
    if (!prev || !curr) break;
    const gap = Math.round((midnight(curr).getTime() - midnight(prev).getTime()) / DAY_MS);
    if (gap !== 1) break;
    current += 1;
  }
  return { current, longest };
}

/** 最近 12 周热力图（周一为一周起点，末尾对齐本周） */
function computeHeatWeeks(countsByDate: Map<string, number>, today: Date): HeatCell[][] {
  const todayMidnight = midnight(today);
  const weekday = (todayMidnight.getDay() + 6) % 7; // 周一=0
  const thisWeekMonday = new Date(todayMidnight.getTime() - weekday * DAY_MS);
  const firstMonday = new Date(thisWeekMonday.getTime() - 11 * 7 * DAY_MS);
  const todayKey = toDayKey(todayMidnight);

  const weeks: HeatCell[][] = [];
  for (let w = 0; w < 12; w += 1) {
    const week: HeatCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(firstMonday.getTime() + (w * 7 + d) * DAY_MS);
      const key = toDayKey(date);
      const future = key > todayKey;
      const count = future ? 0 : (countsByDate.get(key) ?? 0);
      const level: HeatCell['level'] = future
        ? 0
        : count === 0
          ? 0
          : count === 1
            ? 1
            : count === 2
              ? 2
              : count === 3
                ? 3
                : 4;
      week.push({ date: key, count, level });
    }
    weeks.push(week);
  }
  return weeks;
}

/** 近 12 个月成长序列（不足 12 个月时按实际跨度） */
function computeMonthly(masteredDates: string[], checkIns: SkillCheckIn[], today: Date): MonthPoint[] {
  const nowMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const allKeys = [...masteredDates, ...checkIns.map((c) => c.date)].filter(Boolean).sort();
  let startMonth = allKeys.length > 0 ? parseDay(allKeys[0]) : null;
  if (startMonth) startMonth = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);

  const twelveAgo = new Date(nowMonth.getFullYear(), nowMonth.getMonth() - 11, 1);
  if (!startMonth || startMonth < twelveAgo) startMonth = twelveAgo;

  const points: MonthPoint[] = [];
  let cumulative = masteredDates.filter((date) => date < toDayKey(startMonth as Date)).length;

  const cursor = new Date(startMonth);
  while (cursor <= nowMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = (date: string) => date.startsWith(key);
    const mastered = masteredDates.filter(inMonth).length;
    cumulative += mastered;
    points.push({
      month: key,
      label: `${cursor.getMonth() + 1}月`,
      mastered,
      cumulative,
      checkIns: checkIns.filter((c) => inMonth(c.date)).length,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

function buildMilestones(input: {
  totalCheckIns: number;
  longestStreak: number;
  masteredCount: number;
  practiceAgeDays: number;
  levelProgress: LevelProgress[];
  categoryProgress: CategoryProgress[];
  hasFiveStar: boolean;
}): Milestone[] {
  const { totalCheckIns, longestStreak, masteredCount, practiceAgeDays, levelProgress, categoryProgress, hasFiveStar } =
    input;

  const entryLevel = levelProgress[0];
  const fullCategory = categoryProgress.find((c) => c.total > 0 && c.mastered === c.total);
  const fullCategoryMastered = fullCategory ? fullCategory.mastered : 0;

  const defs: Array<Omit<Milestone, 'unlocked' | 'ratio'> & { current: number; target: number }> = [
    {
      id: 'first-checkin',
      title: '第一支舞',
      description: '完成第一次技能打卡',
      emoji: '🌱',
      current: totalCheckIns,
      target: 1,
    },
    { id: 'streak-3', title: '三日不辍', description: '连续 3 天练习', emoji: '🔥', current: longestStreak, target: 3 },
    { id: 'streak-7', title: '一周舞者', description: '连续 7 天练习', emoji: '⚡', current: longestStreak, target: 7 },
    {
      id: 'streak-30',
      title: '月度铁人',
      description: '连续 30 天练习',
      emoji: '🏅',
      current: longestStreak,
      target: 30,
    },
    {
      id: 'mastered-1',
      title: '第一个动作',
      description: '掌握 1 个动作',
      emoji: '✨',
      current: masteredCount,
      target: 1,
    },
    {
      id: 'mastered-5',
      title: '手感来了',
      description: '掌握 5 个动作',
      emoji: '💫',
      current: masteredCount,
      target: 5,
    },
    {
      id: 'mastered-10',
      title: '十项全能',
      description: '掌握 10 个动作',
      emoji: '🎯',
      current: masteredCount,
      target: 10,
    },
    {
      id: 'mastered-20',
      title: '半程舞者',
      description: '掌握 20 个动作',
      emoji: '🌟',
      current: masteredCount,
      target: 20,
    },
    {
      id: 'level1-clear',
      title: '入门通关',
      description: '掌握全部入门基础动作',
      emoji: '🧱',
      current: entryLevel ? entryLevel.mastered : 0,
      target: entryLevel ? entryLevel.total : 1,
    },
    {
      id: 'category-clear',
      title: '单项满级',
      description: '任意分类全部掌握',
      emoji: '🏆',
      current: fullCategory ? fullCategoryMastered : 0,
      target: fullCategory ? fullCategory.total : 1,
    },
    {
      id: 'age-30',
      title: '满月舞龄',
      description: '坚持跳舞满 30 天',
      emoji: '🌙',
      current: practiceAgeDays,
      target: 30,
    },
    {
      id: 'age-100',
      title: '百日筑基',
      description: '坚持跳舞满 100 天',
      emoji: '💯',
      current: practiceAgeDays,
      target: 100,
    },
    {
      id: 'checkins-50',
      title: '五十次打卡',
      description: '累计打卡 50 次',
      emoji: '📅',
      current: totalCheckIns,
      target: 50,
    },
    {
      id: 'five-star',
      title: '五星挑战者',
      description: '掌握 1 个 5 星难度动作',
      emoji: '👑',
      current: hasFiveStar ? 1 : 0,
      target: 1,
    },
  ];

  return defs.map((def) => {
    const current = Math.min(def.current, def.target);
    return {
      ...def,
      unlocked: def.current >= def.target,
      ratio: def.target === 0 ? 0 : Math.min(1, current / def.target),
    };
  });
}

/** 成长统计总入口：纯函数，输入原始记录，输出可展示指标 */
export function computeGrowthStats(
  skills: JazzSkill[],
  checkIns: SkillCheckIn[],
  startDate: string | null,
  now: Date = new Date()
): GrowthStats {
  const states = computeSkillStates(skills, checkIns);
  const todayKey = toDayKey(now);

  const countsByDate = new Map<string, number>();
  checkIns.forEach((record) => {
    countsByDate.set(record.date, (countsByDate.get(record.date) ?? 0) + 1);
  });
  const sortedDates = [...countsByDate.keys()].sort();

  // 每个技能的"掌握日"取最早的 mastered 记录
  const masteredDates: string[] = [];
  let hasFiveStar = false;
  states.forEach((state) => {
    if (state.status === 'mastered') {
      const date = [...state.records]
        .filter((r) => r.status === 'mastered')
        .map((r) => r.date)
        .sort()[0];
      if (date) masteredDates.push(date);
      if (state.skill.difficulty === 5) hasFiveStar = true;
    }
  });

  const masteredCount = states.filter((s) => s.status === 'mastered').length;
  const practicingCount = states.filter((s) => s.status === 'practicing').length;

  const { current: currentStreak, longest: longestStreak } = computeStreaks(sortedDates, now);

  const practiceAgeDays = startDate
    ? computePracticeDays(startDate, now)
    : sortedDates.length > 0
      ? computePracticeDays(sortedDates[0], now)
      : 0;

  const categoryProgress: CategoryProgress[] = SKILL_CATEGORIES.map((category) => {
    const items = states.filter((s) => s.skill.category === category);
    const mastered = items.filter((s) => s.status === 'mastered').length;
    const practicing = items.filter((s) => s.status === 'practicing').length;
    return {
      category,
      total: items.length,
      mastered,
      practicing,
      ratio: items.length === 0 ? 0 : mastered / items.length,
    };
  });

  const levelProgress: LevelProgress[] = ([1, 2, 3, 4, 5] as SkillLevel[]).map((level) => {
    const items = states.filter((s) => s.skill.difficulty === level);
    const mastered = items.filter((s) => s.status === 'mastered').length;
    return {
      level,
      title: LEVEL_TITLES[level],
      total: items.length,
      mastered,
      ratio: items.length === 0 ? 0 : mastered / items.length,
    };
  });

  const lastFourWeeksStart = new Date(midnight(now).getTime() - 27 * DAY_MS);
  const prevFourWeeksStart = new Date(midnight(now).getTime() - 55 * DAY_MS);
  const inRange = (date: string, from: Date) => {
    const d = parseDay(date);
    return !!d && midnight(d) >= from;
  };
  const recentFourWeeks = checkIns.filter((c) => inRange(c.date, lastFourWeeksStart)).length;
  const previousFourWeeks = checkIns.filter(
    (c) => inRange(c.date, prevFourWeeksStart) && !inRange(c.date, lastFourWeeksStart)
  ).length;

  const withSkills = categoryProgress.filter((c) => c.total > 0);
  const strongestCategory = withSkills.length
    ? [...withSkills].sort((a, b) => b.ratio - a.ratio || b.mastered - a.mastered)[0]
    : null;
  const weakestCategory = withSkills.length
    ? [...withSkills].sort((a, b) => a.ratio - b.ratio || a.mastered - b.mastered)[0]
    : null;

  return {
    totalCheckIns: checkIns.length,
    practiceDayCount: sortedDates.length,
    practiceAgeDays,
    currentStreak,
    longestStreak,
    masteredCount,
    practicingCount,
    totalSkillCount: skills.length,
    completionRatio: skills.length === 0 ? 0 : masteredCount / skills.length,
    todayChecked: countsByDate.has(todayKey),
    firstPracticeDate: sortedDates[0] ?? null,
    lastPracticeDate: sortedDates[sortedDates.length - 1] ?? null,
    categoryProgress,
    levelProgress,
    monthly: computeMonthly(masteredDates, checkIns, now),
    heatWeeks: computeHeatWeeks(countsByDate, now),
    recentFourWeeks,
    previousFourWeeks,
    milestones: buildMilestones({
      totalCheckIns: checkIns.length,
      longestStreak,
      masteredCount,
      practiceAgeDays,
      levelProgress,
      categoryProgress,
      hasFiveStar,
    }),
    strongestCategory,
    weakestCategory,
  };
}
