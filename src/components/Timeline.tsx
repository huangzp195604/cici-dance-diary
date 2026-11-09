import { syncRemoveItem, syncSetItem } from '../utils/sync';
import { compressAvatarFile } from '../utils/imageCompress';
import { VIDEO_BADGE_LOCAL, VIDEO_NOTE_LOCAL } from '../utils/videoNotice';
import { normalizePost } from '../utils/storage';
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Play,
  Film,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Plus,
  Users,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Music,
  Trash2,
  Camera,
  AlertCircle,
  Check,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Flame,
  Award,
  Layers,
  AlertTriangle,
  SlidersHorizontal,
  Settings2,
  Tag,
  Filter,
  Edit3,
  Smile,
  Lock,
  HardDrive,
} from 'lucide-react';
import { DancePost, DanceCategory, DanceStage, DanceBuddy } from '../types';
import { getPracticeStartDate, setPracticeStartDate, usePracticeDays } from '../utils/practice';
import { ConfirmDialog } from './ConfirmDialog';
import { PostTagEditor } from './PostTagEditor';
import { StartDateModal } from './StartDateModal';
import { StyleManagerModal } from './StyleManagerModal';

export interface DanceStyleItem {
  id: string;
  name: string;
  difficulty: '入门' | '进阶' | '挑战';
  trainingFocus: '基础律动' | '舞台编舞' | '动作拆解' | '体能耐力';
  bpmRange: '慢速 (60-90)' | '中速 (90-115)' | '快节奏 (115+)' | '全速域';
  themeColor: string;
  isDefault?: boolean;
}

export const DEFAULT_DANCE_STYLES: DanceStyleItem[] = [
  {
    id: 'style-jazz',
    name: 'Jazz',
    difficulty: '进阶',
    trainingFocus: '舞台编舞',
    bpmRange: '中速 (90-115)',
    themeColor: '#E67E22',
    isDefault: true,
  },
  {
    id: 'style-kpop',
    name: '韩舞',
    difficulty: '挑战',
    trainingFocus: '舞台编舞',
    bpmRange: '快节奏 (115+)',
    themeColor: '#D35400',
    isDefault: true,
  },
  {
    id: 'style-choreo',
    name: '编舞',
    difficulty: '进阶',
    trainingFocus: '动作拆解',
    bpmRange: '中速 (90-115)',
    themeColor: '#C0392B',
    isDefault: true,
  },
  {
    id: 'style-basics',
    name: '基础练习',
    difficulty: '入门',
    trainingFocus: '基础律动',
    bpmRange: '慢速 (60-90)',
    themeColor: '#27AE60',
    isDefault: true,
  },
  {
    id: 'style-other',
    name: '其他',
    difficulty: '入门',
    trainingFocus: '基础律动',
    bpmRange: '全速域',
    themeColor: '#8E44AD',
    isDefault: true,
  },
  {
    id: 'style-jazzfunk',
    name: 'Jazz Funk',
    difficulty: '进阶',
    trainingFocus: '舞台编舞',
    bpmRange: '中速 (90-115)',
    themeColor: '#E67E22',
    isDefault: false,
  },
  {
    id: 'style-heels',
    name: '高跟爵士',
    difficulty: '挑战',
    trainingFocus: '舞台编舞',
    bpmRange: '中速 (90-115)',
    themeColor: '#9B59B6',
    isDefault: false,
  },
  {
    id: 'style-urban',
    name: 'Urban编舞',
    difficulty: '进阶',
    trainingFocus: '动作拆解',
    bpmRange: '中速 (90-115)',
    themeColor: '#E67E22',
    isDefault: false,
  },
  {
    id: 'style-core',
    name: '体能核心',
    difficulty: '入门',
    trainingFocus: '体能耐力',
    bpmRange: '慢速 (60-90)',
    themeColor: '#16A085',
    isDefault: false,
  },
  {
    id: 'style-isolation',
    name: 'Isolation隔离',
    difficulty: '入门',
    trainingFocus: '基础律动',
    bpmRange: '慢速 (60-90)',
    themeColor: '#2980B9',
    isDefault: false,
  },
  {
    id: 'style-beats',
    name: '卡点节拍',
    difficulty: '进阶',
    trainingFocus: '基础律动',
    bpmRange: '快节奏 (115+)',
    themeColor: '#D35400',
    isDefault: false,
  },
  {
    id: 'style-stretch',
    name: '拉伸放松',
    difficulty: '入门',
    trainingFocus: '体能耐力',
    bpmRange: '慢速 (60-90)',
    themeColor: '#27AE60',
    isDefault: false,
  },
  {
    id: 'style-solo',
    name: '即兴Solo',
    difficulty: '挑战',
    trainingFocus: '舞台编舞',
    bpmRange: '全速域',
    themeColor: '#F39C12',
    isDefault: false,
  },
];

export interface PersonalityTag {
  id: string;
  emoji: string;
  text: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
}

export const DEFAULT_PERSONALITY_TAGS: PersonalityTag[] = [
  {
    id: 'tag-1',
    emoji: '💃',
    text: '普通 Jazz 爱好者',
    colorBg: '#FFEFEF',
    colorText: '#9E3524',
    colorBorder: '#FFD9D2',
  },
  {
    id: 'tag-2',
    emoji: '✨',
    text: '8-Count放飞自我',
    colorBg: '#FFF7ED',
    colorText: '#C2410C',
    colorBorder: '#FFEDD5',
  },
  {
    id: 'tag-3',
    emoji: '🎵',
    text: '苦练胸腔隔离中',
    colorBg: '#F0FDF4',
    colorText: '#15803D',
    colorBorder: '#DCFCE7',
  },
  { id: 'tag-4', emoji: '👠', text: '周更练习日常', colorBg: '#FAF5FF', colorText: '#7E22CE', colorBorder: '#F3E8FF' },
];

