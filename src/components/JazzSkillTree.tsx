import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Star,
  Lock,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  CheckCircle2,
  Calendar,
  History,
  ArrowDown,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';
import type {
  CheckInStatus,
  JazzSkill,
  SkillCategory,
  SkillCheckIn,
  SkillLevel,
  SkillStateStatus,
  SkillWithState,
} from '../types/skill';
import {
  SKILL_CATEGORIES,
  DEFAULT_JAZZ_SKILLS,
  computeSkillStates,
  loadCheckIns,
  loadSkills,
  saveCheckIns,
  saveSkills,
} from '../utils/skillData';

// 技能类型与技能库已抽到 types/skill.ts 与 utils/skillData.ts，
// 这里保留同名导出，避免既有引用方改动。
export type {
  CheckInStatus,
  JazzSkill,
  SkillCategory,
  SkillCheckIn,
  SkillLevel,
  SkillStateStatus,
  SkillWithState,
} from '../types/skill';
export { SKILL_CATEGORIES, DEFAULT_JAZZ_SKILLS } from '../utils/skillData';

const LEVEL_META: Record<SkillLevel, { title: string; chip: string; cardBg: string; cardBorder: string }> = {
  1: { title: '入门基础', chip: 'bg-emerald-100 text-emerald-700', cardBg: 'bg-emerald-50/60', cardBorder: 'border-emerald-200' },
  2: { title: '基础组合', chip: 'bg-sky-100 text-sky-700', cardBg: 'bg-sky-50/60', cardBorder: 'border-sky-200' },
  3: { title: '进阶技巧', chip: 'bg-amber-100 text-amber-700', cardBg: 'bg-amber-50/60', cardBorder: 'border-amber-200' },
  4: { title: '高阶组合', chip: 'bg-rose-100 text-rose-700', cardBg: 'bg-rose-50/60', cardBorder: 'border-rose-200' },
  5: { title: '舞台与创作', chip: 'bg-violet-100 text-violet-700', cardBg: 'bg-violet-50/60', cardBorder: 'border-violet-200' },
};

const STATUS_META: Record<SkillStateStatus, { label: string; badge: string }> = {
  locked: { label: '未解锁', badge: 'bg-stone-100 text-stone-500' },
  available: { label: '待练习', badge: 'bg-[#FAF2EB] text-[#78695C]' },
  practicing: { label: '练习中', badge: 'bg-amber-50 text-[#B45309]' },
  mastered: { label: '已掌握', badge: 'bg-emerald-50 text-emerald-700' },
};

const todayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
};

const StarRating: React.FC<{ value: number; size?: string }> = ({ value, size = 'w-3 h-3' }) => (
  <span className="inline-flex items-center gap-0.5 shrink-0" aria-label={`难度 ${value} 星`}>
    {[1, 2, 3, 4, 5].map((level) => (
      <Star
        key={level}
        className={`${size} ${level <= value ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D9C4B4]'}`}
      />
    ))}
  </span>
);

interface SkillFormState {
  id?: string;
  name: string;
  category: SkillCategory;
  difficulty: SkillLevel;
  description: string;
}

type PendingConfirm =
  | { type: 'delete-skill'; skill: JazzSkill }
  | { type: 'delete-checkin'; record: SkillCheckIn; skillName: string }
  | null;

