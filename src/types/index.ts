export type DanceCategory = 'Jazz' | '韩舞' | '编舞' | '基础练习' | '其他';

export type DanceStage = '入门' | '进阶' | '挑战';

export type Gender = '男' | '女';

/** 用户云端资料：昵称公开（论坛展示），性别年龄可选 */
export interface UserProfile {
  user_id: string;
  nickname: string | null;
  gender: Gender | null;
  age: number | null;
}

export interface Comment {
  id: string;
  author: string;
  avatarBg: string;
  content: string;
  createdAt: string;
  isOwner?: boolean;
}

export interface DancePost {
  id: string;
  title: string;
  date: string; // e.g. "2026-03-12"
  mediaType: 'video' | 'image';
  mediaUrl: string;
  thumbnailUrl?: string;
  stage: DanceStage;
  categories: DanceCategory[];
  notes: string;
  likes: number;
  isLiked?: boolean;
  comments: Comment[];
  duration?: string; // for videos e.g. "01:24"
  bpm?: number;
  musicName?: string;
}

export interface DanceBuddy {
  id: string;
  name: string;
  avatarBg: string;
  initials: string;
  style: string;
  stage: DanceStage;
  bio: string;
  studio: string;
  frequency: string;
  followersCount: number;
  isFollowed: boolean;
  currentPractice: string; // e.g. "正在练 Jazz Funk 基础步伐"
  recentTrack?: string;
  createdAt?: string; // 系统自动记录的新增时间 (ISO)
}

export interface WallMessage {
  id: string;
  author: string;
  avatarBg: string;
  type: '约练' | '打气' | '找队友' | '动作拆解' | '随笔';
  content: string;
  studioLocation?: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  replies: {
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }[];
}

export interface PracticeSong {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  vibe: string;
  recommendedFor: string;
}

export type ForumCategory = '全部' | '舞室约练' | '动作拆解' | '扒舞音乐' | '舞友随笔';

export interface ForumReply {
  id: string;
  author: string;
  authorRole?: string;
  authorGender?: Gender;
  authorAge?: number;
  avatarBg: string;
  content: string;
  createdAt: string;
  /** 绝对时间戳（YYYY-MM-DD HH:mm），评论展示用 */
  createdAtExact?: string;
  likes: number;
  isLiked?: boolean;
  isOwner?: boolean;
}

export interface ForumMeetup {
  studio: string;
  date: string; // e.g. "周六 14:00-16:00"
  targetCount: number; // 人数上限：到达后报名关闭
  joinedBuddies: string[];
  isJoined?: boolean;
  costNote?: string;
  /** 组织者身份说明（公开，如「XX 舞室爵士老师」） */
  organizerNote?: string;
  /** 活动群入口：仅报名者与组织者可见，来自私有表 forum_meetup_access */
  groupEntry?: string;
  /** 群入口使用说明（如入群口令），同样仅报名者可见 */
  groupNote?: string;
}

/** 组织者履历：由该用户历史约练帖实时统计，不落库 */
export interface OrganizerStats {
  hosted: number;
  totalJoined: number;
}

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  category: '舞室约练' | '动作拆解' | '扒舞音乐' | '舞友随笔';
  author: string;
  authorRole?: string;
  /** 作者资料（来自 profiles，用于展示性别/年龄） */
  authorGender?: Gender;
  authorAge?: number;
  avatarBg: string;
  createdAt: string;
  /** 绝对时间（YYYY-MM-DD HH:mm），与相对时间并存 */
  createdAtExact?: string;
  likes: number;
  isLiked?: boolean;
  views: number;
  replies: ForumReply[];
  meetup?: ForumMeetup;
  isPinned?: boolean;
  tags?: string[];
  /** 组织者履历（约练帖才有） */
  organizerStats?: OrganizerStats;
  /** 当前用户是否为本帖组织者（作者本人） */
  isOrganizer?: boolean;
}

export interface RealFriend {
  id: string;
  name: string;
  contact: string; // WeChat ID or phone
  studio: string;
  danceStyle: string;
  notes: string;
  avatarBg: string;
  status: '在线' | '练舞中' | '空闲';
  /** 性别（选填） */
  gender?: Gender;
  /** 年龄（选填） */
  age?: number;
  recentTopic?: string;
  createdAt?: string; // 系统自动记录的新增时间 (ISO)
}

