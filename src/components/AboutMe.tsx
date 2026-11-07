import { syncRemoveItem, syncSetItem } from '../utils/sync';
import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Sparkles, 
  Calendar, 
  Award, 
  Layers, 
  RotateCcw, 
  Clock,
  TrendingUp,
  Activity,
  Flame,
  Camera,
  Check,
  AlertCircle,
  Edit3,
  Plus,
  X,
  Smile,
  Tag
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DancePost } from '../types';
import { PracticeTrajectoryChart } from './PracticeTrajectoryChart';
import { JazzSkillTree } from './JazzSkillTree';
import { BeginnerTips } from './BeginnerTips';
import { usePracticeDays } from '../utils/practice';

export interface AboutProfileData {
  nickname: string;
  roleStage: string;
  bioText: string;
  habitTags: string[];
}

export const DEFAULT_ABOUT_PROFILE: AboutProfileData = {
  nickname: 'Cici (琪琪)',
  roleStage: '普通 Jazz 爱好者 · 学习阶段',
  bioText: '你好呀！我是 Cici。白天是个普通上班族，晚上和周末是我最期待的舞室时间。从肢体僵硬、同手同脚分不清左右的第 1 天，到如今可以跟着喜欢的 Jazz 音乐把每一个 8-Count 顺畅做完。这个网站不为展示什么专业大作，只是想真诚记录一个普通人学跳舞的全部快乐、瓶颈与进步。',
  habitTags: [
    '💃 主练 Jazz Funk',
    '🎵 偏好 85-105 BPM 中速律动',
    '📍 上海舞室周末常客',
    '👯 热衷寻找约练舞伴',
  ],
};

const PRESET_ROLE_STAGES = [
  '普通 Jazz 爱好者 · 学习阶段',
  '初级入门 · 基础律动与体能打卡',
  '进阶突破 · 舞台编舞研习中',
  '周末常驻舞者 · 快乐释放第一',
  '自由编舞爱好者 · 享受卡点',
  '高跟爵士爱好者 · 气质探索中',
];

const PRESET_HABIT_TAGS = [
  '💃 主练 Jazz Funk',
  '🎵 偏好 85-105 BPM 中速律动',
  '📍 上海舞室周末常客',
  '👯 热衷寻找约练舞伴',
  '👠 初试高跟爵士',
  '🔥 每天20min核心耐力',
  '🎧 卡点狂热分子',
  '🧘‍♀️ 柔韧拉伸必修',
  '🎬 成果视频记录者',
  '☕ 舞后一杯生椰拿铁',
];

// 学习阶段分类定义：与上传表单中选择的 DanceStage 一一对应
const STAGE_DEFS = [
  {
    key: '入门' as const,
    emoji: '🌱',
    desc: '基础与隔离',
    cardBg: 'bg-emerald-50',
    cardBorder: 'border-emerald-200',
    titleColor: 'text-emerald-800',
    countColor: 'text-emerald-600',
  },
  {
    key: '进阶' as const,
    emoji: '🌿',
    desc: '完整舞段与表现力',
    cardBg: 'bg-blue-50',
    cardBorder: 'border-blue-200',
    titleColor: 'text-blue-800',
    countColor: 'text-blue-600',
  },
  {
    key: '挑战' as const,
    emoji: '🔥',
    desc: '高跟与快速爆发',
    cardBg: 'bg-rose-50',
    cardBorder: 'border-rose-200',
    titleColor: 'text-rose-800',
    countColor: 'text-rose-600',
  },
];

const PRESET_BIO_TEMPLATES = [
  {
    title: '工作与爱好平衡',
    content: '你好呀！我是 Cici。白天是个普通上班族，晚上和周末是我最期待的舞室时间。从肢体僵硬、同手同脚分不清左右的第 1 天，到如今可以跟着喜欢的 Jazz 音乐把每一个 8-Count 顺畅做完。这个网站不为展示什么专业大作，只是想真诚记录一个普通人学跳舞的全部快乐、瓶颈与进步。',
  },
  {
    title: '专注身体律动与治愈',
    content: '学舞第 1 年，慢慢学会倾听身体的声音。在这个小天地里，没有工作报表的压力，只有每一个纯粹的 8-Count 与大汗淋漓的畅快。跳舞不是为了比谁更完美，而是让身体自由呼吸 ✨',
  },
  {
    title: '热爱坚持与突破自我',
    content: '从零基础硬骨头到可以在舞室第一排自信做动作，跳舞带给我的远不止肢体线条的变化，更是面对未知挑战时的勇气。Keep dancing & stay wild!',
  },
];

