/**
 * 临时预览页：用假数据覆盖报名闭环的各种状态，仅用于本地 UI 验证。
 * 不写入任何存储，也不连接云端。
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { DanceBuddies } from './components/DanceBuddies';
import type { ForumThread } from './types';

function mk(over: Partial<ForumThread> & { id: string; title: string; content: string }): ForumThread {
  return {
    category: '舞室约练',
    author: 'Lily 老师',
    avatarBg: 'bg-violet-100 text-violet-700',
    createdAt: '2 小时前',
    likes: 3,
    views: 42,
    replies: [],
    ...over,
  } as ForumThread;
}

const threads: ForumThread[] = [
  mk({
    id: '1',
    title: '【静安】周六下午拼大教室练 Roll 与扒舞',
    content: '本期重点：胸部 Roll 的发力顺序 + 结尾四拍卡点。新手也能跟上，练完一起录一段成片。',
    meetup: {
      studio: '星光舞蹈工作室（静安店）',
      date: '本周六 14:00-16:00',
      targetCount: 6,
      joinedBuddies: ['Lily 老师', '小满'],
      isJoined: false,
      costNote: '场地费人均 35 元',
      organizerNote: '爵士舞 4 年，已组织 8 场',
      groupEntry: '微信群「周六爵士练舞」加群主 lily_jazz',
      groupNote: '进群请备注报名昵称',
    },
    organizerStats: { hosted: 8, totalJoined: 46 },
  }),
  mk({
    id: '2',
    title: '【徐汇】周日上午基础律动 + 体能',
    content: '从基础隔离练起，配一段慢速 BPM 音乐，适合刚开始跳的朋友。',
    author: '小满',
    meetup: {
      studio: 'Bounce 舞蹈空间（徐汇店）',
      date: '周日 10:00-12:00',
      targetCount: 8,
      joinedBuddies: ['小满', 'Cici', '阿棠'],
      isJoined: true,
      costNote: '人均 40 元',
      organizerNote: '练舞 2 年，每周固定组局',
      groupEntry: '微信群「周日早课自律组」，进群暗号：早起跳舞',
      groupNote: '群公告里有路线图',
    },
    organizerStats: { hosted: 3, totalJoined: 21 },
  }),
  mk({
    id: '3',
    title: '【浦东】周五晚爵士 Funk 小班（4 人已满）',
    content: '小班制，4 人正好，满了就截止。',
    author: 'Momo',
    meetup: {
      studio: 'Rhythm Lab（浦东）',
      date: '周五 19:30-21:00',
      targetCount: 4,
      joinedBuddies: ['Momo', 'Kiki', 'Yuki', 'Nana'],
      isJoined: false,
      costNote: '人均 50 元',
      groupEntry: '微信群「周五四小花」',
    },
    organizerStats: { hosted: 1, totalJoined: 4 },
  }),
  mk({
    id: '4',
    title: '【我自己组织】周六中午练高跟 Jazz 转圈',
    content: '我是组织者，能看到完整名单与群入口，不用再收微信接龙。',
    author: 'Cici',
    avatarBg: 'bg-orange-100 text-orange-700',
    isOrganizer: true,
    meetup: {
      studio: '星光舞蹈工作室（静安店）',
      date: '周六 12:00-14:00',
      targetCount: 5,
      joinedBuddies: ['Cici', 'Lily 老师'],
      isJoined: true,
      costNote: '人均 35 元',
      organizerNote: 'Jazz 爱好者，组织第 2 场',
      groupEntry: '微信群「Cici 的高跟练习小组」',
      groupNote: '已报名会自动收到群二维码',
    },
    organizerStats: { hosted: 2, totalJoined: 7 },
  }),
  mk({
    id: '5',
    title: '周末一起练舞，费用直接转我就行',
    content: '这周约练，直接扫码转账给我就行，收款码我发群里，微信：lilyjazz2024，扫码进群更快。',
    category: '舞友随笔',
    author: '某舞友',
    meetup: undefined,
  }),
];

const noop = () => {};

createRoot(document.getElementById('root')!).render(
  <DanceBuddies
    buddies={[]}
    messages={[]}
    threads={threads}
    realFriends={[]}
    currentUserName="Cici"
    onToggleFollow={noop}
    onAddMessage={noop}
    onToggleMessageLike={noop}
    onAddReply={noop}
    onToggleJoinMeetup={noop}
  />
);
