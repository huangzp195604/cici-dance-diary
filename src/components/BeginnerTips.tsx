import { syncRemoveItem, syncSetItem } from '../utils/sync';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag,
  AlertTriangle,
  Plus,
  Pin,
  PinOff,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

type TipCategory = '百宝箱' | '避坑经验';

interface BeginnerTip {
  id: string;
  title: string;
  content: string;
  category: TipCategory;
  pinned: boolean;
  isCustom: boolean;
  createdAt: number;
}

interface TipToast {
  type: 'success' | 'error';
  message: string;
}

const TIPS_STORAGE_KEY = 'cici_beginner_tips_v1';

/** 默认百宝箱内容，仅在本地首次使用时写入；之后的新增、置顶、删除都会覆盖默认数据 */
const DEFAULT_TIPS: BeginnerTip[] = [
  {
    id: 'tip-knee-pad',
    title: '🦵 防滑加厚护膝',
    content: '跳地面动作 (Floorwork) 的救命神器！避免膝盖淤青，百元以内选透气款即可。',
    category: '百宝箱',
    pinned: false,
    isCustom: false,
    createdAt: 3,
  },
  {
    id: 'tip-phone-stand',
    title: '📱 磁吸/三脚架支架',
    content: '舞室镜子前立手机录像复盘必备，建议配合广角镜头，全身都能录进画面。',
    category: '百宝箱',
    pinned: false,
    isCustom: false,
    createdAt: 2,
  },
  {
    id: 'tip-flat-shoes',
    title: '👟 抓地力好的平底板鞋',
    content: '底不要太软也不要太滑，抓地力和回弹适中最好，方便做重心转换与急停卡点。',
    category: '百宝箱',
    pinned: false,
    isCustom: false,
    createdAt: 1,
  },
];

const loadTips = (): BeginnerTip[] => {
  try {
    const raw = localStorage.getItem(TIPS_STORAGE_KEY);
    if (raw === null) return DEFAULT_TIPS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BeginnerTip[]) : DEFAULT_TIPS;
  } catch {
    return DEFAULT_TIPS;
  }
};

const CATEGORY_META: Record<TipCategory, { badge: string; icon: typeof ShoppingBag }> = {
  百宝箱: { badge: 'bg-[#FFF2EB] text-[#E65B47]', icon: ShoppingBag },
  避坑经验: { badge: 'bg-rose-50 text-rose-700', icon: AlertTriangle },
};