export const TAG_COLOR_THEMES = [
  { bg: '#FFEFEF', text: '#9E3524', border: '#FFD9D2', label: '玫瑰暖红' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5', label: '活力蜜橙' },
  { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A', label: '金黄灵动' },
  { bg: '#F0FDF4', text: '#15803D', border: '#DCFCE7', label: '清新律动' },
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#DBEAFE', label: '自由海蓝' },
  { bg: '#FAF5FF', text: '#7E22CE', border: '#F3E8FF', label: '魅力暮紫' },
];

export const PRESET_DANCER_TAGS = [
  { emoji: '💃', text: '野生业余舞者' },
  { emoji: '🔥', text: '卡点狂热分子' },
  { emoji: '🧘‍♀️', text: '每天20min核心' },
  { emoji: '👟', text: '舞室常驻打卡生' },
  { emoji: '🎧', text: '单曲死磕30遍' },
  { emoji: '👠', text: '初试高跟爵士' },
  { emoji: '☕', text: '练完一杯冰美式' },
  { emoji: '✨', text: '享受肌肉酸痛' },
  { emoji: '🥳', text: '同手同脚也开心' },
  { emoji: '🎬', text: '原相机直出记录' },
];

interface TimelineProps {
  posts: DancePost[];
  buddies: DanceBuddy[];
  userAvatar?: string | null;
  onUpdateAvatar?: (avatarUrl: string | null) => void;
  onOpenUpload: (mode?: 'media' | 'text') => void;
  onOpenBuddies: () => void;
  onSelectMedia: (post: DancePost) => void;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, commentText: string) => void;
  onDeletePost: (postId: string) => void;
  /** 保存作品标签；失败时抛错，由弹窗展示错误且不关闭 */
  onUpdatePostTags: (postId: string, categories: string[]) => Promise<void>;
  /** 全站统一昵称：由 App 传入，避免时间线把名字写死导致改名后不同步 */
  displayNickname?: string;
  /** 游客态：时间线可用，但数据只在本机 */
  isGuest?: boolean;
  /** 游客点「登录同步」时打开登录框 */
  onLogin?: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  posts: rawPosts,
  buddies,
  userAvatar,
  onUpdateAvatar,
  onOpenUpload,
  onOpenBuddies,
  onSelectMedia,
  onToggleLike,
  onAddComment,
  onDeletePost,
  onUpdatePostTags,
  displayNickname,
  isGuest = false,
  onLogin,
}) => {
  /**
   * 统一兜底：本机旧版本数据、云端 jsonb、别处写进来的记录都可能缺
   * notes / categories 等字段，而下面的分类筛选会直接 `post.notes.toLowerCase()`。
   * 只要有一条缺字段，整个时间线就会白屏 —— 一次洗掉比在每个筛选分支加 `|| ''` 稳妥。
   */
  const posts = useMemo(() => rawPosts.map(normalizePost), [rawPosts]);

  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedStage, setSelectedStage] = useState<string>('全部');
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'video' | 'image'>('all');
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState<string>('');

  // Post deletion states (confirmation prompt, error handling, loading, success toast)
  const [postToDelete, setPostToDelete] = useState<DancePost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [deletePostError, setDeletePostError] = useState<string | null>(null);
  const [deletePostSuccessToast, setDeletePostSuccessToast] = useState<string | null>(null);

  const handleConfirmDeletePost = async () => {
    if (!postToDelete || isDeletingPost) return;
    setIsDeletingPost(true);
    setDeletePostError(null);
    try {
      const deletedId = postToDelete.id;
      const title = postToDelete.title;
      await onDeletePost(deletedId);
      // 清理该作品残留的展开态，避免已删除记录仍留在评论区/笔记展开状态里
      if (activeCommentPostId === deletedId) setActiveCommentPostId(null);
      setExpandedNotes((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      setPostToDelete(null);
      setDeletePostSuccessToast(`作品《${title}》已永久物理删除，列表与分类统计已即时更新！`);
      setTimeout(() => setDeletePostSuccessToast(null), 3500);
    } catch (err) {
      console.error('Failed to permanently delete post:', err);
      setDeletePostError('删除失败，请稍后重试或检查存储权限');
    } finally {
      setIsDeletingPost(false);
    }
  };

  // Post tag editor states
  const [postToEditTags, setPostToEditTags] = useState<DancePost | null>(null);
  const [tagActionToast, setTagActionToast] = useState<string | null>(null);

  /** 交给 App 持久化；成功后统一给结果反馈，失败时抛错由弹窗显示 */
  const handleSavePostTags = async (postId: string, categories: string[]) => {
    await onUpdatePostTags(postId, categories);
    setTagActionToast(`标签已更新为 ${categories.join(' / ')}，列表与分类统计已同步`);
    setTimeout(() => setTagActionToast(null), 3500);
  };

  // Avatar state and error/success feedback
  /** 没有自定义头像时的占位走昵称首字，不再引用不存在的图片（会 404 出破图） */
  const DEFAULT_AVATAR = '';
  const [avatar, setAvatar] = useState<string>(() => {
    return userAvatar || localStorage.getItem('cici_user_avatar') || DEFAULT_AVATAR;
  });
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if prop changes
  React.useEffect(() => {
    if (userAvatar) {
      setAvatar(userAvatar);
    }
  }, [userAvatar]);

  const activeAvatar =
    avatar ||
    userAvatar ||
    (typeof window !== 'undefined' ? localStorage.getItem('cici_user_avatar') : null) ||
    DEFAULT_AVATAR;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Scenario: User canceled selection
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];

    // 2. Scenario: Selecting a non-image file
    if (!file.type || !file.type.startsWith('image/')) {
      setAvatarFeedback({
        type: 'error',
        message: '请选择有效的图片文件格式 (支持 JPG, PNG, WEBP, GIF 等)',
      });
      setTimeout(() => setAvatarFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Check size limit: 8MB
    if (file.size > 8 * 1024 * 1024) {
      setAvatarFeedback({
        type: 'error',
        message: '图片过大，请选择小于 8MB 的图片',
      });
      setTimeout(() => setAvatarFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. 压缩后再落盘：原图 base64 可能高达数 MB，会拖垮云端同步
    try {
      const result = await compressAvatarFile(file);
      setAvatar(result);
      syncSetItem('cici_user_avatar', result);
      onUpdateAvatar?.(result);
      setAvatarFeedback({
        type: 'success',
        message: '头像更换成功！已压缩并同步到云端',
      });
      setTimeout(() => setAvatarFeedback(null), 3000);
    } catch {
      setAvatarFeedback({
        type: 'error',
        message: '图片处理失败，请换一张图片重试',
      });
      setTimeout(() => setAvatarFeedback(null), 4000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Start date state (freely selected and modifiable by user, persistent in localStorage)
  const [startDate, setStartDate] = useState<string | null>(() => getPracticeStartDate());

  // Practice days: 0 until the user sets a start date, then auto-increments every day
  const practiceDays = usePracticeDays();

  // Calendar Date Selection Modal State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  // 设定 / 清除起步日后的浮层提示（弹窗自己关闭，提示留在页面上）
  const [dateChangeToast, setDateChangeToast] = useState<string | null>(null);
  const handleApplyStartDate = (chosenDate: string | null) => {
    setStartDate(chosenDate);
    setPracticeStartDate(chosenDate);
    setDateChangeToast(
      chosenDate
        ? `学舞起步日已设置为 ${chosenDate}，练习天数将从该日期起自动累计！`
        : '学舞起步日已清除，练习天数已归零。'
    );
    setTimeout(() => setDateChangeToast(null), 4000);
    setIsDatePickerOpen(false);
  };

  // Count metrics dynamically from posts in real time
  const totalPosts = posts.length;
  const uniqueStyles = new Set(posts.flatMap((p) => p.categories)).size;

  // Reset filters when a new work is uploaded so the new item is visible immediately
  const prevPostCountRef = useRef(posts.length);
  useEffect(() => {
    if (posts.length > prevPostCountRef.current) {
      setSelectedCategory('全部');
      setSelectedStage('全部');
      setSelectedMediaType('all');
    }
    prevPostCountRef.current = posts.length;
  }, [posts.length]);

  // Real-time dynamic counts per category (auto-updates when a post is added or deleted)
  // Dynamic dance styles library (persisted in localStorage, updates immediately without refresh)
  const [danceStyles, setDanceStyles] = useState<DanceStyleItem[]>(() => {
    try {
      const saved = localStorage.getItem('cici_dance_styles_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved dance styles', e);
    }
    return DEFAULT_DANCE_STYLES;
  });

  /** 标签编辑器的推荐项：内置舞种 + 自定义舞种库 + 现有作品里出现过的标签 */
  const suggestedTags = useMemo(() => {
    const all = [
      'Jazz',
      '韩舞',
      '编舞',
      '基础练习',
      '其他',
      ...danceStyles.map((s) => s.name),
      ...posts.flatMap((p) => p.categories),
    ];
    return Array.from(new Set(all.map((s) => String(s).trim()).filter(Boolean)));
  }, [danceStyles, posts]);

  // Dance Style Manager Modal State
  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  /** 打开舞种弹窗时先落在哪个 tab，由入口按钮决定 */
  const [styleManagerTab, setStyleManagerTab] = useState<'manage' | 'add'>('add');
  // 舞种列表仍由时间线持有（筛选栏、计数、卡片都依赖它），
  // 增删的具体交互搬到了 StyleManagerModal 里，这里只负责落库与联动筛选。
  const handleAddDanceStyle = (style: DanceStyleItem) => {
    const updated = [...danceStyles, style];
    setDanceStyles(updated);
    syncSetItem('cici_dance_styles_v2', JSON.stringify(updated));
  };

  const handleDeleteDanceStyle = (style: DanceStyleItem) => {
    const updated = danceStyles.filter((s) => s.id !== style.id);
    setDanceStyles(updated);
    syncSetItem('cici_dance_styles_v2', JSON.stringify(updated));
    // 正在按被删舞种筛选时退回「全部」，否则列表会空白且看起来像数据没了
    if (selectedCategory === style.name) {
      setSelectedCategory('全部');
    }
  };

  // Personality Tags and Signature Bio (persisted in localStorage)
  const [personalityTags, setPersonalityTags] = useState<PersonalityTag[]>(() => {
    try {
      const saved = localStorage.getItem('cici_personality_tags');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved personality tags', e);
    }
    return DEFAULT_PERSONALITY_TAGS;
  });

  const [personalitySignature, setPersonalitySignature] = useState<string>(() => {
    return localStorage.getItem('cici_personality_signature') || '不追求聚光灯，只想在每一个 8-Count 里放飞自我～';
  });

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagToast, setTagToast] = useState<string | null>(null);

  // New tag draft state
  const [newTagText, setNewTagText] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('💃');
  const [newTagColorIndex, setNewTagColorIndex] = useState(0);

  // Signature draft
  const [tempSignature, setTempSignature] = useState(personalitySignature);

  useEffect(() => {
    if (isTagModalOpen) {
      setTempSignature(personalitySignature);
    }
  }, [isTagModalOpen, personalitySignature]);

  const handleAddPersonalityTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTagText.trim();
    if (!trimmed) return;
    if (personalityTags.some((t) => t.text.toLowerCase() === trimmed.toLowerCase())) {
      setTagToast(`标签「${trimmed}」已存在！`);
      setTimeout(() => setTagToast(null), 3000);
      return;
    }
    const theme = TAG_COLOR_THEMES[newTagColorIndex] || TAG_COLOR_THEMES[0];
    const newTag: PersonalityTag = {
      id: `tag-${Date.now()}`,
      emoji: newTagEmoji || '✨',
      text: trimmed,
      colorBg: theme.bg,
      colorText: theme.text,
      colorBorder: theme.border,
    };
    const updated = [...personalityTags, newTag];
    setPersonalityTags(updated);
    syncSetItem('cici_personality_tags', JSON.stringify(updated));
    setNewTagText('');
    setTagToast(`个性标签「${newTag.emoji} ${trimmed}」添加成功！`);
    setTimeout(() => setTagToast(null), 3000);
  };

  const handleAddPresetTag = (preset: { emoji: string; text: string }) => {
    if (personalityTags.some((t) => t.text === preset.text)) {
      setTagToast(`标签「${preset.text}」已存在！`);
      setTimeout(() => setTagToast(null), 2500);
      return;
    }
    const theme = TAG_COLOR_THEMES[personalityTags.length % TAG_COLOR_THEMES.length];
    const newTag: PersonalityTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      emoji: preset.emoji,
      text: preset.text,
      colorBg: theme.bg,
      colorText: theme.text,
      colorBorder: theme.border,
    };
    const updated = [...personalityTags, newTag];
    setPersonalityTags(updated);
    syncSetItem('cici_personality_tags', JSON.stringify(updated));
    setTagToast(`已添加「${preset.emoji} ${preset.text}」`);
    setTimeout(() => setTagToast(null), 2500);
  };

  const handleDeletePersonalityTag = (tagId: string) => {
    const updated = personalityTags.filter((t) => t.id !== tagId);
    setPersonalityTags(updated);
    syncSetItem('cici_personality_tags', JSON.stringify(updated));
    setTagToast('标签已移除');
    setTimeout(() => setTagToast(null), 2500);
  };

  const handleSaveSignature = () => {
    const trimmed = tempSignature.trim();
    if (!trimmed) return;
    setPersonalitySignature(trimmed);
    syncSetItem('cici_personality_signature', trimmed);
    setTagToast('个性态度签名已保存！');
    setTimeout(() => setTagToast(null), 3000);
  };

  const handleResetDefaultTags = () => {
    setPersonalityTags(DEFAULT_PERSONALITY_TAGS);
    syncSetItem('cici_personality_tags', JSON.stringify(DEFAULT_PERSONALITY_TAGS));
    setPersonalitySignature('不追求聚光灯，只想在每一个 8-Count 里放飞自我～');
    syncSetItem('cici_personality_signature', '不追求聚光灯，只想在每一个 8-Count 里放飞自我～');
    setTempSignature('不追求聚光灯，只想在每一个 8-Count 里放飞自我～');
    setTagToast('已恢复默认个性标签与态度签名');
    setTimeout(() => setTagToast(null), 3000);
  };

  // Real-time dynamic counts per stage (difficulty levels), consolidated under "全部" (All = Beginner + Intermediate + Challenge)
  const stageCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {
      全部: 0,
      入门: 0,
      进阶: 0,
      挑战: 0,
    };
    posts.forEach((p) => {
      if (p.stage === '入门') counts.入门++;
      else if (p.stage === '进阶') counts.进阶++;
      else if (p.stage === '挑战') counts.挑战++;
    });
    // Aggregated under "全部" category
    counts.全部 = counts.入门 + counts.进阶 + counts.挑战;
    return counts;
  }, [posts]);

  // Real-time dynamic counts per media type; 纯文字记录只计入「全部」
  const mediaCounts = useMemo(() => {
    const video = posts.filter((p) => p.mediaType === 'video').length;
    const image = posts.filter((p) => p.mediaType === 'image').length;
    return {
      all: posts.length,
      video,
      image,
    };
  }, [posts]);

  // Main categories (Always preserves 5 buttons with Button 5 as '基础练习' or primary style)
  const mainCategoryNames = useMemo(() => {
    const names = ['全部'];
    const activeNames = danceStyles.map((s) => s.name);
    const priority = ['Jazz', '韩舞', '编舞', '基础练习'];
    priority.forEach((p) => {
      if (activeNames.includes(p)) {
        names.push(p);
      }
    });
    for (const s of danceStyles) {
      if (names.length >= 5) break;
      if (!names.includes(s.name)) {
        names.push(s.name);
      }
    }
    return names;
  }, [danceStyles]);

  // Extended categories rendered in the smooth horizontally scrollable area behind button 5
  const extendedCategories = useMemo(() => {
    return danceStyles.filter((s) => !mainCategoryNames.includes(s.name));
  }, [danceStyles, mainCategoryNames]);

  const stages = ['全部', '入门', '进阶', '挑战'];

  // Helper for counting posts associated with any category/tag in real time
  const getCategoryCount = useCallback(
    (name: string): number => {
      if (name === '全部') return posts.length;
      const tag = name.toLowerCase();
      return posts.filter((post) => {
        const matchesCat = post.categories.some((c) => c.toLowerCase() === tag || c.toLowerCase().includes(tag));
        const matchesTitle = post.title.toLowerCase().includes(tag);
        const matchesNotes = post.notes.toLowerCase().includes(tag);
        const matchesMusic = !!post.musicName && post.musicName.toLowerCase().includes(tag);
        const matchesSub =
          (name === '高跟爵士' &&
            (post.title.includes('高跟') || post.notes.includes('高跟') || post.categories.includes('其他'))) ||
          (name === 'Jazz Funk' &&
            (post.musicName?.includes('Jazz') || post.categories.includes('Jazz') || post.title.includes('Jazz'))) ||
          (name === 'Urban编舞' && post.categories.includes('编舞')) ||
          (name === '体能核心' &&
            (post.notes.includes('力量') || post.notes.includes('核心') || post.title.includes('力量'))) ||
          (name === 'Isolation隔离' &&
            (post.title.includes('隔离') || post.notes.includes('隔离') || post.notes.includes('Roll'))) ||
          (name === '卡点节拍' &&
            (post.title.includes('卡点') || post.notes.includes('卡点') || (post.bpm && post.bpm > 0))) ||
          (name === '拉伸放松' && post.categories.includes('基础练习')) ||
          (name === '即兴Solo' && (post.title.includes('Solo') || post.categories.includes('Jazz')));
        return matchesCat || matchesTitle || matchesNotes || matchesMusic || matchesSub;
      }).length;
    },
    [posts]
  );

  // Real-time dynamic counts per category for all active dance styles
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      全部: posts.length,
    };
    danceStyles.forEach((s) => {
      counts[s.name] = getCategoryCount(s.name);
    });
    return counts;
  }, [posts, danceStyles, getCategoryCount]);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedCategory !== '全部') {
        const isStandard = (['Jazz', '韩舞', '编舞', '基础练习', '其他'] as string[]).includes(selectedCategory);
        if (isStandard) {
          if (!post.categories.includes(selectedCategory as DanceCategory)) {
            return false;
          }
        } else {
          const tag = selectedCategory.toLowerCase();
          const matchesCat = post.categories.some((c) => c.toLowerCase().includes(tag));
          const matchesTitle = post.title.toLowerCase().includes(tag);
          const matchesNotes = post.notes.toLowerCase().includes(tag);
          const matchesMusic = !!post.musicName && post.musicName.toLowerCase().includes(tag);
          const matchesSub =
            (selectedCategory === '高跟爵士' &&
              (post.title.includes('高跟') || post.notes.includes('高跟') || post.categories.includes('其他'))) ||
            (selectedCategory === 'Jazz Funk' &&
              (post.musicName?.includes('Jazz') || post.categories.includes('Jazz') || post.title.includes('Jazz'))) ||
            (selectedCategory === 'Urban编舞' && post.categories.includes('编舞')) ||
            (selectedCategory === '体能核心' &&
              (post.notes.includes('力量') || post.notes.includes('核心') || post.title.includes('力量'))) ||
            (selectedCategory === 'Isolation隔离' &&
              (post.title.includes('隔离') || post.notes.includes('隔离') || post.notes.includes('Roll'))) ||
            (selectedCategory === '卡点节拍' &&
              (post.title.includes('卡点') || post.notes.includes('卡点') || (post.bpm && post.bpm > 0))) ||
            (selectedCategory === '拉伸放松' && post.categories.includes('基础练习')) ||
            (selectedCategory === '即兴Solo' && (post.title.includes('Solo') || post.categories.includes('Jazz')));
          if (!matchesCat && !matchesTitle && !matchesNotes && !matchesMusic && !matchesSub) {
            return false;
          }
        }
      }
      if (selectedStage !== '全部' && post.stage !== selectedStage) {
        return false;
      }
      if (selectedMediaType !== 'all' && post.mediaType !== selectedMediaType) {
        return false;
      }
      return true;
    });
  }, [posts, selectedCategory, selectedStage, selectedMediaType]);

  // Extended horizontal scroll state and handlers for area behind button 5
  const extendedScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const hasMovedRef = useRef(false);

  const checkScrollState = () => {
    const el = extendedScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScrollState();
    const el = extendedScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);
    return () => {
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, []);

  const handleScrollBy = (offset: number) => {
    if (extendedScrollRef.current) {
      extendedScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!extendedScrollRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - extendedScrollRef.current.offsetLeft;
    scrollStartRef.current = extendedScrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !extendedScrollRef.current) return;
    const x = e.pageX - extendedScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    extendedScrollRef.current.scrollLeft = scrollStartRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!extendedScrollRef.current) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      extendedScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const followedCount = buddies.filter((b) => b.isFollowed).length;

  const toggleNote = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleInlineComment = (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(postId, commentInput.trim());
    setCommentInput('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Feedback banner if avatar upload succeeds or encounters error */}
      {avatarFeedback && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-2xs animate-fadeIn ${
            avatarFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {avatarFeedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{avatarFeedback.message}</span>
        </div>
      )}

      {/* 1. 个人形象卡（跟随账号昵称） */}
      <section className="bg-[#FFEFEF] border border-[#FFDCD8] rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all">
        <div className="flex items-center gap-4">
          <div
            onClick={handleAvatarClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAvatarClick();
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="点击更换个人头像 (支持拍照或从相册选择)"
            title="点击更换个人头像 (支持拍照或从相册选择)"
            className="relative group cursor-pointer w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#FFD7CE] text-[#E0523D] border-2 border-[#FFC2B5] hover:border-[#FF7E67] flex items-center justify-center font-display font-black text-2xl shadow-inner shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-md ring-2 ring-transparent hover:ring-[#FF7E67]/40 overflow-hidden"
          >
            {activeAvatar ? (
              <img
                src={activeAvatar}
                alt="我的头像"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  // 头像失效就退回首字占位，避免出现破图
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span aria-hidden="true" className="font-display font-black text-2xl select-none">
                {Array.from(displayNickname || '舞')[0]}
              </span>
            )}

            {/* Hover Camera Overlay */}
            <div className="absolute inset-0 bg-black/45 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity backdrop-blur-2xs">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="text-[9px] font-semibold mt-0.5 hidden sm:inline">换头像</span>
            </div>

            {/* Corner Camera Badge */}
            <div className="absolute bottom-0 right-0 w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-white text-[#FF6B6B] shadow-md border border-[#FFDCD8] flex items-center justify-center transition-transform group-hover:scale-110">
              <Camera className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF6B6B]" />
            </div>

            {/* Hidden device file/media picker input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#292524] tracking-tight break-words line-clamp-2 max-w-full">
                嗨，我是 {displayNickname || '舞者'}
              </h2>
              <span className="shrink-0 whitespace-nowrap text-xs bg-[#FFD9D2] text-[#9E3524] px-2 py-0.5 rounded-full font-medium">
                舞蹈爱好者 · 学习中
              </span>
              {/* 私密定位：时间线只有本人可见；游客额外说明「还没上云」 */}
              <span
                className="shrink-0 whitespace-nowrap text-[11px] bg-white/85 text-[#7A584C] border border-[#F3D9D3] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                title={isGuest ? '记录只保存在这台设备，登录后自动同步' : '仅你自己可见，已开启云端同步'}
              >
                <Lock className="w-2.5 h-2.5 text-[#B87A6A]" />
                仅自己可见
                {isGuest && (
                  <button
                    type="button"
                    onClick={() => onLogin?.()}
                    className="text-[#B4452F] font-bold hover:underline cursor-pointer"
                  >
                    · 存本机
                  </button>
                )}
              </span>
            </div>
            {/* Clean unboxed metadata with dot separators */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[#735D52] mt-1 font-medium">
              <span
                onClick={() => setIsDatePickerOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsDatePickerOpen(true);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`练舞 ${practiceDays} 天，点击自由选择或修改学舞起步日历`}
                title="点击自由设置或修改学舞起步日，查看练舞打卡日历"
                className="cursor-pointer inline-flex items-center gap-1 hover:text-[#D94834] transition-all group/date select-none"
              >
                练习{' '}
                <strong className="text-[#D94834] font-bold px-1.5 py-0.5 rounded-lg bg-[#FFE6DF] border border-[#FFD3C9] group-hover/date:bg-[#FFD2C8] group-hover/date:border-[#FFB8A8] group-hover/date:scale-105 shadow-2xs transition-all inline-flex items-center gap-1">
                  {practiceDays}
                  <Calendar className="w-3 h-3 text-[#FF7E67] group-hover/date:rotate-12 transition-transform" />
                </strong>{' '}
                天
              </span>
              <span aria-hidden="true" className="text-[#C4AFA5]">
                ·
              </span>
              <span>
                作品 <strong className="text-[#D94834] font-semibold">{totalPosts}</strong> 个
              </span>
              <span aria-hidden="true" className="text-[#C4AFA5]">
                ·
              </span>
              <span>
                舞种 <strong className="text-[#D94834] font-semibold">{uniqueStyles}</strong> 种
              </span>
            </div>
          </div>
        </div>

        {/* Personality Tags & Bio Signature Card */}
        <div
          onClick={() => setIsTagModalOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsTagModalOpen(true);
            }
          }}
          className="group/tags bg-white/90 hover:bg-white backdrop-blur-xs border border-[#F8D2CC] hover:border-[#FF9B8A] p-3 sm:p-3.5 rounded-2xl text-xs text-[#7A584C] shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col gap-2 max-w-full sm:max-w-md self-start sm:self-auto select-none"
          title="点击自定义修改个性标签与个性态度签名"
          aria-label="自定义修改个性标签与个性签名"
        >
          {/* Top Row: Attitude Quote & Edit Badge */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium truncate text-[#5A4535]">
              <Sparkles className="w-3.5 h-3.5 text-[#FF7E67] shrink-0 animate-spin-slow" />
              <span className="truncate italic font-medium">&quot;{personalitySignature}&quot;</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEAE3] text-[#D35400] border border-[#FFD3C7] group-hover/tags:bg-[#FF7E67] group-hover/tags:text-white transition-all shrink-0">
              <Edit3 className="w-2.5 h-2.5" />
              <span>修改标签</span>
            </span>
          </div>

          {/* Bottom Row: Active Personality Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {personalityTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-transform duration-150 group-hover/tags:scale-[1.02]"
                style={{
                  backgroundColor: tag.colorBg,
                  color: tag.colorText,
                  borderColor: tag.colorBorder,
                }}
              >
                <span>{tag.emoji}</span>
                <span>{tag.text}</span>
              </span>
            ))}
            <span className="text-[10px] text-[#C4AFA5] group-hover/tags:text-[#D35400] font-semibold flex items-center gap-0.5 ml-0.5">
              <Plus className="w-3 h-3" />
              <span>自定义</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. 筛选 Chips Bar - as sketched in wireframe image_70723755.png */}
      {posts.length > 0 && (
        <section className="bg-[#FEF6E8] border border-[#FCE6BE] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none min-w-0 max-w-full">
            <span className="text-xs font-bold text-[#8C6B46] shrink-0 mr-1">舞种筛选:</span>
            {mainCategoryNames.map((cat) => {
              const count = getCategoryCount(cat);
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-[#E67E22] text-white shadow-sm ring-2 ring-[#E67E22]/20 font-bold'
                      : 'bg-white/85 text-[#7D5B36] hover:bg-white hover:text-[#4A321A] border border-[#F2DAC2]'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums transition-colors ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-[#F9EDE0] text-[#B05B1E]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {/* Horizontally scrollable area behind button 5: allows users to browse hidden & obscured categories with smooth scrolling, clipping, desktop arrows, drag, wheel, and mobile touch */}
            <div className="relative flex items-center min-w-0 shrink group/hscroll pl-0.5">
              {/* Subtle separator */}
              <div className="h-4 w-px bg-[#E8D4BE] shrink-0 mr-1.5" />

              {/* Left fade gradient & scroll trigger */}
              <div
                className={`absolute left-2 top-0 bottom-0 w-7 bg-gradient-to-r from-[#FEF6E8] via-[#FEF6E8]/90 to-transparent pointer-events-none z-10 transition-opacity duration-200 flex items-center justify-start ${
                  canScrollLeft ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {canScrollLeft && (
                  <button
                    type="button"
                    onClick={() => handleScrollBy(-130)}
                    className="w-5 h-5 rounded-full bg-white text-[#7D5B36] hover:text-[#E67E22] hover:bg-[#FFF7F0] shadow-xs border border-[#F2DAC2] pointer-events-auto flex items-center justify-center transition-all cursor-pointer -ml-0.5 active:scale-95"
                    title="向左平滑滑动"
                    aria-label="向左平滑滑动浏览"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* The scroll container that properly clips content */}
              <div
                ref={extendedScrollRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
                className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden py-1 px-1.5 scroll-smooth scrollbar-none rounded-2xl bg-white/45 border border-[#F5DFCA]/80 cursor-grab active:cursor-grabbing select-none max-w-[240px] sm:max-w-[320px] md:max-w-[380px] lg:max-w-[460px]"
                style={{ WebkitOverflowScrolling: 'touch' }}
                role="region"
                aria-label="拓展舞蹈标签横向滚动区"
              >
                <span className="text-[10px] text-[#A6835B] font-bold shrink-0 pl-1 pr-0.5 whitespace-nowrap">
                  更多:
                </span>

                {extendedCategories.map((item) => {
                  const isSelected = selectedCategory === item.name;
                  const count = getCategoryCount(item.name);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (!hasMovedRef.current) {
                          setSelectedCategory(item.name);
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0 ${
                        isSelected
                          ? 'bg-[#E67E22] text-white shadow-xs ring-2 ring-[#E67E22]/20 font-bold'
                          : 'bg-white text-[#7D5B36] hover:bg-[#FFF9F3] hover:text-[#4A321A] border border-[#F2DAC2]'
                      }`}
                      title={`筛选 ${item.name} (${item.difficulty}难度 · ${count}篇作品)`}
                    >
                      <span>{item.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-[#F9EDE0] text-[#B05B1E]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                {/* Inline quick add button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsStyleManagerOpen(true);
                    setStyleManagerTab('add');
                  }}
                  className="px-2 py-1 text-[11px] font-bold rounded-full bg-[#FFF5EC] hover:bg-[#FFEBDC] text-[#C05621] border border-dashed border-[#F4BA8C] transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 shrink-0"
                  title="添加新舞种"
                >
                  <Plus className="w-3 h-3" />
                  <span>加舞种</span>
                </button>
              </div>

              {/* Right fade gradient & scroll trigger */}
              <div
                className={`absolute right-0 top-0 bottom-0 w-7 bg-gradient-to-l from-[#FEF6E8] via-[#FEF6E8]/90 to-transparent pointer-events-none z-10 transition-opacity duration-200 flex items-center justify-end ${
                  canScrollRight ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {canScrollRight && (
                  <button
                    type="button"
                    onClick={() => handleScrollBy(130)}
                    className="w-5 h-5 rounded-full bg-white text-[#7D5B36] hover:text-[#E67E22] hover:bg-[#FFF7F0] shadow-xs border border-[#F2DAC2] pointer-events-auto flex items-center justify-center transition-all cursor-pointer -mr-0.5 active:scale-95"
                    title="向右平滑滑动浏览"
                    aria-label="向右平滑滑动浏览"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Stage & Media toggles + Custom Dance Style Manager Button */}
          <div className="flex items-center gap-2 text-xs self-end md:self-auto flex-wrap sm:flex-nowrap">
            {/* Difficulty Filter with Real-time Count Consolidated under "全部" (All = Beginner + Intermediate + Challenge) */}
            <div className="flex items-center gap-1 bg-white/70 p-1 rounded-xl border border-[#F5DCB0]">
              <span className="text-[10px] text-[#A6835B] font-bold px-1 hidden sm:inline">难度:</span>
              {stages.map((stg) => {
                const count = stageCounts[stg] || 0;
                return (
                  <button
                    key={stg}
                    onClick={() => setSelectedStage(stg)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                      selectedStage === stg
                        ? 'bg-[#FFF7F0] text-[#D35400] font-bold shadow-2xs'
                        : 'text-[#8C6B46] hover:text-[#3E2A16]'
                    }`}
                    title={
                      stg === '全部'
                        ? `全部难度（入门 ${stageCounts.入门} + 进阶 ${stageCounts.进阶} + 挑战 ${stageCounts.挑战} = ${count} 篇汇总）`
                        : `${stg}难度 (${count} 篇)`
                    }
                  >
                    <span>{stg}</span>
                    <span className="text-[9px] opacity-75 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Media Filter with Real-time Count Consolidated under "全部" (All = Video + Photo) */}
            <div className="flex items-center gap-1 bg-white/70 p-1 rounded-xl border border-[#F5DCB0]">
              <button
                onClick={() => setSelectedMediaType('all')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1 ${
                  selectedMediaType === 'all' ? 'bg-[#FFF7F0] text-[#D35400] font-bold' : 'text-[#8C6B46]'
                }`}
                title={`全部媒体类型汇总（视频 ${mediaCounts.video} + 照片 ${mediaCounts.image} = ${mediaCounts.all}）`}
              >
                <span>全部</span>
                <span className="text-[9px] opacity-75 tabular-nums">({mediaCounts.all})</span>
              </button>
              <button
                onClick={() => setSelectedMediaType('video')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1 ${
                  selectedMediaType === 'video' ? 'bg-[#FFF7F0] text-[#D35400] font-bold' : 'text-[#8C6B46]'
                }`}
                title="仅看视频"
              >
                <Film className="w-3 h-3" />
                <span>视频</span>
                <span className="text-[9px] opacity-75 tabular-nums">({mediaCounts.video})</span>
              </button>
              <button
                onClick={() => setSelectedMediaType('image')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium flex items-center gap-1 ${
                  selectedMediaType === 'image' ? 'bg-[#FFF7F0] text-[#D35400] font-bold' : 'text-[#8C6B46]'
                }`}
                title="仅看照片"
              >
                <ImageIcon className="w-3 h-3" />
                <span>照片</span>
                <span className="text-[9px] opacity-75 tabular-nums">({mediaCounts.image})</span>
              </button>
            </div>

            {/* Custom Dance Styles Button (Add / Delete Dance Styles) */}
            <button
              type="button"
              onClick={() => {
                setIsStyleManagerOpen(true);
                setStyleManagerTab('manage');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF2E2] hover:bg-[#FFE6CD] text-[#C05621] hover:text-[#9C4215] text-xs font-bold rounded-xl border border-[#F5CDA2] shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0"
              title="自定义舞种：添加新舞种或删除已有舞种，含三级难度分级与多维属性"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#D35400]" />
              <span>自定义舞种</span>
              <span className="text-[10px] bg-[#E67E22] text-white px-1.5 py-0.2 rounded-full font-bold tabular-nums">
                {danceStyles.length}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* 3. 时间线作品流 (Cards Stream) */}
      <section className="space-y-4">
        {/* Dynamic Project Showcase Section Header with Live Category Counts */}
        {posts.length > 0 && (
          <div className="bg-white border border-[#EFE3D5] rounded-2xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FFF0EB] text-[#E65B47] flex items-center justify-center shrink-0 border border-[#FFDCD3]">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#292524]">舞蹈作品展示区</h3>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFEFE8] text-[#D94834] border border-[#FFDCD3]">
                    {selectedCategory === '全部' ? '全部舞种作品' : `${selectedCategory}分类`} · 实时统计:{' '}
                    {filteredPosts.length} 篇
                  </span>
                </div>
                <p className="text-[11px] text-[#8C7A6B]">
                  实时追踪各分类作品数，新增或删除作品时界面数据毫秒级自动联动更新
                </p>
              </div>
            </div>

            {/* Quick interactive category pill counters */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {(['Jazz', '韩舞', '编舞', '基础练习', '其他'] as DanceCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCategory(c)}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                    selectedCategory === c
                      ? 'bg-[#E67E22] text-white border-[#D35400] font-bold shadow-2xs'
                      : 'bg-[#FAF3EB] text-[#7A6454] border-[#EFE2D5] hover:bg-[#F3E7D9]'
                  }`}
                  title={`查看 ${c} 分类作品 (${categoryCounts[c] || 0} 篇)`}
                >
                  <span>{c}</span>
                  <strong
                    className={`font-mono text-[10px] tabular-nums font-bold px-1 rounded ${
                      selectedCategory === c ? 'bg-white/20 text-white' : 'bg-white text-[#D94834]'
                    }`}
                  >
                    {categoryCounts[c] || 0}
                  </strong>
                </button>
              ))}
            </div>
          </div>
        )}
        {filteredPosts.length === 0 ? (
          <div className="bg-white border border-[#EFE4D8] rounded-3xl p-6 sm:p-10 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFF1E8] text-[#FF7E67] flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            {posts.length === 0 ? (
              <>
                <h3 className="text-lg sm:text-xl font-display font-bold text-[#292524] tracking-tight">
                  从今天开始，记下你的第一支舞
                </h3>
                <p className="text-xs sm:text-sm text-[#8C7A6B] mt-2 leading-relaxed">
                  不用先拍好视频，写一句话也算一次练习。
                </p>

                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-5 text-left">
                  {[
                    { n: '01', t: '选日期舞种', d: '默认今天，可随时改' },
                    { n: '02', t: '写一句复盘', d: '想到什么写什么' },
                    { n: '03', t: '生成成长曲线', d: '之后逐次累加' },
                  ].map((step) => (
                    <div
                      key={step.n}
                      className="bg-[#FFFBF7] border border-[#F3E7DA] rounded-2xl px-2 py-2 sm:px-3 sm:py-2.5"
                    >
                      <span className="font-mono text-[10px] font-bold text-[#C9B7A8]">{step.n}</span>
                      <p className="text-[11px] sm:text-xs font-semibold text-[#574B40] mt-0.5 leading-tight">
                        {step.t}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-[#A8988A] mt-1 leading-snug">{step.d}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-row gap-2 justify-center">
                  <button
                    onClick={() => onOpenUpload('text')}
                    className="flex-1 sm:flex-none min-h-[44px] px-3 sm:px-5 py-2.5 text-[11px] sm:text-sm font-bold text-white bg-[#FF7E67] rounded-full hover:bg-[#E65B47] transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-4 h-4 shrink-0" />
                    <span>先写一句话</span>
                  </button>
                  <button
                    onClick={() => onOpenUpload('media')}
                    className="flex-1 sm:flex-none min-h-[44px] px-3 sm:px-5 py-2.5 text-[11px] sm:text-sm font-bold text-[#C4432E] bg-[#FFEFE8] border border-[#F8D9C9] rounded-full hover:bg-[#FFE3D6] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Film className="w-4 h-4 shrink-0" />
                    <span>传视频或照片</span>
                  </button>
                </div>

                <p className="text-[11px] text-[#B3A296] mt-2.5">第一条就是成长曲线的起点，视频之后可补传。</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[#5C4D42]">暂无符合筛选条件的舞蹈记录</p>
                <p className="text-xs text-[#9B897D] mt-1">换个分类看看，或者去上传一条新记录吧！</p>
                <button
                  onClick={() => {
                    setSelectedCategory('全部');
                    setSelectedStage('全部');
                    setSelectedMediaType('all');
                  }}
                  className="mt-4 px-4 py-1.5 text-xs font-semibold text-[#FF7E67] bg-[#FFEFEA] rounded-full hover:bg-[#FFE3DB] transition-all"
                >
                  重置筛选条件
                </button>
              </>
            )}
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isVideo = post.mediaType === 'video';
            const isText = post.mediaType === 'text';
            const openMedia = () => {
              if (!isText) onSelectMedia(post);
            };
            const isNoteOpen = expandedNotes[post.id];
            const isCommentBoxOpen = activeCommentPostId === post.id;

            return (
              <article
                key={post.id}
                className="bg-white border border-[#EFE3D5] rounded-3xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
                  {/* Media Thumbnail / Preview Area（纯文字记录不占媒体位） */}
                  {!isText && (
                    <div
                      onClick={() => onSelectMedia(post)}
                      className={`relative w-full sm:w-56 md:w-64 h-44 sm:h-38 rounded-2xl overflow-hidden cursor-pointer shrink-0 transition-transform group-hover:scale-[1.01] ${
                        isVideo ? 'bg-[#FFE2D6]' : 'bg-[#EDE7FA]'
                      } flex items-center justify-center border border-[#F0E4D7]`}
                    >
                      {/* Media Display */}
                      {isVideo ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#FFE3D6] to-[#FED2C1]">
                          {/* Realistic video poster fallback */}
                          {post.thumbnailUrl ? (
                            <img
                              src={post.thumbnailUrl}
                              alt={post.title}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                // 旧数据可能存了失效的 blob: 地址，隐藏即可露出渐变兜底
                                e.currentTarget.style.display = 'none';
                              }}
                              className="w-full h-full object-cover opacity-85"
                            />
                          ) : null}

                          {/* Floating Play Button */}
                          <div className="absolute inset-0 bg-black/25 flex flex-col items-center justify-center gap-1.5 group-hover:bg-black/35 transition-all">
                            <div className="w-11 h-11 rounded-full bg-white/95 text-[#FF6B6B] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 fill-current ml-0.5" />
                            </div>
                            <span className="text-[11px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-xs">
                              点击播放 · 支持慢速扒舞
                            </span>
                          </div>

                          {/* Video Badge */}
                          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Film className="w-3 h-3" />
                            <span>视频</span>
                            {post.duration && <span>{post.duration}</span>}
                          </div>

                          {/* 仅存本机：卡片上先给一个轻标记，点开播放器还有一行完整说明。
                            hover 显示全文，避免在列表里堆字 */}
                          <div
                            className="absolute top-2.5 right-2.5 bg-black/55 backdrop-blur-xs text-white/90 text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-help"
                            title={VIDEO_NOTE_LOCAL}
                          >
                            <HardDrive className="w-2.5 h-2.5" />
                            <span>{VIDEO_BADGE_LOCAL}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-[#EDE7FA] to-[#E3D9F8]">
                          {post.mediaUrl ? (
                            <img
                              src={post.mediaUrl}
                              alt={post.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                          <div className="absolute inset-0 bg-black/15 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs font-semibold text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                              点击放大查看
                            </span>
                          </div>
                          <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            <span>图片</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content & Metadata Area */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      {/* Top Unboxed Metadata - Strict Zero-Pill format */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C7A6B] mb-1.5">
                        <span className="font-mono text-[#574B40] font-medium">{post.date}</span>
                        <span aria-hidden="true" className="text-[#CDBEB3]">
                          ·
                        </span>
                        <span
                          className={`font-semibold ${
                            post.stage === '入门'
                              ? 'text-[#10B981]'
                              : post.stage === '进阶'
                                ? 'text-[#3B82F6]'
                                : 'text-[#EF4444]'
                          }`}
                        >
                          {post.stage}
                        </span>
                        <span aria-hidden="true" className="text-[#CDBEB3]">
                          ·
                        </span>
                        <span className="text-[#78695C]">{post.categories.join(' / ')}</span>
                        {isText && (
                          <>
                            <span aria-hidden="true" className="text-[#CDBEB3]">
                              ·
                            </span>
                            <span className="font-semibold text-[#FF7E67]">文字记录</span>
                          </>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        onClick={openMedia}
                        className={`text-base sm:text-lg font-display font-bold text-[#292524] tracking-tight transition-colors leading-snug ${
                          isText ? '' : 'hover:text-[#E65B47] cursor-pointer'
                        }`}
                      >
                        {post.title}
                      </h3>

                      {/* Music tag if provided */}
                      {post.musicName && (
                        <div className="flex items-center gap-1.5 text-xs text-[#8C7A6B] mt-1.5">
                          <Music className="w-3 h-3 text-[#FF7E67]" />
                          <span className="truncate max-w-xs">{post.musicName}</span>
                          {post.bpm && (
                            <span className="font-mono text-[11px] text-[#A6978B] font-medium">({post.bpm} BPM)</span>
                          )}
                        </div>
                      )}

                      {/* Practice Notes snippet */}
                      {post.notes && (
                        <div className="mt-2 text-xs text-[#6B5A4D] bg-[#FFFBF7] border border-[#F5E8DC] p-2.5 rounded-xl">
                          <p className={`leading-relaxed ${isNoteOpen ? '' : 'line-clamp-2'}`}>{post.notes}</p>
                          {post.notes.length > 70 && (
                            <button
                              onClick={() => toggleNote(post.id)}
                              className="text-[11px] text-[#E65B47] font-semibold mt-1 flex items-center gap-0.5 hover:underline"
                            >
                              {isNoteOpen ? (
                                <>
                                  <span>收起小记</span>
                                  <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  <span>展开更多心得</span>
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#F5ECE1]">
                      <div className="flex items-center gap-3">
                        {/* Like Button */}
                        <button
                          onClick={() => onToggleLike(post.id)}
                          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                            post.isLiked
                              ? 'bg-[#FFE8E8] text-[#E02424]'
                              : 'bg-[#F7EFE7] text-[#736357] hover:bg-[#EFE3D5]'
                          }`}
                          title="点赞打气"
                        >
                          <Heart className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-current text-[#E02424]' : ''}`} />
                          <span>{post.likes}</span>
                        </button>

                        {/* Comments Toggle */}
                        <button
                          onClick={() => setActiveCommentPostId(isCommentBoxOpen ? null : post.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#736357] hover:text-[#292524] px-2 py-1 rounded-lg hover:bg-[#F7EFE7] transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-[#8C7A6B]" />
                          <span>{post.comments.length} 条评论</span>
                        </button>
                      </div>

                      {/* 作品管理入口：标签编辑 + 删除，在每个作品卡片上常驻可见 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPostToEditTags(post)}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-[#F7EFE7] text-[#736357] hover:text-[#292524] hover:bg-[#EFE3D5] transition-all duration-200 cursor-pointer"
                          title="查看并编辑这条作品的标签"
                          aria-label={`编辑作品《${post.title}》的标签`}
                        >
                          <Tag className="w-3.5 h-3.5 text-[#D35400] shrink-0" />
                          <span className="sm:hidden">标签</span>
                          <span className="hidden sm:inline">编辑标签</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPostToDelete(post);
                            setDeletePostError(null);
                          }}
                          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-[#F7EFE7] text-[#736357] hover:text-[#DC2626] hover:bg-[#FEE2E2] border border-transparent hover:border-[#FECACA] transition-all duration-200 cursor-pointer"
                          title="永久删除此篇作品（需二次确认，不可恢复）"
                          aria-label={`删除舞蹈作品《${post.title}》`}
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span>删除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline Comment Thread (if opened) */}
                {isCommentBoxOpen && (
                  <div className="mt-4 pt-3 border-t border-[#F1E5D8] bg-[#FFFBF8] rounded-2xl p-3">
                    <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                      {post.comments.length === 0 ? (
                        <p className="text-xs text-[#A8988A] text-center py-2">还没有评论，留一句暖心鼓励吧～</p>
                      ) : (
                        post.comments.map((c) => (
                          <div key={c.id} className="text-xs bg-white p-2 rounded-xl border border-[#F0E4D8]">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-semibold text-[#3D3126]">
                                {c.author}{' '}
                                {c.isOwner && <span className="text-[10px] text-[#FF6B6B] font-normal">(作者)</span>}
                              </span>
                              <span className="text-[10px] text-[#A8988A]">{c.createdAt}</span>
                            </div>
                            <p className="text-[#574B40]">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={(e) => handleInlineComment(post.id, e)} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="留一句鼓励或练舞心得..."
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-[#E8DACB] bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/50"
                      />
                      <button
                        type="submit"
                        disabled={!commentInput.trim()}
                        className="px-3 py-1.5 bg-[#FF7E67] hover:bg-[#E65B47] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
                      >
                        <Send className="w-3 h-3" />
                        <span>发送</span>
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* 4. "+ 去上传今天的作品" 快捷入口按钮 - wireframe requirement */}
      <section>
        <button
          onClick={() => onOpenUpload()}
          className="w-full py-3.5 px-4 bg-[#FFE5EC] hover:bg-[#FFD9E3] text-[#D83A6F] border border-[#FFCCD9] rounded-2xl font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-2xs hover:shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ 去上传今天的作品 (记录每一个微小的进步)</span>
        </button>
      </section>

      {/* 5. "找舞搭子 · 你关注的 X 位伙伴本周都在练 Jazz" 横幅 - wireframe requirement */}
      <section
        onClick={onOpenBuddies}
        className="bg-[#EFE9FE] hover:bg-[#E7DEFD] border border-[#DDD0FA] rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-2xs group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDD0FA] text-[#7C3AED] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#4C1D95]">
              找舞搭子 · 你关注的 {followedCount} 位伙伴本周都在练 Jazz
            </h4>
            <p className="text-xs text-[#6D28D9] mt-0.5">点击进入轻社区：看看同好们在练什么、留言墙约舞室打气</p>
          </div>
        </div>

        <span className="text-xs font-semibold text-[#6D28D9] bg-white/70 px-3 py-1.5 rounded-full border border-[#DDD0FA] group-hover:bg-white transition-colors shrink-0">
          去看看 →
        </span>
      </section>

      {/* 学舞起步日：日历、预设、清除确认都在 StartDateModal 内 */}
      <StartDateModal
        open={isDatePickerOpen}
        startDate={startDate}
        posts={posts}
        practiceDays={practiceDays}
        onClose={() => setIsDatePickerOpen(false)}
        onApply={handleApplyStartDate}
      />

      {/* Floating Toast Notification for Date Updates */}
      {dateChangeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#292524]/95 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-stone-700 animate-slideUp backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{dateChangeToast}</span>
        </div>
      )}

      {/* Permanent Dance Work Delete Confirmation Modal */}
      {postToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-post-modal-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-rose-200/80 flex flex-col gap-4 animate-scaleUp">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="delete-post-modal-title" className="text-base sm:text-lg font-bold text-stone-900">
                      永久删除作品记录
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                      物理抹除
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">从本地 IndexedDB 与永久存储中彻底删除</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeletingPost) {
                    setPostToDelete(null);
                    setDeletePostError(null);
                  }
                }}
                disabled={isDeletingPost}
                className="text-stone-400 hover:text-stone-600 p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary card of post to be deleted */}
            <div className="p-3 bg-stone-50 border border-stone-200/90 rounded-2xl flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center shrink-0 overflow-hidden border border-black/5">
                {postToDelete.thumbnailUrl || postToDelete.mediaUrl ? (
                  <img
                    src={postToDelete.thumbnailUrl || postToDelete.mediaUrl}
                    alt={postToDelete.title}
                    className="w-full h-full object-cover"
                  />
                ) : postToDelete.mediaType === 'text' ? (
                  <Edit3 className="w-5 h-5 text-orange-500" />
                ) : (
                  <Film className="w-5 h-5 text-orange-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-stone-900 truncate">{postToDelete.title}</h4>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {postToDelete.date} · 阶段：{postToDelete.stage}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {postToDelete.categories.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#FAF4EF] text-[#8C7A6B] border border-[#F0E4D8]"
                    >
                      {c}
                    </span>
                  ))}
                  <span className="text-[10px] text-stone-400 self-center">
                    ({postToDelete.comments.length} 评论 · {postToDelete.likes} 赞)
                  </span>
                </div>
              </div>
            </div>

            {/* Warning Details */}
            <div className="p-3.5 bg-rose-50/90 border border-rose-200/90 rounded-2xl text-xs text-rose-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>确认永久物理删除该篇作品吗？</span>
              </div>
              <p className="text-[11px] text-rose-800/90 leading-relaxed">
                执行后，该作品的视频/封面数据、文字心得及所有互动评论将从本地数据存储中永久销毁，
                <strong>不可撤销且无法恢复</strong>。删除后，主页作品流与各分类统计数值将立即自动刷新。
              </p>
            </div>

            {/* Error banner if deletion throws */}
            {deletePostError && (
              <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="flex-1">{deletePostError}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setPostToDelete(null);
                  setDeletePostError(null);
                }}
                disabled={isDeletingPost}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                取消保留
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePost}
                disabled={isDeletingPost}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isDeletingPost ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>正在物理抹除...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>确认永久删除</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Success Toast for Post Deletion */}
      {deletePostSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-stone-700 animate-slideUp backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{deletePostSuccessToast}</span>
        </div>
      )}

      {/* Floating Success Toast for Tag Updates */}
      {tagActionToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-stone-700 animate-slideUp backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{tagActionToast}</span>
        </div>
      )}

      {/* Post Tag Editor: 展示当前标签，支持修改 / 新增 / 移除，含空值、重复与保存失败处理 */}
      <PostTagEditor
        post={postToEditTags ? (posts.find((p) => p.id === postToEditTags.id) ?? postToEditTags) : null}
        suggestions={suggestedTags}
        onClose={() => setPostToEditTags(null)}
        onSave={handleSavePostTags}
      />

      {/* 舞种管理：新增、筛选、删除都在 StyleManagerModal 内 */}
      <StyleManagerModal
        open={isStyleManagerOpen}
        danceStyles={danceStyles}
        countFor={getCategoryCount}
        suggestedTags={suggestedTags}
        stageCounts={stageCounts}
        mediaCounts={mediaCounts}
        initialTab={styleManagerTab}
        onClose={() => setIsStyleManagerOpen(false)}
        onAddStyle={handleAddDanceStyle}
        onDeleteStyle={handleDeleteDanceStyle}
      />

      {/* Personality Tags & Bio Customization Modal */}
      {isTagModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="personality-tags-title"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-[#F8D2CC] animate-scaleUp overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#FFF0EC] to-[#FFF8F6] border-b border-[#F8D2CC] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFE4DE] text-[#D94834] flex items-center justify-center shrink-0 border border-[#FFC8BC]">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="personality-tags-title" className="text-base sm:text-lg font-bold text-[#3D2C1E]">
                      自定义个性标签与态度签名
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFE4DE] text-[#D94834] border border-[#FFC8BC]">
                      实时保存
                    </span>
                  </div>
                  <p className="text-xs text-[#8C7A6B] mt-0.5">个性化展示你的舞者态度、练习习惯与阶段心境</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="text-[#998675] hover:text-[#3D2C1E] p-1.5 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
              {/* Section 1: Personality Bio Signature */}
              <div className="p-3.5 bg-[#FAF5F0] border border-[#F2DAC2] rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF7E67]" />
                    <span>个性态度签名 / 练舞座右铭</span>
                  </label>
                  <span className="text-[10px] text-[#A68F80]">展示于形象卡顶部</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempSignature}
                    onChange={(e) => setTempSignature(e.target.value)}
                    placeholder="输入属于你的练舞态度签名..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#E8D4C2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/30 text-[#3D2C1E]"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSignature}
                    className="px-3 py-2 bg-[#FF7E67] hover:bg-[#E65B47] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    保存签名
                  </button>
                </div>

                {/* Quick signature inspiration phrases */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-[#8C7A6B] font-semibold">点击快速套用灵感灵光:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '不追求聚光灯，只想在每一个 8-Count 里放飞自我～',
                      '身体比脑子先记住音乐的感觉太棒了💃',
                      '业余跳舞不求完美，大汗淋漓就是最好的释放✨',
                      '每天练习20分钟，肌肉记忆正在悄悄生长～',
                    ].map((phrase) => (
                      <button
                        key={phrase}
                        type="button"
                        onClick={() => {
                          setTempSignature(phrase);
                          setPersonalitySignature(phrase);
                          syncSetItem('cici_personality_signature', phrase);
                          setTagToast('已快速套用灵感签名！');
                          setTimeout(() => setTagToast(null), 2500);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-white hover:bg-[#FFEADB] text-[#7A584C] border border-[#EFE2D5] transition-colors cursor-pointer truncate max-w-full text-left"
                      >
                        &quot;{phrase}&quot;
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Current Active Tags & Deletion */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#E67E22]" />
                    <span>当前展示的个性标签 ({personalityTags.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleResetDefaultTags}
                    className="text-[10px] text-[#A68F80] hover:text-[#D94834] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>恢复默认预设</span>
                  </button>
                </div>

                {personalityTags.length === 0 ? (
                  <div className="p-4 bg-stone-50 border border-dashed border-stone-200 rounded-2xl text-center text-xs text-stone-400">
                    暂未添加个性标签，可在下方添加或点击预设标签～
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {personalityTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-2xs group/item transition-all"
                        style={{
                          backgroundColor: tag.colorBg,
                          color: tag.colorText,
                          borderColor: tag.colorBorder,
                        }}
                      >
                        <span>{tag.emoji}</span>
                        <span>{tag.text}</span>
                        <button
                          type="button"
                          onClick={() => handleDeletePersonalityTag(tag.id)}
                          className="opacity-60 hover:opacity-100 hover:text-rose-600 transition-opacity cursor-pointer ml-0.5 p-0.5 rounded-full hover:bg-black/5"
                          title={`移除标签「${tag.text}」`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Add New Custom Tag Form */}
              <form
                onSubmit={handleAddPersonalityTag}
                className="p-3.5 bg-[#FAF5F0] border border-[#F2DAC2] rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-[#E67E22]" />
                    <span>自定义添加新标签</span>
                  </span>
                  <span className="text-[10px] text-[#A68F80]">选择 Emoji 与色彩风格</span>
                </div>

                {/* Emoji Selector */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#5A4535]">选择前缀 Emoji:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['💃', '🔥', '✨', '🎧', '👠', '👟', '🧘‍♀️', '🥳', '🎬', '☕', '💪', '🌸'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewTagEmoji(emoji)}
                        className={`w-7 h-7 rounded-xl text-sm flex items-center justify-center transition-all cursor-pointer ${
                          newTagEmoji === emoji
                            ? 'bg-[#E67E22] text-white scale-110 shadow-xs ring-2 ring-[#E67E22]/30'
                            : 'bg-white text-stone-700 hover:bg-[#FFEADB] border border-[#EFE2D5]'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input text */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#5A4535]">标签文字内容:</span>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">{newTagEmoji}</span>
                      <input
                        type="text"
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        placeholder="如：卡点狂热分子、动作拆解控、舞室常客..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#E8D4C2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 text-[#3D2C1E]"
                        maxLength={16}
                      />
                    </div>
                  </div>
                </div>

                {/* Color Theme Selector */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-[#5A4535]">选择标签配色:</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {TAG_COLOR_THEMES.map((theme, idx) => (
                      <button
                        key={theme.label}
                        type="button"
                        onClick={() => setNewTagColorIndex(idx)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          newTagColorIndex === idx
                            ? 'ring-2 ring-[#E67E22] scale-105 shadow-2xs'
                            : 'opacity-85 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: theme.bg,
                          color: theme.text,
                          borderColor: theme.border,
                        }}
                      >
                        <span>{theme.label}</span>
                        {newTagColorIndex === idx && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={!newTagText.trim()}
                  className="w-full py-2 bg-[#E67E22] hover:bg-[#D35400] disabled:bg-stone-300 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>添加该个性标签 (即时生效)</span>
                </button>
              </form>

              {/* Section 4: Quick Dancer Presets */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-[#FF7E67]" />
                  <span>快捷添加舞者人设标签:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_DANCER_TAGS.map((preset) => {
                    const isAdded = personalityTags.some((t) => t.text === preset.text);
                    return (
                      <button
                        key={preset.text}
                        type="button"
                        onClick={() => handleAddPresetTag(preset)}
                        disabled={isAdded}
                        className={`text-xs px-2.5 py-1 rounded-xl border transition-all flex items-center gap-1 cursor-pointer ${
                          isAdded
                            ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed opacity-60'
                            : 'bg-white hover:bg-[#FFF6F0] text-[#7A584C] border-[#F2DAC2] hover:border-[#FF9B8A] shadow-2xs'
                        }`}
                      >
                        <span>{preset.emoji}</span>
                        <span>{preset.text}</span>
                        {isAdded ? (
                          <span className="text-[10px] text-stone-400">已加</span>
                        ) : (
                          <Plus className="w-3 h-3 text-[#FF7E67]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-[#FAF5F0] border-t border-[#F2DAC2] flex items-center justify-between text-xs text-[#8C7A6B]">
              <span>修改立即同步至主页，支持随时增删调整</span>
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="px-4 py-1.5 bg-[#FF7E67] hover:bg-[#E65B47] text-white font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Tag Action Toast */}
      {tagToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-stone-900/95 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-stone-700 animate-slideUp backdrop-blur-md">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{tagToast}</span>
        </div>
      )}
    </div>
  );
};