export const JazzSkillTree: React.FC = () => {
  const [skills, setSkills] = useState<JazzSkill[]>(loadSkills);
  const [checkIns, setCheckIns] = useState<SkillCheckIn[]>(loadCheckIns);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [checkInDate, setCheckInDate] = useState<string>(todayString);
  const [checkInStatus, setCheckInStatus] = useState<CheckInStatus>('practicing');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 技能库二级窗口
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'全部' | SkillCategory>('全部');
  const [filterLevel, setFilterLevel] = useState<'全部' | SkillLevel>('全部');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<SkillFormState>({
    name: '',
    category: '基础律动',
    difficulty: 1,
    description: '',
  });
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  // 持久化：技能库与打卡记录分别独立存储，写入后广播变更供成长报告刷新
  useEffect(() => {
    saveSkills(skills);
  }, [skills]);

  useEffect(() => {
    saveCheckIns(checkIns);
  }, [checkIns]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // 技能库弹窗支持 Esc 关闭
  useEffect(() => {
    if (!isLibraryOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLibraryOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLibraryOpen]);

  // 状态派生交给 utils/skillData —— 与成长报告共用同一套规则，避免两处口径不一致
  const skillStates = useMemo<SkillWithState[]>(
    () => computeSkillStates(skills, checkIns),
    [skills, checkIns]
  );

  const stateById = useMemo(() => {
    const map = new Map<string, SkillWithState>();
    skillStates.forEach((state) => map.set(state.skill.id, state));
    return map;
  }, [skillStates]);

  const masteredCount = skillStates.filter((state) => state.status === 'mastered').length;
  const practicingCount = skillStates.filter((state) => state.status === 'practicing').length;
  const practiceDayCount = new Set(checkIns.map((record) => record.date)).size;

  const levelGroups = useMemo(
    () =>
      ([1, 2, 3, 4, 5] as SkillLevel[]).map((level) => ({
        level,
        items: skillStates.filter((state) => state.skill.difficulty === level),
      })),
    [skillStates]
  );

  // 打卡历史：按日期倒序，关联技能信息
  const sortedHistory = useMemo(
    () =>
      [...checkIns]
        .sort((a, b) =>
          a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)
        )
        .map((record) => ({
          record,
          skill: skills.find((item) => item.id === record.skillId),
        }))
        .filter((item) => item.skill),
    [checkIns, skills]
  );

  const visibleHistory = showAllHistory ? sortedHistory : sortedHistory.slice(0, 6);

  // 技能库筛选结果
  const filteredSkills = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return skillStates.filter(({ skill }) => {
      if (filterCategory !== '全部' && skill.category !== filterCategory) return false;
      if (filterLevel !== '全部' && skill.difficulty !== filterLevel) return false;
      if (!keyword) return true;
      return (
        skill.name.toLowerCase().includes(keyword) ||
        skill.description.toLowerCase().includes(keyword) ||
        skill.category.toLowerCase().includes(keyword)
      );
    });
  }, [skillStates, searchTerm, filterCategory, filterLevel]);

  const toggleSelect = (skillId: string) => {
    const state = stateById.get(skillId);
    if (!state || state.locked) return;
    setSelectedIds((prev) =>
      prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
    );
  };

  const handleSaveCheckIn = () => {
    if (!checkInDate) {
      setToast('请选择打卡日期');
      return;
    }
    const validIds = selectedIds.filter((skillId) => {
      const state = stateById.get(skillId);
      return state && !state.locked;
    });
    if (validIds.length === 0) {
      setToast('请先勾选要打卡的技能');
      return;
    }

    setCheckIns((prev) => {
      const next = [...prev];
      validIds.forEach((skillId, index) => {
        const existingIndex = next.findIndex(
          (record) => record.skillId === skillId && record.date === checkInDate
        );
        if (existingIndex >= 0) {
          // 同一技能同一天只保留一条记录，重复保存视为更新完成状态，避免重复计数
          next[existingIndex] = { ...next[existingIndex], status: checkInStatus };
        } else {
          next.push({
            id: `checkin-${Date.now()}-${index}-${skillId}`,
            skillId,
            date: checkInDate,
            status: checkInStatus,
          });
        }
      });
      return next;
    });

    setSelectedIds([]);
    setToast(
      `已记录 ${checkInDate} 的 ${validIds.length} 个技能打卡（${
        checkInStatus === 'mastered' ? '已掌握' : '练习中'
      }）`
    );
  };

  const openLibrary = () => {
    setSearchTerm('');
    setFilterCategory('全部');
    setFilterLevel('全部');
    setIsFormOpen(false);
    setFormError('');
    setIsLibraryOpen(true);
  };

  const openCreateForm = () => {
    setForm({ name: '', category: '基础律动', difficulty: 1, description: '' });
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (skill: JazzSkill) => {
    setForm({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      difficulty: skill.difficulty,
      description: skill.description,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmitSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFormError('请填写技能动作名称');
      return;
    }
    const duplicated = skills.some(
      (skill) => skill.id !== form.id && skill.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicated) {
      setFormError('技能库中已存在同名动作，请调整名称');
      return;
    }

    const payload = {
      name,
      category: form.category,
      difficulty: form.difficulty,
      description: form.description.trim(),
    };

    if (form.id) {
      setSkills((prev) =>
        prev.map((skill) => (skill.id === form.id ? { ...skill, ...payload } : skill))
      );
      setToast('技能动作已更新');
    } else {
      setSkills((prev) => [
        ...prev,
        { id: `skill-${Date.now()}`, ...payload, isCustom: true },
      ]);
      setToast('新技能动作已添加到技能库');
    }

    setIsFormOpen(false);
    setFormError('');
  };

  const handleConfirmDelete = () => {
    if (!pendingConfirm) return;

    if (pendingConfirm.type === 'delete-skill') {
      const { skill } = pendingConfirm;
      setSkills((prev) => prev.filter((item) => item.id !== skill.id));
      setCheckIns((prev) => prev.filter((record) => record.skillId !== skill.id));
      setSelectedIds((prev) => prev.filter((id) => id !== skill.id));
      if (form.id === skill.id) {
        setIsFormOpen(false);
      }
      setToast(`已从技能库删除「${skill.name}」及其打卡记录`);
    } else {
      const { record } = pendingConfirm;
      setCheckIns((prev) => prev.filter((item) => item.id !== record.id));
      setToast('该条打卡记录已删除');
    }

    setPendingConfirm(null);
  };

  return (
    <section className="bg-white border border-[#EFE3D5] rounded-3xl p-6 shadow-xs space-y-5">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#292524] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#8B5CF6]" />
            <span>爵士舞技能动作库</span>
          </h3>
          <p className="text-xs text-[#78695C] mt-1 leading-relaxed">
            按真实难度 1-5 星组织的技能树 · 共 {skills.length} 个动作 · 勾选技能即可记录每日打卡
          </p>
        </div>
        <button
          type="button"
          onClick={openLibrary}
          className="self-start shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>更多技能</span>
        </button>
      </div>

      {/* 2. Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: '技能总数', value: skills.length, sub: '技能库动作', icon: Award, tone: 'text-[#8B5CF6]' },
          { label: '已掌握', value: masteredCount, sub: `总进度 ${skills.length ? Math.round((masteredCount / skills.length) * 100) : 0}%`, icon: CheckCircle2, tone: 'text-emerald-600' },
          { label: '练习中', value: practicingCount, sub: '尚未标记掌握', icon: Sparkles, tone: 'text-[#E67E22]' },
          { label: '累计打卡', value: checkIns.length, sub: `${practiceDayCount} 个练习日`, icon: Calendar, tone: 'text-[#E65B47]' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-[#FAF2EB] border border-[#F0E4D8] rounded-2xl p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-[#8C7A6B] font-medium">
                <Icon className={`w-3 h-3 ${item.tone}`} />
                <span>{item.label}</span>
              </div>
              <span className="text-lg font-mono font-bold text-[#292524] block leading-tight mt-1">
                {item.value}
              </span>
              <span className="text-[10px] text-[#A89888] block">{item.sub}</span>
            </div>
          );
        })}
      </div>

      {/* 3. Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-[#78695C] mb-1.5">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF7E67]" />
            技能树掌握进度
          </span>
          <span className="font-mono">
            {masteredCount} / {skills.length}
          </span>
        </div>
        <div className="w-full h-2 bg-[#E8DACB] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#FF7E67] to-[#8B5CF6] rounded-full transition-all"
            style={{ width: `${skills.length ? (masteredCount / skills.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 4. Check-in toolbar */}
      <div className="bg-[#FFF8F1] border border-[#F6DCBE] rounded-2xl p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-[#574B40]">
            <Calendar className="w-3.5 h-3.5 text-[#E67E22]" />
            <span>打卡日期</span>
          </label>
          <input
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/40"
          />

          <div className="flex items-center p-0.5 bg-white border border-[#E8DACB] rounded-lg">
            {(['practicing', 'mastered'] as CheckInStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setCheckInStatus(status)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  checkInStatus === status
                    ? 'bg-[#FF7E67] text-white'
                    : 'text-[#78695C] hover:text-[#292524]'
                }`}
              >
                {status === 'mastered' ? '已掌握' : '练习中'}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-[#78695C]">
            已选 <strong className="text-[#E65B47] font-mono">{selectedIds.length}</strong> 个技能
          </span>

          <button
            type="button"
            onClick={handleSaveCheckIn}
            disabled={selectedIds.length === 0}
            className="ml-auto px-3.5 py-1.5 bg-[#E65B47] hover:bg-[#D95338] disabled:bg-[#E8D5CC] disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            记录本次打卡
          </button>
        </div>
        <p className="text-[10px] text-[#A89888] leading-relaxed">
          勾选下方已解锁的技能卡片后点击记录；同一技能同一天只保留一条记录，重复保存会更新完成情况。
        </p>
      </div>

      {/* 5. Skill Tree */}
      <div className="space-y-3">
        {levelGroups.map(({ level, items }) => {
          const meta = LEVEL_META[level];
          const levelMastered = items.filter((item) => item.status === 'mastered').length;
          const unlockHint =
            level === 1 ? '默认解锁' : `掌握任意 1 个 ${level - 1} 星技能后解锁`;
          return (
            <div key={level}>
              {level > 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="w-4 h-4 text-[#D9C4B4]" />
                </div>
              )}
              <div className={`rounded-2xl border ${meta.cardBorder} ${meta.cardBg} p-3 space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${meta.chip}`}>
                      Lv.{level}
                    </span>
                    <span className="text-xs font-bold text-[#3D3126]">{meta.title}</span>
                    <StarRating value={level} size="w-2.5 h-2.5" />
                  </div>
                  <span className="text-[10px] text-[#8C7A6B] font-mono">
                    掌握 {levelMastered}/{items.length} · {unlockHint}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((state) => {
                    const selected = selectedIds.includes(state.skill.id);
                    const metaStatus = STATUS_META[state.status];
                    return (
                      <button
                        key={state.skill.id}
                        type="button"
                        onClick={() => toggleSelect(state.skill.id)}
                        disabled={state.locked}
                        aria-pressed={selected}
                        title={state.locked ? `${unlockHint}：${state.skill.name}` : state.skill.description}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          state.locked
                            ? 'bg-[#F9F7F5] border-[#EADCCE] opacity-60 cursor-not-allowed'
                            : selected
                            ? 'bg-white border-[#E65B47] ring-2 ring-[#FF7E67]/30 shadow-xs cursor-pointer'
                            : 'bg-white/80 border-[#EFE3D5] hover:border-[#FFB39E] hover:shadow-xs cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-0.5 w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-[#FF7E67] border-[#E65B47]'
                                : 'bg-white border-[#D9C4B4]'
                            }`}
                          >
                            {selected ? (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            ) : state.locked ? (
                              <Lock className="w-2.5 h-2.5 text-[#A89888]" />
                            ) : null}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="text-[11px] font-bold text-[#292524] truncate">
                                {state.skill.name}
                              </span>
                              <StarRating value={state.skill.difficulty} size="w-2.5 h-2.5" />
                            </div>
                            <p className="text-[10px] text-[#78695C] mt-0.5 line-clamp-2 leading-snug">
                              {state.skill.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-[9px] bg-[#FAF2EB] border border-[#F0E4D8] text-[#8C7A6B] px-1.5 py-0.5 rounded">
                                {state.skill.category}
                              </span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${metaStatus.badge}`}>
                                {metaStatus.label}
                              </span>
                              {state.records.length > 0 && (
                                <span className="text-[9px] text-[#A89888] font-mono">
                                  {state.records.length} 次
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. Check-in history */}
      <div className="border border-[#EFE3D5] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHistoryOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#FFFDFB] hover:bg-[#FAF2EB] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5 text-xs font-bold text-[#3D3126]">
            <History className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>打卡历史与进度统计</span>
            <span className="text-[10px] font-mono text-[#A89888]">
              共 {checkIns.length} 条 · {practiceDayCount} 天
            </span>
          </span>
          <span className="text-[11px] text-[#A89888]">
            {isHistoryOpen ? '收起' : '展开'}
          </span>
        </button>

        {isHistoryOpen && (
          <div className="px-3.5 py-2.5 border-t border-[#F2E5D8] space-y-1.5">
            {sortedHistory.length === 0 ? (
              <p className="text-[11px] text-[#A89888] py-1">
                还没有技能打卡记录。勾选技能并记录后，这里会按日期展示真实练习历史。
              </p>
            ) : (
              visibleHistory.map(({ record, skill }) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#FFFDFB] border border-[#F2E5D8]"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#8C7A6B] shrink-0">
                      {record.date}
                    </span>
                    <span className="text-[11px] font-semibold text-[#292524] truncate">
                      {skill?.name}
                    </span>
                    <span className="text-[9px] text-[#A89888] shrink-0">{skill?.category}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                        record.status === 'mastered'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-[#B45309]'
                      }`}
                    >
                      {record.status === 'mastered' ? '已掌握' : '练习中'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingConfirm({
                          type: 'delete-checkin',
                          record,
                          skillName: skill?.name ?? '该技能',
                        })
                      }
                      aria-label="删除该条打卡记录"
                      className="p-1 rounded text-[#C4AFA5] hover:text-[#DC2626] hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}

            {sortedHistory.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="text-[10px] text-[#8B5CF6] hover:text-[#7C3AED] font-semibold px-1 py-1 cursor-pointer"
              >
                {showAllHistory ? '收起为最近 6 条' : `查看全部 ${sortedHistory.length} 条记录`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-medium animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* 7. Skill library modal */}
      {isLibraryOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skill-library-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLibraryOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-[#EFE3D5] overflow-hidden animate-scaleUp">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-[#F1E5D8] bg-[#FFFDFB]">
              <div>
                <h3 id="skill-library-title" className="text-base font-bold text-[#292524] flex items-center gap-2">
                  <Award className="w-4 h-4 text-[#8B5CF6]" />
                  <span>爵士舞技能库</span>
                </h3>
                <p className="text-[11px] text-[#78695C] mt-0.5">
                  共 {skills.length} 个动作 · 已掌握 {masteredCount} 个 · 支持新增、编辑与删除
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                aria-label="关闭技能库"
                className="p-1.5 rounded-lg text-[#A8988A] hover:text-[#292524] hover:bg-[#FAF2EB] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal tools */}
            <div className="px-5 sm:px-6 py-3 border-b border-[#F1E5D8] space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-[#E3D4C5] rounded-lg flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-[#A89888] shrink-0" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜索技能名称、分类或描述"
                    className="w-full text-xs bg-transparent focus:outline-none"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as '全部' | SkillCategory)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none"
                >
                  <option value="全部">全部分类</option>
                  {SKILL_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={filterLevel}
                  onChange={(e) =>
                    setFilterLevel(e.target.value === '全部' ? '全部' : (Number(e.target.value) as SkillLevel))
                  }
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none"
                >
                  <option value="全部">全部难度</option>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level} 星
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  添加技能
                </button>
              </div>

              {/* Add / edit form */}
              {isFormOpen && (
                <form
                  onSubmit={handleSubmitSkill}
                  className="bg-[#FAF7FF] border border-[#DCD0F5] rounded-2xl p-3 space-y-2 animate-fadeIn"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="技能动作名称（必填）"
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                    />
                    <select
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value as SkillCategory })
                      }
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none"
                    >
                      {SKILL_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#574B40] font-semibold">难度</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setForm({ ...form, difficulty: level as SkillLevel })}
                          aria-label={`${level} 星`}
                          className="p-0.5 cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              level <= form.difficulty
                                ? 'fill-[#F59E0B] text-[#F59E0B]'
                                : 'text-[#D9C4B4]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-[#A89888] font-mono">{form.difficulty} 星</span>
                  </div>

                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="动作要点 / 达成标准（可选）"
                    rows={2}
                    className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none resize-none"
                  />

                  {formError && (
                    <p className="text-[11px] text-[#DC2626] font-medium">{formError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(false);
                        setFormError('');
                      }}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      {form.id ? '保存修改' : '添加到技能库'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal list */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
              {filteredSkills.length === 0 ? (
                <p className="text-xs text-[#A89888] py-8 text-center">
                  没有符合条件的技能，试试调整搜索或筛选条件。
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredSkills.map((state) => {
                    const metaStatus = STATUS_META[state.status];
                    return (
                      <div
                        key={state.skill.id}
                        className="flex items-start gap-2 p-2.5 rounded-xl border border-[#EFE3D5] bg-[#FFFDFB]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="text-[11px] font-bold text-[#292524] leading-snug">
                              {state.skill.name}
                            </span>
                            <StarRating value={state.skill.difficulty} size="w-2.5 h-2.5" />
                          </div>
                          <p className="text-[10px] text-[#78695C] mt-0.5 leading-snug">
                            {state.skill.description || '暂无动作说明'}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[9px] bg-[#FAF2EB] border border-[#F0E4D8] text-[#8C7A6B] px-1.5 py-0.5 rounded">
                              {state.skill.category}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${metaStatus.badge}`}>
                              {metaStatus.label}
                            </span>
                            {state.skill.isCustom && (
                              <span className="text-[9px] bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-semibold">
                                自定义
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditForm(state.skill)}
                            aria-label={`编辑 ${state.skill.name}`}
                            className="p-1.5 rounded-lg text-[#8C7A6B] hover:text-[#8B5CF6] hover:bg-violet-50 transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingConfirm({ type: 'delete-skill', skill: state.skill })}
                            aria-label={`删除 ${state.skill.name}`}
                            className="p-1.5 rounded-lg text-[#C4AFA5] hover:text-[#DC2626] hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-3 border-t border-[#F1E5D8] bg-[#FFFDFB] flex items-center justify-between text-[10px] text-[#A89888]">
              <span>
                当前筛选 {filteredSkills.length} 个 · 难度按 1-5 星真实分级
              </span>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(false)}
                className="px-3 py-1.5 bg-[#FAF2EB] hover:bg-[#F3E5D7] text-[#574B40] text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete confirmation */}
      <ConfirmDialog
        open={!!pendingConfirm}
        title={
          pendingConfirm?.type === 'delete-skill'
            ? '确认删除该技能动作？'
            : '确认删除这条打卡记录？'
        }
        description={
          pendingConfirm?.type === 'delete-skill'
            ? '删除后，该技能及其全部打卡记录都会被移除，无法恢复。'
            : '删除后，该日期对应的打卡记录将不再计入进度统计，无法恢复。'
        }
        details={
          pendingConfirm?.type === 'delete-skill'
            ? [
                `技能：${pendingConfirm.skill.name}`,
                `分类：${pendingConfirm.skill.category} · 难度 ${pendingConfirm.skill.difficulty} 星`,
                `关联打卡记录：${
                  checkIns.filter((record) => record.skillId === pendingConfirm.skill.id).length
                } 条`,
              ]
            : pendingConfirm?.type === 'delete-checkin'
            ? [
                `日期：${pendingConfirm.record.date}`,
                `技能：${pendingConfirm.skillName}`,
                `完成情况：${pendingConfirm.record.status === 'mastered' ? '已掌握' : '练习中'}`,
              ]
            : undefined
        }
        confirmLabel={pendingConfirm?.type === 'delete-skill' ? '确认删除技能' : '确认删除记录'}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};
