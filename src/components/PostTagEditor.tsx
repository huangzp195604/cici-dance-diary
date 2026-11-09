import React, { useEffect, useRef, useState } from 'react';
import { Tag, Plus, X, AlertCircle, Check } from 'lucide-react';
import type { DancePost } from '../types';

interface PostTagEditorProps {
  /** null 表示关闭；传入哪篇作品就编辑哪篇的标签 */
  post: DancePost | null;
  /** 推荐标签：内置舞种 + 自定义舞种 + 现有作品里出现过的标签 */
  suggestions: string[];
  onClose: () => void;
  /** 由父组件负责持久化 + 更新列表；失败时抛错，此处显示错误且不关闭弹窗 */
  onSave: (postId: string, categories: string[]) => Promise<void>;
}

const MAX_TAG_LENGTH = 20;

/** 集中校验：空标签、全空、超长、重复（英文大小写不敏感） */
const validateTags = (tags: string[]): string | null => {
  if (tags.length === 0) return '至少保留 1 个标签，作品才能被正确分类统计';
  const emptyIndex = tags.findIndex((t) => !t.trim());
  if (emptyIndex >= 0) return `第 ${emptyIndex + 1} 个标签不能为空，请填写内容或点 × 移除`;
  const tooLong = tags.find((t) => t.trim().length > MAX_TAG_LENGTH);
  if (tooLong) return `标签「${tooLong.trim()}」超过 ${MAX_TAG_LENGTH} 个字，请精简一下`;
  const seen = new Set<string>();
  for (const t of tags) {
    const key = t.trim().toLocaleLowerCase();
    if (seen.has(key)) return `标签「${t.trim()}」重复了，请修改或移除其中一个`;
    seen.add(key);
  }
  return null;
};

export const PostTagEditor: React.FC<PostTagEditorProps> = ({ post, suggestions, onClose, onSave }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 每次打开（或切到另一篇作品）都从该作品的最新标签重新初始化。
  // 依赖整份 post 而不是 post?.id：父组件换了一篇作品时对象必然变化，
  // 而同一篇作品内父级重复渲染不该冲掉用户正在编辑的标签，所以用 id 兜一层。
  const initializedPostId = useRef<string | null>(null);
  useEffect(() => {
    if (!post || initializedPostId.current === post.id) return;
    initializedPostId.current = post.id;
    setTags([...post.categories]);
    setDraft('');
    setError(null);
    setSaving(false);
  }, [post]);

  if (!post) return null;

  const addTag = (raw: string) => {
    const value = raw.trim();
    if (!value) {
      setError('请先输入标签内容，不能添加空标签');
      return;
    }
    if (tags.some((t) => t.trim().toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setError(`标签「${value}」已存在，请勿重复添加`);
      return;
    }
    setTags((prev) => [...prev, value]);
    setDraft('');
    setError(null);
  };

  const handleSave = async () => {
    if (saving) return;
    const normalized = tags.map((t) => t.trim());
    const invalid = validateTags(normalized);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(post.id, normalized);
      onClose();
    } catch (err) {
      console.error('Failed to update post tags:', err);
      setError('保存失败，请稍后重试或检查存储权限；当前标签未被修改');
    } finally {
      setSaving(false);
    }
  };

  const availableSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.trim().toLocaleLowerCase() === s.toLocaleLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tag-editor-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#F2DAC2] animate-scaleUp overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#FFF5EC] to-[#FFFBF8] border-b border-[#F2DAC2] flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#FFEBDC] text-[#D35400] flex items-center justify-center shrink-0 border border-[#F5CDA2]">
              <Tag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 id="tag-editor-title" className="text-base sm:text-lg font-bold text-[#292524]">
                编辑作品标签
              </h3>
              <p className="text-xs text-[#8C7A6B] mt-0.5 truncate">
                《{post.title}》· 当前 {post.categories.length} 个标签
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="关闭标签编辑"
            title="关闭"
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-[#574B40]">当前标签（可直接修改文字）</h4>
              <span className="text-[11px] text-[#A8988A]">{tags.length} 个</span>
            </div>
            {tags.length === 0 ? (
              <div className="text-xs text-[#A8988A] bg-[#FFFBF7] border border-dashed border-[#F0E4D8] rounded-xl p-4 text-center">
                标签已全部移除，请至少添加 1 个标签
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-[11px] text-[#A8988A] w-5 shrink-0 text-right">{index + 1}</span>
                    <input
                      value={tag}
                      onChange={(e) => {
                        const next = [...tags];
                        next[index] = e.target.value;
                        setTags(next);
                        setError(null);
                      }}
                      aria-label={`第 ${index + 1} 个标签`}
                      className="flex-1 min-w-0 px-3 py-2 text-sm text-[#3D3126] bg-[#FFFDFB] border border-[#EFE3D5] rounded-xl focus:outline-none focus:border-[#E65B47] focus:ring-2 focus:ring-[#E65B47]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setTags((prev) => prev.filter((_, i) => i !== index));
                        setError(null);
                      }}
                      aria-label={`移除标签 ${tag.trim() || index + 1}`}
                      title="移除此标签"
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-[#BCAFA3] hover:text-[#DC2626] hover:bg-[#FEE2E2] border border-transparent hover:border-[#FECACA] transition-all cursor-pointer shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border-t border-[#F1E5D8] pt-4">
            <h4 className="text-xs font-bold text-[#574B40] mb-2">新增标签</h4>
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(draft);
                  }
                }}
                placeholder="输入自定义标签，如「高跟爵士」"
                aria-label="新标签名称"
                className="flex-1 min-w-0 px-3 py-2 text-sm text-[#3D3126] bg-[#FFFDFB] border border-[#EFE3D5] rounded-xl focus:outline-none focus:border-[#E65B47] focus:ring-2 focus:ring-[#E65B47]/15 transition-all"
              />
              <button
                type="button"
                onClick={() => addTag(draft)}
                className="px-3 py-2 text-xs font-semibold text-[#E65B47] bg-[#FFEFEA] hover:bg-[#FFE3DB] rounded-xl border border-[#F6DCBE] flex items-center gap-1 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加</span>
              </button>
            </div>
            {availableSuggestions.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] text-[#8C7A6B] mb-1.5">常用标签（点击快速添加）</p>
                <div className="flex flex-wrap gap-1.5">
                  {availableSuggestions.slice(0, 12).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTag(s)}
                      className="text-[11px] px-2.5 py-1 rounded-full bg-[#FFF4EC] text-[#A85B3C] border border-[#F6DCBE] hover:bg-[#FFEAE0] transition-all cursor-pointer"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#F2DAC2] bg-[#FFFDFB] flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-[#A8988A] hidden sm:block">保存后列表、筛选与分类统计即时更新</p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-[#E65B47] hover:bg-[#D94834] disabled:bg-[#F2B6A9] text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>正在保存...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>保存标签</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
