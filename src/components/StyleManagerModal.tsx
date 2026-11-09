import React, { useEffect, useState } from 'react';
import {
  Check,
  Film,
  Filter,
  Flame,
  Image as ImageIcon,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { DancePost } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import type { DanceStyleItem } from './Timeline';

/**
 * 舞种管理弹窗：新增自定义舞种、按难度/训练方向/BPM 筛选、删除自带或自定义舞种。
 *
 * 状态全部收在这里（当前 tab、筛选条件、新舞种草稿、待删除项、提示），
 * 父组件只保留「舞种列表」这一份数据并负责持久化，
 * 所以改这个弹窗的交互不会碰到时间线的筛选与作品流。
 */
interface StyleManagerModalProps {
  open: boolean;
  danceStyles: DanceStyleItem[];
  /** 每个舞种关联了多少篇作品，由父级按真实匹配规则算好 */
  countFor: (name: string) => number;
  /** 输入框下方的快捷建议标签 */
  suggestedTags: string[];
  /** 难度与媒体类型的实时统计（父级已算好，筛选栏也用同一份） */
  stageCounts: Record<string, number>;
  mediaCounts: { all: number; video: number; image: number };
  /** 每次打开时先落到哪个 tab：从筛选栏进来是 manage，从「+」进来是 add */
  initialTab?: 'manage' | 'add';
  onClose: () => void;
  onAddStyle: (style: DanceStyleItem) => void;
  onDeleteStyle: (style: DanceStyleItem) => void;
}

export const StyleManagerModal: React.FC<StyleManagerModalProps> = ({
  open,
  danceStyles,
  countFor,
  suggestedTags,
  stageCounts,
  mediaCounts,
  initialTab = 'add',
  onClose,
  onAddStyle,
  onDeleteStyle,
}) => {
  const [styleManagerTab, setStyleManagerTab] = useState<'manage' | 'add'>(initialTab);

  // 组件常驻，靠 open 变化把 tab 拉回调用方期望的那一个
  useEffect(() => {
    if (open) setStyleManagerTab(initialTab);
  }, [open, initialTab]);
  const [styleFilterDifficulty, setStyleFilterDifficulty] = useState<string>('全部');
  const [styleFilterFocus, setStyleFilterFocus] = useState<string>('全部');
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleDifficulty, setNewStyleDifficulty] = useState<'入门' | '进阶' | '挑战'>('入门');
  const [newStyleFocus, setNewStyleFocus] = useState<'基础律动' | '舞台编舞' | '动作拆解' | '体能耐力'>('基础律动');
  const [newStyleBpm, setNewStyleBpm] = useState<'慢速 (60-90)' | '中速 (90-115)' | '快节奏 (115+)' | '全速域'>(
    '中速 (90-115)'
  );
  const [newStyleColor, setNewStyleColor] = useState('#E67E22');
  const [styleActionToast, setStyleActionToast] = useState<string | null>(null);
  const [styleToDelete, setStyleToDelete] = useState<DanceStyleItem | null>(null);

  // 新增：先查重，避免出现两个只有大小写不同的同名舞种
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newStyleName.trim();
    if (!trimmed) return;
    if (danceStyles.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setStyleActionToast(`舞种「${trimmed}」已存在，请勿重复添加！`);
      setTimeout(() => setStyleActionToast(null), 3000);
      return;
    }
    onAddStyle({
      id: `style-${Date.now()}`,
      name: trimmed,
      difficulty: newStyleDifficulty,
      trainingFocus: newStyleFocus,
      bpmRange: newStyleBpm,
      themeColor: newStyleColor,
      isDefault: false,
    });
    setNewStyleName('');
    setStyleActionToast(`新舞种「${trimmed}」(${newStyleDifficulty}) 已即时添加成功！`);
    setTimeout(() => setStyleActionToast(null), 3500);
  };

  const confirmDelete = (style: DanceStyleItem) => {
    onDeleteStyle(style);
    setStyleToDelete(null);
    setStyleActionToast(`舞种「${style.name}」已成功删除，筛选栏与实时计数已即刻刷新！`);
    setTimeout(() => setStyleActionToast(null), 3500);
  };

  return (
    <>
      {/* Dance Style Management Modal (Add & Delete Styles with Difficulty Levels & Consolidated Counts) */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="style-manager-title"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#F2DAC2] animate-scaleUp overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#FFF5EC] to-[#FFFBF8] border-b border-[#F2DAC2] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFEBDC] text-[#D35400] flex items-center justify-center shrink-0 border border-[#F5CDA2]">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="style-manager-title" className="text-base sm:text-lg font-bold text-[#3D2C1E]">
                      舞种与难度管理
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEBDC] text-[#D35400] border border-[#F5CDA2]">
                      即时生效 · 无需刷新
                    </span>
                  </div>
                  <p className="text-xs text-[#8C7A6B] mt-0.5">
                    自由添加新舞种或删除已有舞种，配套三级难度分级与多维属性
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onClose()}
                className="text-[#998675] hover:text-[#3D2C1E] p-1.5 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Real-time Aggregation Banner (Consolidated Under "All") */}
            <div className="p-3 sm:p-4 bg-[#FEF9F3] border-b border-[#F5E2CE] grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Difficulty Consolidation */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#F2DEC9] shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[#8C6B46] flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#D35400]" />
                    <span>难度分级汇总 (全部 = 汇总总数)</span>
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFF2E2] text-[#D35400] border border-[#F5CDA2]">
                    全部 {stageCounts.全部} 篇
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] text-center">
                  <div className="p-1 rounded-lg bg-[#FAF4ED] border border-[#F0E2D5]">
                    <span className="text-[#8C7A6B] block text-[10px]">入门 Beginner</span>
                    <strong className="text-[#3D2C1E] font-bold">{stageCounts.入门}</strong>
                  </div>
                  <div className="p-1 rounded-lg bg-[#FAF4ED] border border-[#F0E2D5]">
                    <span className="text-[#8C7A6B] block text-[10px]">进阶 Inter</span>
                    <strong className="text-[#3D2C1E] font-bold">{stageCounts.进阶}</strong>
                  </div>
                  <div className="p-1 rounded-lg bg-[#FAF4ED] border border-[#F0E2D5]">
                    <span className="text-[#8C7A6B] block text-[10px]">挑战 Challenge</span>
                    <strong className="text-[#3D2C1E] font-bold">{stageCounts.挑战}</strong>
                  </div>
                </div>
                <p className="text-[10px] text-[#A68F80] mt-1 text-center">
                  入门 ({stageCounts.入门}) + 进阶 ({stageCounts.进阶}) + 挑战 ({stageCounts.挑战}) = 全部 (
                  {stageCounts.全部})
                </p>
              </div>

              {/* Media Consolidation */}
              <div className="p-2.5 rounded-2xl bg-white border border-[#F2DEC9] shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-[#8C6B46] flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-[#E67E22]" />
                    <span>媒体格式汇总 (全部 = 汇总总数)</span>
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FFF2E2] text-[#D35400] border border-[#F5CDA2]">
                    全部 {mediaCounts.all} 篇
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-center">
                  <div className="p-1 rounded-lg bg-[#FAF4ED] border border-[#F0E2D5] flex items-center justify-center gap-1.5">
                    <Film className="w-3 h-3 text-[#D35400]" />
                    <span className="text-[#8C7A6B]">视频 Videos:</span>
                    <strong className="text-[#3D2C1E] font-bold">{mediaCounts.video}</strong>
                  </div>
                  <div className="p-1 rounded-lg bg-[#FAF4ED] border border-[#F0E2D5] flex items-center justify-center gap-1.5">
                    <ImageIcon className="w-3 h-3 text-[#D35400]" />
                    <span className="text-[#8C7A6B]">照片 Photos:</span>
                    <strong className="text-[#3D2C1E] font-bold">{mediaCounts.image}</strong>
                  </div>
                </div>
                <p className="text-[10px] text-[#A68F80] mt-1 text-center">
                  视频 ({mediaCounts.video}) + 照片 ({mediaCounts.image}) = 全部 ({mediaCounts.all})
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center border-b border-[#F2DAC2] px-4 pt-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setStyleManagerTab('add')}
                className={`flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  styleManagerTab === 'add'
                    ? 'border-[#E67E22] text-[#D35400]'
                    : 'border-transparent text-[#8C7A6B] hover:text-[#3D2C1E]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加新舞种</span>
              </button>
              <button
                type="button"
                onClick={() => setStyleManagerTab('manage')}
                className={`flex items-center gap-1.5 py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  styleManagerTab === 'manage'
                    ? 'border-[#E67E22] text-[#D35400]'
                    : 'border-transparent text-[#8C7A6B] hover:text-[#3D2C1E]'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>舞种库管理与删除</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#FAF0E6] text-[#A66230] font-bold">
                  {danceStyles.length}
                </span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {styleManagerTab === 'add' ? (
                /* Tab 1: Add New Dance Style Form */
                <form onSubmit={handleAdd} className="space-y-4">
                  {/* Style Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#3D2C1E] flex items-center justify-between">
                      <span>
                        舞种名称 <strong className="text-rose-500">*</strong>
                      </span>
                      <span className="text-[10px] text-[#A68F80]">支持中英文与自定义简称</span>
                    </label>
                    <input
                      type="text"
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      placeholder="例如：Waacking, Urban编舞, Girls Hip-Hop, House..."
                      className="w-full px-3.5 py-2.5 text-xs bg-[#FAF5F0] border border-[#E8D4C2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 focus:bg-white text-[#3D2C1E]"
                      required
                    />
                    {/* Quick suggestion tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-[#A68F80]">快速选择:</span>
                      {[
                        'Waacking',
                        'Girls Hip-Hop',
                        'House',
                        'Urban编舞',
                        'Locking',
                        '当代抒情爵士',
                        'K-Pop Cover',
                        'Popping',
                        'Swag',
                      ].map((suggest) => (
                        <button
                          key={suggest}
                          type="button"
                          onClick={() => setNewStyleName(suggest)}
                          className="text-[10px] px-2 py-0.5 rounded-lg bg-[#FAF0E6] hover:bg-[#FFE3C7] text-[#9C5821] border border-[#F2DAC2] transition-colors cursor-pointer"
                        >
                          +{suggest}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty Filter with Three Levels (Beginner, Intermediate, Challenge) */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-[#3D2C1E] flex items-center justify-between">
                      <span>
                        难度等级设置 (Difficulty Filter) <strong className="text-rose-500">*</strong>
                      </span>
                      <span className="text-[10px] text-[#A68F80]">三级难度分级，联动主页难度筛选</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          level: '入门' as const,
                          en: 'Beginner',
                          desc: '零基础友好 · 基础律动与协调',
                          badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        },
                        {
                          level: '进阶' as const,
                          en: 'Intermediate',
                          desc: '卡点控制 · 力量爆发与组合编舞',
                          badge: 'bg-amber-50 text-amber-700 border-amber-200',
                        },
                        {
                          level: '挑战' as const,
                          en: 'Challenge',
                          desc: '高难度动作 · 高跟/即兴Solo',
                          badge: 'bg-rose-50 text-rose-700 border-rose-200',
                        },
                      ].map((item) => (
                        <button
                          key={item.level}
                          type="button"
                          onClick={() => setNewStyleDifficulty(item.level)}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                            newStyleDifficulty === item.level
                              ? 'bg-[#FFF7F0] border-[#E67E22] ring-2 ring-[#E67E22]/20 shadow-xs'
                              : 'bg-white border-[#EFE2D5] hover:border-[#E0CCBA]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#3D2C1E]">{item.level}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${item.badge}`}>
                              {item.en}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#8C7A6B] leading-snug">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Supplementary Filtering Dimensions Beyond the Three Levels */}
                  <div className="p-3 bg-[#FAF5F0] border border-[#EFE2D5] rounded-2xl space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#8C6B46]">
                      <Filter className="w-3.5 h-3.5 text-[#D35400]" />
                      <span>补充过滤维度与属性 (Supplementary Dimensions)</span>
                    </div>

                    {/* Dimension 1: BPM & Speed Range */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#5A4535]">
                        1. 音乐节奏与速度区间 (BPM Range):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['慢速 (60-90)', '中速 (90-115)', '快节奏 (115+)', '全速域'].map((bpm) => (
                          <button
                            key={bpm}
                            type="button"
                            onClick={() => setNewStyleBpm(bpm as any)}
                            className={`text-xs px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                              newStyleBpm === bpm
                                ? 'bg-[#E67E22] text-white border-[#D35400] font-bold shadow-2xs'
                                : 'bg-white text-[#7A6454] border-[#EFE2D5] hover:bg-[#F3E7D9]'
                            }`}
                          >
                            {bpm}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dimension 2: Training Focus */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#5A4535]">
                        2. 训练侧重点 (Training Focus):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {['基础律动', '舞台编舞', '动作拆解', '体能耐力'].map((focus) => (
                          <button
                            key={focus}
                            type="button"
                            onClick={() => setNewStyleFocus(focus as any)}
                            className={`text-xs px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                              newStyleFocus === focus
                                ? 'bg-[#E67E22] text-white border-[#D35400] font-bold shadow-2xs'
                                : 'bg-white text-[#7A6454] border-[#EFE2D5] hover:bg-[#F3E7D9]'
                            }`}
                          >
                            {focus}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dimension 3: Theme Color */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-[#5A4535]">
                        3. 分类标识主题色 (Badge Color):
                      </label>
                      <div className="flex items-center gap-2">
                        {[
                          { color: '#E67E22', label: '暖橙' },
                          { color: '#E056FD', label: '魅粉' },
                          { color: '#F39C12', label: '金黄' },
                          { color: '#27AE60', label: '翠绿' },
                          { color: '#8E44AD', label: '暮紫' },
                          { color: '#2980B9', label: '海蓝' },
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            onClick={() => setNewStyleColor(c.color)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                              newStyleColor === c.color
                                ? 'ring-2 ring-offset-2 ring-[#E67E22] scale-110'
                                : 'opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.color }}
                            title={c.label}
                          >
                            {newStyleColor === c.color && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!newStyleName.trim()}
                      className="w-full py-2.5 px-4 bg-[#E67E22] hover:bg-[#D35400] disabled:bg-stone-300 text-white text-xs font-bold rounded-2xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>确认添加该舞种 (即时生效无需刷新)</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Tab 2: Manage & Delete Existing Styles */
                <div className="space-y-3">
                  {/* Filter inside tab by difficulty */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[#8C7A6B] font-bold text-[11px]">按难度过滤:</span>
                      {['全部', '入门', '进阶', '挑战'].map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setStyleFilterDifficulty(diff)}
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-medium transition-all ${
                            styleFilterDifficulty === diff
                              ? 'bg-[#E67E22] text-white font-bold shadow-2xs'
                              : 'bg-[#FAF5F0] text-[#7A6454] hover:bg-[#F2E5D5]'
                          }`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                    <span className="text-[11px] text-[#A68F80]">共 {danceStyles.length} 种可用舞种</span>
                  </div>

                  {/* Styles Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {danceStyles
                      .filter((s) => styleFilterDifficulty === '全部' || s.difficulty === styleFilterDifficulty)
                      .map((style) => {
                        const count = countFor(style.name);
                        return (
                          <div
                            key={style.id}
                            className="p-3 rounded-2xl bg-white border border-[#EFE2D5] hover:border-[#E8CCA6] shadow-2xs flex items-start justify-between gap-2.5 transition-all"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full mt-1 shrink-0"
                                style={{ backgroundColor: style.themeColor || '#E67E22' }}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs font-bold text-[#3D2C1E] truncate">{style.name}</h4>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold ${
                                      style.difficulty === '入门'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : style.difficulty === '进阶'
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {style.difficulty}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-[#8C7A6B] mt-1">
                                  <span>{style.trainingFocus || '基础律动'}</span>
                                  <span>·</span>
                                  <span>{style.bpmRange || '中速'}</span>
                                  <span>·</span>
                                  <strong className="text-[#D35400] font-bold">{count} 篇作品</strong>
                                </div>
                              </div>
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => setStyleToDelete(style)}
                              className="w-7 h-7 flex items-center justify-center rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
                              title={`删除舞种「${style.name}」`}
                              aria-label={`删除舞种 ${style.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-[#FAF5F0] border-t border-[#F2DAC2] flex items-center justify-between text-xs text-[#8C7A6B]">
              <span>更改立即可见，实时同步作品流与所有筛选统计</span>
              <button
                type="button"
                onClick={() => onClose()}
                className="px-4 py-1.5 bg-white hover:bg-[#F5EADB] text-[#3D2C1E] font-bold rounded-xl border border-[#E0CEBF] transition-colors cursor-pointer"
              >
                完成退出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Style Delete Confirmation Dialog */}
      {styleToDelete && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200 flex flex-col gap-3.5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">确认删除舞种「{styleToDelete.name}」？</h3>
                <p className="text-xs text-stone-500 mt-0.5">该舞种将从筛选栏与舞种库中永久移除</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed">
              <p className="font-bold mb-0.5">💡 安全平滑提示：</p>
              <p>
                当前系统中有 <strong>{countFor(styleToDelete.name)}</strong>{' '}
                篇作品关联了该舞种。删除后，相关作品将自动重归类到「其他」类别，不会丢失任何视频、图片或打卡心得！
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setStyleToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                取消保留
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(styleToDelete)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>确认删除并即时生效</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast for Dance Style Actions */}
      {styleActionToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-stone-700 animate-slideUp backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{styleActionToast}</span>
        </div>
      )}
    </>
  );
};
