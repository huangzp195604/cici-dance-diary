export type DanceCategory = 'Jazz' | '韩舞' | '编舞' | '基础练习' | '其他';

export type DanceStage = '入门' | '进阶' | '挑战';

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
  avatarBg: string;
  content: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  isOwner?: boolean;
}

export interface ForumMeetup {
  studio: string;
  date: string; // e.g. "周六 14:00-16:00"
  targetCount: number;
  joinedBuddies: string[];
  isJoined?: boolean;
  costNote?: string;
}

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  category: '舞室约练' | '动作拆解' | '扒舞音乐' | '舞友随笔';
  author: string;
  authorRole?: string;
  avatarBg: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
  views: number;
  replies: ForumReply[];
  meetup?: ForumMeetup;
  isPinned?: boolean;
  tags?: string[];
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
  recentTopic?: string;
  createdAt?: string; // 系统自动记录的新增时间 (ISO)
}