interface AboutMeProps {
  posts: DancePost[];
  userAvatar?: string | null;
  onUpdateAvatar?: (avatarUrl: string | null) => void;
}

export const AboutMe: React.FC<AboutMeProps> = ({
  posts,
  userAvatar,
  onUpdateAvatar,
}) => {
  const DEFAULT_CICI_AVATAR = '/assets/aistudio/image_f83d6670.png';
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile customizable state (persisted in localStorage)
  const [profile, setProfile] = useState<AboutProfileData>(() => {
    try {
      const saved = localStorage.getItem('cici_about_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.nickname === 'string') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cici_about_profile', e);
    }
    return DEFAULT_ABOUT_PROFILE;
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editNickname, setEditNickname] = useState(profile.nickname);
  const [editRoleStage, setEditRoleStage] = useState(profile.roleStage);
  const [editBioText, setEditBioText] = useState(profile.bioText);
  const [editHabitTags, setEditHabitTags] = useState<string[]>(profile.habitTags);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('💃');
  const [profileToast, setProfileToast] = useState<string | null>(null);
  // 当前展开查看作品列表的学习阶段
  const [expandedStage, setExpandedStage] = useState<'入门' | '进阶' | '挑战' | null>(null);

  const handleOpenEditModal = () => {
    setEditNickname(profile.nickname);
    setEditRoleStage(profile.roleStage);
    setEditBioText(profile.bioText);
    setEditHabitTags([...profile.habitTags]);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AboutProfileData = {
      nickname: editNickname.trim() || 'Cici (琪琪)',
      roleStage: editRoleStage.trim() || '普通 Jazz 爱好者 · 学习阶段',
      bioText: editBioText.trim() || DEFAULT_ABOUT_PROFILE.bioText,
      habitTags: editHabitTags.length > 0 ? editHabitTags : DEFAULT_ABOUT_PROFILE.habitTags,
    };
    setProfile(updated);
    syncSetItem('cici_about_profile', JSON.stringify(updated));
    setIsEditModalOpen(false);
    setProfileToast('个人资料已成功保存并即时更新！');
    setTimeout(() => setProfileToast(null), 3500);
  };

  const handleResetProfile = () => {
    setProfile(DEFAULT_ABOUT_PROFILE);
    syncRemoveItem('cici_about_profile');
    setEditNickname(DEFAULT_ABOUT_PROFILE.nickname);
    setEditRoleStage(DEFAULT_ABOUT_PROFILE.roleStage);
    setEditBioText(DEFAULT_ABOUT_PROFILE.bioText);
    setEditHabitTags([...DEFAULT_ABOUT_PROFILE.habitTags]);
    setProfileToast('已恢复为初始默认个人信息！');
    setTimeout(() => setProfileToast(null), 3000);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTagInput.trim();
    if (!text) return;
    const fullTag = `${newTagEmoji} ${text}`;
    if (!editHabitTags.includes(fullTag)) {
      setEditHabitTags((prev) => [...prev, fullTag]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditHabitTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleAddPresetTag = (preset: string) => {
    if (!editHabitTags.includes(preset)) {
      setEditHabitTags((prev) => [...prev, preset]);
    }
  };

  const activeAvatar = userAvatar || (typeof window !== 'undefined' ? localStorage.getItem('cici_user_avatar') : null) || DEFAULT_CICI_AVATAR;

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    if (!file.type || !file.type.startsWith('image/')) {
      setAvatarFeedback({
        type: 'error',
        message: '请选择有效的图片文件格式 (支持 JPG, PNG, WEBP, GIF 等)',
      });
      setTimeout(() => setAvatarFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setAvatarFeedback({
        type: 'error',
        message: '图片过大，请选择小于 8MB 的图片',
      });
      setTimeout(() => setAvatarFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        syncSetItem('cici_user_avatar', result);
        onUpdateAvatar?.(result);
        setAvatarFeedback({
          type: 'success',
          message: '头像更换成功！已全站实时同步',
        });
        setTimeout(() => setAvatarFeedback(null), 3000);
      } else {
        setAvatarFeedback({
          type: 'error',
          message: '读取图片失败，请尝试其他图片',
        });
        setTimeout(() => setAvatarFeedback(null), 4000);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      setAvatarFeedback({
        type: 'error',
        message: '读取图片失败，请检查文件权限后重试',
      });
      setTimeout(() => setAvatarFeedback(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsDataURL(file);
  };

  // Aggregate stats from posts
  const totalPosts = posts.length;
  const videoCount = posts.filter((p) => p.mediaType === 'video').length;
  const imageCount = posts.filter((p) => p.mediaType === 'image').length;
  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);

  // Practice days are persisted and auto-increment from the user-set start date (0 by default)
  const practiceDays = usePracticeDays();

  // Category counts
  const categoryCounts: Record<string, number> = {
    Jazz: 0,
    韩舞: 0,
    编舞: 0,
    基础练习: 0,
    其他: 0,
  };
  posts.forEach((p) => {
    p.categories.forEach((c) => {
      if (categoryCounts[c] !== undefined) {
        categoryCounts[c]++;
      }
    });
  });

  // 学习阶段分类归纳：以打卡时选择的 stage 为唯一分类依据，
  // 按 posts 实时派生，新增 / 删除 / 清空后立即重算，不做任何静态计数
  const stageDistribution = useMemo(() => {
    const groups: Record<'入门' | '进阶' | '挑战', DancePost[]> = {
      入门: [],
      进阶: [],
      挑战: [],
    };
    posts.forEach((post) => {
      if (post.stage === '入门' || post.stage === '进阶' || post.stage === '挑战') {
        groups[post.stage].push(post);
      }
    });

    return STAGE_DEFS.map((def) => {
      const stagePosts = [...groups[def.key]].sort((a, b) => b.date.localeCompare(a.date));
      return {
        ...def,
        posts: stagePosts,
        count: stagePosts.length,
        percent: posts.length > 0 ? Math.round((stagePosts.length / posts.length) * 100) : 0,
      };
    });
  }, [posts]);

  // 校验：三阶段篇数之和必须等于作品总数，用于界面自检统计是否遗漏
  const classifiedTotal = stageDistribution.reduce((sum, stage) => sum + stage.count, 0);
  const isStageCountSynced = classifiedTotal === posts.length;
  const expandedStageData =
    expandedStage ? stageDistribution.find((stage) => stage.key === expandedStage) ?? null : null;

  // 近四周（28 天）活跃度走势：按日期聚合用户真实上传的打卡记录，不使用任何静态/模拟数据
  const pastFourWeeksData = useMemo(() => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const rangeStart = new Date(todayStart.getTime() - 27 * DAY_MS);

    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const toMonthDay = (date: Date) =>
      `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

    // 仅保留最近 28 天内的真实打卡记录，并按日期分组
    const postsByDate = new Map<string, DancePost[]>();
    posts.forEach((post) => {
      if (!post.date) return;
      const dateKey = post.date.slice(0, 10);
      const postDay = new Date(`${dateKey}T00:00:00`);
      if (Number.isNaN(postDay.getTime()) || postDay < rangeStart || postDay > todayStart) return;
      const list = postsByDate.get(dateKey) ?? [];
      list.push(post);
      postsByDate.set(dateKey, list);
    });

    let cumulativePracticeDays = 0;
    return Array.from({ length: 28 }, (_, index) => {
      const day = new Date(rangeStart.getTime() + index * DAY_MS);
      const dateKey = toDateKey(day);
      const dayPosts = postsByDate.get(dateKey) ?? [];
      if (dayPosts.length > 0) cumulativePracticeDays += 1;

      return {
        id: dateKey,
        date: dateKey,
        axisLabel: toMonthDay(day),
        weekLabel: `${day.getFullYear()}年${day.getMonth() + 1}月${day.getDate()}日`,
        practiceCount: dayPosts.length,
        cumulativeDays: cumulativePracticeDays,
        titles: dayPosts.map((post) => post.title),
        categories: dayPosts.flatMap((post) => post.categories),
      };
    });
  }, [posts]);

  // 每 7 天汇总为一张周卡片，数据全部来自上面按日期聚合的真实记录
  const fourWeeksWeekSummary = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const weekDays = pastFourWeeksData.slice(index * 7, index * 7 + 7);
        const firstDay = weekDays[0];
        const lastDay = weekDays[weekDays.length - 1];
        const titles = weekDays.flatMap((d) => d.titles);
        const practiceCount = titles.length;
        const practiceDayCount = weekDays.filter((d) => d.practiceCount > 0).length;

        return {
          id: `w${index + 1}`,
          weekLabel: `第${index + 1}周 (${firstDay.axisLabel}-${lastDay.axisLabel})`,
          practiceCount,
          practiceDayCount,
          recordedWorks: practiceCount,
          titles,
          milestone: titles.length > 0 ? `打卡作品：${titles.join('、')}` : '本周暂无打卡记录',
        };
      }),
    [pastFourWeeksData]
  );

  // 近四周汇总指标（全部由真实记录推导）
  const fourWeeksTotalSessions = pastFourWeeksData.reduce((sum, d) => sum + d.practiceCount, 0);
  const fourWeeksTotalDays = pastFourWeeksData.filter((d) => d.practiceCount > 0).length;
  const fourWeeksStyleCount = new Set(pastFourWeeksData.flatMap((d) => d.categories)).size;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fadeIn">
      
      {/* Avatar feedback toast */}
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

      {/* Profile update feedback toast */}
      {profileToast && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{profileToast}</span>
        </div>
      )}

      {/* 1. Cici Profile Card */}
      <section className="bg-white border border-[#EFE3D5] rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        {/* Soft background decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#FFE8DE] to-transparent rounded-full -mr-20 -mt-20 pointer-events-none opacity-60" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          {/* Synchronized Avatar in About Me */}
          <div
            onClick={handleAvatarClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAvatarClick();
              }
            }}
            title="已实时同步头像 · 点击可从相册上传或更换头像"
            aria-label="Cici 个人头像，点击可更换"
            className="relative group/avatar cursor-pointer w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#FFDFD6] border-4 border-white shadow-md overflow-hidden shrink-0 transition-transform duration-200 hover:scale-105 active:scale-95 ring-2 ring-[#FFD5C8] hover:ring-[#FF7E67]/50"
          >
            <img
              src={activeAvatar}
              alt="Cici 个人头像"
              className="w-full h-full object-cover rounded-2xl group-hover/avatar:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_CICI_AVATAR;
              }}
            />

            {/* Hover Camera Overlay */}
            <div className="absolute inset-0 bg-black/45 rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 group-focus/avatar:opacity-100 transition-opacity backdrop-blur-2xs">
              <Camera className="w-6 h-6 text-white" />
              <span className="text-[10px] font-semibold mt-1">更换头像</span>
            </div>

            {/* Corner Camera Badge */}
            <div className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-white text-[#FF6B6B] shadow-md border border-[#FFDCD8] flex items-center justify-center transition-transform group-hover/avatar:scale-110">
              <Camera className="w-3.5 h-3.5 text-[#FF6B6B]" />
            </div>

            {/* Hidden file input for uploading from device */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          <div className="flex-1 text-center md:text-left relative group/profile">
            {/* Top row: Name & Stage & Edit button */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h2 className="text-2xl font-display font-black text-[#292524] tracking-tight">
                {profile.nickname}
              </h2>
              <span className="text-xs bg-[#FFEFE8] text-[#C4432E] px-3 py-1 rounded-full font-bold border border-[#FFD8CB]">
                {profile.roleStage}
              </span>
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#E65B47] hover:text-white bg-[#FFF3EC] hover:bg-[#FF7E67] border border-[#FFDACF] rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs md:ml-auto"
                title="点击自定义修改个人昵称、身份阶段、自我介绍与个性标签"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>自定义编辑资料</span>
              </button>
            </div>

            <p 
              onClick={handleOpenEditModal}
              title="点击直接自定义修改自我介绍"
              className="text-xs sm:text-sm text-[#574B40] mt-3 leading-relaxed max-w-2xl cursor-pointer hover:bg-stone-50/80 p-2 -m-2 rounded-xl transition-all border border-transparent hover:border-[#FFDACF]"
            >
              &quot;{profile.bioText}&quot;
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
              {profile.habitTags.map((tag) => (
                <span key={tag} className="text-xs bg-[#FAF2EB] text-[#78695C] px-3 py-1 rounded-lg border border-[#F2E5D8] flex items-center gap-1 shadow-2xs">
                  {tag}
                </span>
              ))}
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="text-xs text-[#E65B47] hover:text-[#C4432E] bg-white hover:bg-[#FFEAE0] border border-dashed border-[#FFC4B5] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="添加新标签或修改已有标签"
              >
                <Plus className="w-3 h-3" />
                <span>自定义标签</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Automated Growth Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FFF4EC] border border-[#F5DEC7] rounded-3xl p-4 text-center">
          <span className="text-xs text-[#8C7A6B] font-medium block">累计练舞天数</span>
          <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#E65B47] mt-1 block">
            {practiceDays} <span className="text-xs font-normal text-[#8C7A6B]">天</span>
          </span>
          <span className="text-[11px] text-[#A67E6B] mt-0.5 block">从入门手脚不协调坚持至今</span>
        </div>

        <div className="bg-[#FEF6E8] border border-[#FBE3B3] rounded-3xl p-4 text-center">
          <span className="text-xs text-[#8C7A6B] font-medium block">沉淀作品总数</span>
          <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#D97706] mt-1 block">
            {totalPosts} <span className="text-xs font-normal text-[#8C7A6B]">篇</span>
          </span>
          <span className="text-[11px] text-[#A67E6B] mt-0.5 block">{videoCount} 视频 / {imageCount} 照片</span>
        </div>

        <div className="bg-[#EDE9FE] border border-[#DDD0FA] rounded-3xl p-4 text-center">
          <span className="text-xs text-[#7C3AED] font-medium block">社区鼓励收获</span>
          <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#6D28D9] mt-1 block">
            {totalLikes} <span className="text-xs font-normal text-[#7C3AED]">❤️ 赞</span>
          </span>
          <span className="text-[11px] text-[#7C3AED] mt-0.5 block">被伙伴看见的陪伴感</span>
        </div>

        <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-3xl p-4 text-center">
          <span className="text-xs text-[#059669] font-medium block">当前练习阶段</span>
          <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#047857] mt-1 block">
            进阶 <span className="text-xs font-normal text-[#059669]">期</span>
          </span>
          <span className="text-[11px] text-[#059669] mt-0.5 block">正在攻克情感流编舞</span>
        </div>
      </section>

      {/* 2.5 Recharts Practice Frequency Line Chart (Past 4 Weeks) */}
      <section className="bg-white border border-[#EFE3D5] rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-display font-extrabold text-[#292524] tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FF7E67]" />
                <span>过去四周练习活跃度走势 (Recharts 折线图)</span>
              </h3>
              <span className="text-xs bg-[#FFF2EB] text-[#E65B47] px-2.5 py-0.5 rounded-full font-semibold">
                近 28 天动态
              </span>
            </div>
            <p className="text-xs text-[#78695C] mt-1">
              按日期聚合近 28 天真实打卡记录，随作品新增或清空实时更新。
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs bg-[#FAF2EB] px-3 py-1.5 rounded-2xl border border-[#E8DACB] self-start sm:self-auto font-medium">
            <span className="flex items-center gap-1.5 text-[#5C4D42]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF7E67]" />
              当日打卡次数
            </span>
            <span className="flex items-center gap-1.5 text-[#5C4D42]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
              累计练习天数
            </span>
          </div>
        </div>

        {/* 4-Week Key Metrics Ribbon */}
        <div className="grid grid-cols-3 gap-3 bg-[#FFFDF9] border border-[#F2E5D8] p-3.5 rounded-2xl">
          <div className="text-center">
            <span className="text-[11px] text-[#8C7A6B] block">近四周打卡次数</span>
            <span className="font-display font-black text-xl text-[#E65B47] mt-0.5 block">
              {fourWeeksTotalSessions} <span className="text-xs font-normal text-[#8C7A6B]">次</span>
            </span>
          </div>
          <div className="text-center border-x border-[#F2E5D8]">
            <span className="text-[11px] text-[#8C7A6B] block">累计练习天数</span>
            <span className="font-display font-black text-xl text-[#8B5CF6] mt-0.5 block">
              {fourWeeksTotalDays} <span className="text-xs font-normal text-[#8C7A6B]">天</span>
            </span>
          </div>
          <div className="text-center">
            <span className="text-[11px] text-[#8C7A6B] block">覆盖舞种</span>
            <span className="font-display font-black text-xl text-[#10B981] mt-0.5 block">
              {fourWeeksStyleCount} <span className="text-xs font-normal text-[#8C7A6B]">种</span>
            </span>
          </div>
        </div>

        {/* Recharts Line/Area Chart: 近 28 天按日期聚合的真实打卡数据 */}
        <div className="w-full h-64 sm:h-72 bg-[#FFFDFB] border border-[#F0E4D8] rounded-2xl p-3 sm:p-4">
          {fourWeeksTotalSessions > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={pastFourWeeksData}
                margin={{ top: 15, right: 20, left: -15, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="rechartsJazzGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF7E67" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF7E67" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1E5D8" vertical={false} />
                <XAxis
                  dataKey="axisLabel"
                  interval={3}
                  tick={{ fill: '#78695C', fontSize: 10, fontWeight: 500 }}
                  axisLine={{ stroke: '#E8DACB' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tick={{ fill: '#A8988A', fontSize: 11 }}
                  axisLine={{ stroke: '#E8DACB' }}
                  tickLine={false}
                />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} hide />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white/95 backdrop-blur-md border border-[#F0E1D3] p-3 rounded-2xl shadow-lg text-xs max-w-xs">
                          <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-[#F5ECE1]">
                            <span className="font-bold text-[#292524]">{data.weekLabel}</span>
                          </div>
                          <div className="space-y-1 text-[#66564A]">
                            <div className="flex justify-between">
                              <span>当日打卡次数:</span>
                              <strong className="text-[#E65B47] font-mono">{data.practiceCount} 次</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>累计练习天数:</span>
                              <strong className="text-[#8B5CF6] font-mono">{data.cumulativeDays} 天</strong>
                            </div>
                            {data.titles.length > 0 ? (
                              <div className="mt-1 text-[11px] text-[#292524]">
                                <span className="text-[#8C7A6B]">打卡作品: </span>
                                <span className="font-semibold">{data.titles.join('、')}</span>
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-[#A8988A] leading-snug">
                                当日暂无打卡记录
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="practiceCount"
                  name="当日打卡次数"
                  stroke="#FF7E67"
                  strokeWidth={3.5}
                  fill="url(#rechartsJazzGrad)"
                  activeDot={{ r: 6, fill: '#E65B47', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativeDays"
                  name="累计练习天数"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#8B5CF6' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center gap-2">
              <div className="w-11 h-11 rounded-2xl bg-[#FAF2EB] border border-[#E8DACB] flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#A8988A]" />
              </div>
              <p className="text-sm font-bold text-[#4A3E36]">近四周暂无打卡记录</p>
              <p className="text-xs text-[#8C7A6B] max-w-xs leading-relaxed">
                上传你的第一支舞蹈作品后，这里会按日期自动生成真实的活跃度走势。
              </p>
            </div>
          )}
        </div>

        {/* 4 Weeks Step-by-Step Evolution Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {fourWeeksWeekSummary.map((week) => (
            <div
              key={week.id}
              className="bg-[#FFFDF9] border border-[#F0E4D8] hover:border-[#FF7E67] p-3.5 rounded-2xl transition-all"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-mono font-bold text-[#E65B47]">{week.weekLabel}</span>
                <span className="text-[10px] bg-[#FAF2EB] text-[#78695C] px-1.5 py-0.5 rounded font-mono">
                  {week.practiceCount} 次 / {week.practiceDayCount} 天
                </span>
              </div>
              <p className="text-[11px] text-[#78695C] mt-1 leading-snug">
                {week.milestone}
              </p>
              {week.recordedWorks > 0 && (
                <div className="mt-2 text-[10px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                  📹 已上传 {week.recordedWorks} 篇打卡
                </div>
              )}
            </div>
          ))}
        </div>

      </section>

      {/* 2.6 Full Practice Trajectory & Heatmap */}
      <PracticeTrajectoryChart posts={posts} />

      {/* 3. Dance Style Distribution & Stage Growth */}
      <section className="bg-white border border-[#EFE3D5] rounded-3xl p-6 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-[#292524] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#FF7E67]" />
          <span>舞种与进阶分布</span>
        </h3>

        {/* Categories Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#78695C] font-medium">
            <span>涉猎舞种分布</span>
            <span>共 {totalPosts} 条记录</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <div key={cat} className="bg-[#FAF2EB] p-2.5 rounded-xl border border-[#F0E4D8]">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-[#3D3126]">{cat}</span>
                  <span className="font-mono text-[#D95338] font-bold">{count}</span>
                </div>
                <div className="w-full bg-[#E8DACB] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-[#FF7E67] h-full rounded-full"
                    style={{ width: `${totalPosts ? (count / totalPosts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stage Progress：按打卡时选择的阶段自动归类，点击卡片查看该类作品 */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#78695C] font-medium">学习阶段演变历程</span>
            <span className="text-[10px] text-[#A89888]">点击分类卡片查看对应作品</span>
          </div>

          <div className="flex items-center gap-2">
            {stageDistribution.map((stage, index) => (
              <React.Fragment key={stage.key}>
                {index > 0 && <span className="text-[#C4AFA5] shrink-0">→</span>}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStage((prev) => (prev === stage.key ? null : stage.key))
                  }
                  aria-expanded={expandedStage === stage.key}
                  title={`${stage.key}阶段共 ${stage.count} 篇作品，点击${
                    expandedStage === stage.key ? '收起' : '查看'
                  }作品列表`}
                  className={`flex-1 min-w-0 ${stage.cardBg} border p-2.5 rounded-xl text-center transition-all cursor-pointer ${
                    expandedStage === stage.key
                      ? 'border-[#E65B47] ring-2 ring-[#FF7E67]/30 shadow-xs'
                      : `${stage.cardBorder} hover:shadow-xs`
                  }`}
                >
                  <span className={`text-xs font-semibold block ${stage.titleColor}`}>
                    {stage.emoji} {stage.key} ({stage.desc})
                  </span>
                  <span className={`text-xs font-mono mt-0.5 block ${stage.countColor}`}>
                    {stage.count} 篇作品 · {stage.percent}%
                  </span>
                </button>
              </React.Fragment>
            ))}
          </div>

          {expandedStageData && (
            <div className="mt-3 border border-[#EFE3D5] bg-[#FFFDFB] rounded-2xl p-3 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#574B40]">
                  {expandedStageData.emoji} {expandedStageData.key}阶段作品（
                  {expandedStageData.count} 篇）
                </span>
                <button
                  type="button"
                  onClick={() => setExpandedStage(null)}
                  className="text-[11px] text-[#A89888] hover:text-[#E65B47] cursor-pointer"
                >
                  收起
                </button>
              </div>

              {expandedStageData.posts.length === 0 ? (
                <p className="text-[11px] text-[#A89888]">
                  该阶段暂无作品。上传打卡时选择「{expandedStageData.key}」，作品会自动归入这里。
                </p>
              ) : (
                <ul className="max-h-44 overflow-y-auto divide-y divide-[#F2E5D8]">
                  {expandedStageData.posts.map((post) => (
                    <li
                      key={post.id}
                      className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="truncate font-semibold text-[#3D3126]">
                        《{post.title}》
                      </span>
                      <span className="shrink-0 text-[#A89888] font-mono">
                        {post.date.slice(0, 10)}
                        {post.categories.length > 0 ? ` · ${post.categories.join(' / ')}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-[10px] text-[#A89888] font-mono mt-2">
            统计校验：入门 {stageDistribution[0]?.count ?? 0} + 进阶{' '}
            {stageDistribution[1]?.count ?? 0} + 挑战 {stageDistribution[2]?.count ?? 0} ={' '}
            {classifiedTotal} 篇，作品总数 {posts.length} 篇
            <span className={isStageCountSynced ? 'text-emerald-600' : 'text-[#D95338]'}>
              {isStageCountSynced ? ' · 已核对一致' : ' · 存在未归类作品'}
            </span>
          </p>
        </div>
      </section>

      {/* 4. Jazz Skill Tree & Check-in */}
      <JazzSkillTree />

      {/* 5. Beginner Gear & Tips */}
      <BeginnerTips />

      {/* Customizable Profile Edit Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-profile-edit-title"
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#F8D2CC] animate-scaleUp overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#FFF0EC] to-[#FFF8F6] border-b border-[#F8D2CC] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FFE4DE] text-[#D94834] flex items-center justify-center shrink-0 border border-[#FFC8BC]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="about-profile-edit-title" className="text-base sm:text-lg font-bold text-[#3D2C1E]">
                      自定义个人资料与学舞名片
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFE4DE] text-[#D94834] border border-[#FFC8BC]">
                      自由输入 · 实时生效
                    </span>
                  </div>
                  <p className="text-xs text-[#8C7A6B] mt-0.5">
                    你可以自由修改个人昵称、阶段称号、练舞故事与习惯标签
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-[#998675] hover:text-[#3D2C1E] p-1.5 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                title="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveProfile} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
              
              {/* Field 1: 昵称 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-[#E67E22]" />
                  <span>个人昵称 / 舞者名字</span>
                </label>
                <input
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="如：Cici (琪琪)、小雨、Groove舞者..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF5F0] border border-[#E8D4C2] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/30 text-[#3D2C1E]"
                  maxLength={24}
                  required
                />
              </div>

              {/* Field 2: 阶段身份与称号 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#E67E22]" />
                  <span>阶段身份与舞者称号</span>
                </label>
                <input
                  type="text"
                  value={editRoleStage}
                  onChange={(e) => setEditRoleStage(e.target.value)}
                  placeholder="如：普通 Jazz 爱好者 · 学习阶段..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF5F0] border border-[#E8D4C2] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/30 text-[#3D2C1E]"
                  maxLength={32}
                  required
                />
                {/* Preset Role Stages */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8C7A6B] font-semibold">点击快速套用预设称号:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_ROLE_STAGES.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setEditRoleStage(preset)}
                        className={`text-[11px] px-2.5 py-1 rounded-xl transition-all cursor-pointer border ${
                          editRoleStage === preset
                            ? 'bg-[#FF7E67] text-white border-[#FF6B6B] shadow-2xs font-bold'
                            : 'bg-white hover:bg-[#FFEAE0] text-[#78695C] border-[#E8DACB]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Field 3: 自我介绍 / 学舞心声 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#FF7E67]" />
                    <span>自我介绍 / 学舞心声与故事</span>
                  </label>
                  <span className="text-[10px] text-[#A68F80]">
                    {editBioText.length} 字
                  </span>
                </div>
                <textarea
                  value={editBioText}
                  onChange={(e) => setEditBioText(e.target.value)}
                  rows={4}
                  placeholder="写下你的跳舞初心、学舞日常或想对舞友说的话..."
                  className="w-full px-3 py-2 text-xs bg-[#FAF5F0] border border-[#E8D4C2] rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/30 text-[#3D2C1E] leading-relaxed resize-none"
                  maxLength={500}
                  required
                />
                {/* Preset Bio Templates */}
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8C7A6B] font-semibold">点击快速填入灵感文案模板:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {PRESET_BIO_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.title}
                        type="button"
                        onClick={() => setEditBioText(tmpl.content)}
                        className="text-[10px] p-2 rounded-xl bg-white hover:bg-[#FFF3EC] text-[#7A584C] border border-[#E8DACB] hover:border-[#FFB8A8] text-left transition-colors cursor-pointer"
                      >
                        <span className="font-bold text-[#D94834] block mb-0.5">💡 {tmpl.title}</span>
                        <p className="line-clamp-2 text-[#8C7A6B]">{tmpl.content}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Field 4: 个性习惯标签 */}
              <div className="space-y-2.5 p-3.5 bg-[#FAF5F0] border border-[#F2DAC2] rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#3D2C1E] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#E67E22]" />
                    <span>个性习惯标签 ({editHabitTags.length})</span>
                  </label>
                  <span className="text-[10px] text-[#A68F80]">展示于名片底部</span>
                </div>

                {/* Current Active Habit Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {editHabitTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white text-[#78695C] border border-[#E2D5C8] shadow-2xs group/tag"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-stone-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5 rounded-full hover:bg-stone-100"
                        title="删除该标签"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add new habit tag input */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-[#5A4535]">添加自定义新标签:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Quick Emojis */}
                    {['💃', '🎵', '📍', '👯', '👠', '🔥', '🎧', '🧘‍♀️', '🎬', '☕'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewTagEmoji(emoji)}
                        className={`w-6 h-6 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
                          newTagEmoji === emoji
                            ? 'bg-[#E67E22] text-white scale-110 shadow-xs'
                            : 'bg-white text-stone-700 hover:bg-[#FFEADB] border border-[#EFE2D5]'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs">
                        {newTagEmoji}
                      </span>
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        placeholder="输入新标签内容，如：每天20min核心、初试高跟爵士..."
                        className="w-full pl-7 pr-3 py-1.5 text-xs bg-white border border-[#E8D4C2] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E67E22]/30 text-[#3D2C1E]"
                        maxLength={20}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!newTagInput.trim()}
                      className="px-3 py-1.5 bg-[#E67E22] hover:bg-[#D35400] disabled:bg-stone-300 text-white text-xs font-bold rounded-xl transition-all shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>添加</span>
                    </button>
                  </div>
                </div>

                {/* Preset habit tags library */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-[#8C7A6B] font-semibold">快速添加推荐舞者习惯标签:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_HABIT_TAGS.map((preset) => {
                      const isAdded = editHabitTags.includes(preset);
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => handleAddPresetTag(preset)}
                          disabled={isAdded}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                            isAdded
                              ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                              : 'bg-white hover:bg-[#FFEAE0] text-[#78695C] border-[#E8DACB]'
                          }`}
                        >
                          <span>{preset}</span>
                          {!isAdded && <Plus className="w-2.5 h-2.5 text-[#E67E22]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-2 flex items-center justify-between border-t border-[#F0E4D8] gap-3">
                <button
                  type="button"
                  onClick={handleResetProfile}
                  className="text-xs text-[#998675] hover:text-[#DC2626] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复初始信息</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#FF7E67] hover:bg-[#E65B47] text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>保存并即时生效</span>
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