export const BeginnerTips: React.FC = () => {
  const [tips, setTips] = useState<BeginnerTip[]>(loadTips);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<TipCategory>('百宝箱');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<TipToast | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BeginnerTip | null>(null);

  // 任何新增 / 置顶 / 删除都会立即写入本地存储，保证界面与后台数据一致
  useEffect(() => {
    try {
      syncSetItem(TIPS_STORAGE_KEY, JSON.stringify(tips));
    } catch {
      setToast({ type: 'error', message: '保存失败：本地存储空间不足，请清理后重试' });
    }
  }, [tips]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 置顶条目优先展示，其余保持原有顺序
  const sortedTips = useMemo(
    () =>
      tips
        .map((tip, index) => ({ tip, index }))
        .sort(
          (a, b) => Number(b.tip.pinned) - Number(a.tip.pinned) || a.index - b.index
        )
        .map((entry) => entry.tip),
    [tips]
  );

  const pinnedCount = tips.filter((tip) => tip.pinned).length;

  const openForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormCategory('百宝箱');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleAddTip = (e: React.FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    const content = formContent.trim();

    if (!title) {
      setFormError('请填写标题');
      return;
    }
    if (title.length > 30) {
      setFormError('标题不能超过 30 个字');
      return;
    }
    if (!content) {
      setFormError('请填写内容');
      return;
    }
    if (content.length > 200) {
      setFormError('内容不能超过 200 个字');
      return;
    }
    if (tips.some((tip) => tip.title.trim().toLowerCase() === title.toLowerCase())) {
      setFormError('已存在同名条目，请调整标题');
      return;
    }

    const newTip: BeginnerTip = {
      id: `tip-${Date.now()}`,
      title,
      content,
      category: formCategory,
      pinned: false,
      isCustom: true,
      createdAt: Date.now(),
    };
    setTips((prev) => [newTip, ...prev]);
    setIsFormOpen(false);
    setFormError('');
    setToast({ type: 'success', message: '已添加到百宝箱' });
  };

  const handleTogglePin = (tip: BeginnerTip) => {
    setTips((prev) =>
      prev.map((item) => (item.id === tip.id ? { ...item, pinned: !item.pinned } : item))
    );
    setToast({
      type: 'success',
      message: tip.pinned ? '已取消置顶' : '已置顶该条目',
    });
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    const title = pendingDelete.title;
    setTips((prev) => prev.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
    setToast({ type: 'success', message: `已删除「${title}」` });
  };

  return (
    <section className="bg-white border border-[#EFE3D5] rounded-3xl p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#292524] flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#E67E22]" />
            <span>初学舞者百宝箱 & 避坑经验</span>
          </h3>
          <p className="text-[11px] text-[#8C7A6B] mt-1">
            共 {tips.length} 条 · 置顶 {pinnedCount} 条 · 支持添加、置顶与删除
          </p>
        </div>

        <button
          type="button"
          onClick={openForm}
          className="self-start shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-[#E67E22] hover:bg-[#CF6D14] text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>用户新增</span>
        </button>
      </div>

      {/* 新增表单 */}
      {isFormOpen && (
        <form
          onSubmit={handleAddTip}
          className="bg-[#FFF9F3] border border-[#F4DCC2] rounded-2xl p-3 space-y-2 animate-fadeIn"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center p-0.5 bg-white border border-[#E8DACB] rounded-lg">
              {(['百宝箱', '避坑经验'] as TipCategory[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setFormCategory(category)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                    formCategory === category
                      ? 'bg-[#E67E22] text-white'
                      : 'text-[#78695C] hover:text-[#292524]'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              aria-label="关闭新增表单"
              className="p-1 rounded-lg text-[#A89888] hover:text-[#292524] hover:bg-[#FAF2EB] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            maxLength={30}
            placeholder="标题（必填，限 30 字，可带 emoji）"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30"
          />

          <textarea
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="内容（必填，限 200 字）：装备推荐或踩坑经验"
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none resize-none"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-[#A89888] font-mono">
              {formTitle.trim().length}/30 · {formContent.trim().length}/200
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-[#E67E22] hover:bg-[#CF6D14] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                保存条目
              </button>
            </div>
          </div>

          {formError && (
            <p className="text-[11px] text-[#DC2626] font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {formError}
            </p>
          )}
        </form>
      )}

      {/* 列表 */}
      {tips.length === 0 ? (
        <p className="text-xs text-[#A89888] py-4 text-center">
          暂无百宝箱内容，点击「用户新增」记录你的第一条装备或避坑经验。
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-[#574B40]">
          {sortedTips.map((tip) => {
            const meta = CATEGORY_META[tip.category];
            const CategoryIcon = meta.icon;
            return (
              <div
                key={tip.id}
                className={`relative p-3 rounded-2xl border transition-colors ${
                  tip.pinned
                    ? 'bg-[#FFF9EC] border-[#F0C97A] ring-1 ring-[#F0C97A]/40'
                    : 'bg-[#FAF2EB] border-[#F0E4D8]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="font-bold text-[#3D3126] leading-snug">{tip.title}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleTogglePin(tip)}
                      aria-label={tip.pinned ? `取消置顶 ${tip.title}` : `置顶 ${tip.title}`}
                      title={tip.pinned ? '取消置顶' : '置顶'}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        tip.pinned
                          ? 'text-[#B45309] bg-[#FCEBC6]'
                          : 'text-[#C4AFA5] hover:text-[#B45309] hover:bg-[#FCEBC6]'
                      }`}
                    >
                      {tip.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(tip)}
                      aria-label={`删除 ${tip.title}`}
                      title="删除"
                      className="p-1 rounded-md text-[#C4AFA5] hover:text-[#DC2626] hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[#78695C] leading-relaxed">{tip.content}</p>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold inline-flex items-center gap-1 ${meta.badge}`}>
                    <CategoryIcon className="w-2.5 h-2.5" />
                    {tip.category}
                  </span>
                  {tip.pinned && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-amber-100 text-amber-800">
                      置顶
                    </span>
                  )}
                  {tip.isCustom && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-violet-50 text-violet-700">
                      我的
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 操作反馈 */}
      {toast && (
        <div
          role="status"
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-medium animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="确认删除这条内容？"
        description="删除后该条目会从百宝箱和本地数据中永久移除，无法恢复。"
        details={
          pendingDelete
            ? [`标题：${pendingDelete.title}`, `分类：${pendingDelete.category}`]
            : undefined
        }
        confirmLabel="确认删除"
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};
