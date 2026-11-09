/**
 * GuestForumPreview —— 游客视角的论坛「公开预览」
 *
 * 只展示最近几条公开话题的标题与摘要，点击任何一条都走「登录后使用」的提示，
 * 不展示正文、回复、报名名单和群入口。这样：
 * - 游客能确认「这里真的有活跃舞友」，产生登录动机；
 * - 公开区不泄露具体约练地点、联系方式与群二维码等敏感信息。
 */
import React from 'react';
import { Lock, MessageSquare, MessageCircle, Users, ArrowRight, Flame, Eye, ShieldCheck } from 'lucide-react';
import type { ForumThread } from '../types';
import { GUEST_FORUM_PREVIEW_LIMIT } from '../utils/access';

interface GuestForumPreviewProps {
  threads: ForumThread[];
  loading?: boolean;
  error?: string;
  onLogin: () => void;
  onShowAccess: () => void;
  /** 打开社区公约：游客也该知道这里的规矩 */
  onShowRules: () => void;
}

const CATEGORY_STYLE: Record<ForumThread['category'], string> = {
  舞室约练: 'bg-[#EDE9FE] text-[#6D28D9] border-[#DDD0FA]',
  动作拆解: 'bg-[#FFF1E0] text-[#B45309] border-[#F5DFC4]',
  扒舞音乐: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  舞友随笔: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
};

/** 摘要：去掉换行、截断，并隐藏明显的联系方式，避免预览页被当通讯录 */
function previewText(content: string): string {
  const flat = (content || '')
    .replace(/\s+/g, ' ')
    .replace(/[a-zA-Z][-_a-zA-Z0-9]{5,19}/g, '***')
    .trim();
  return flat.length > 66 ? `${flat.slice(0, 66)}…` : flat;
}

export const GuestForumPreview: React.FC<GuestForumPreviewProps> = ({
  threads,
  loading = false,
  error = '',
  onLogin,
  onShowAccess,
  onShowRules,
}) => {
  const visible = threads.slice(0, GUEST_FORUM_PREVIEW_LIMIT);
  const total = threads.length;

  return (
    <div className="space-y-4">
      {/* 公开预览说明：先讲清"为什么只能看这点" */}
      <div className="rounded-3xl border border-[#E3D7FE] bg-gradient-to-r from-[#F6F0FF] via-[#FBF4FF] to-[#FFF4EE] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#E6D9FF] text-[#7C3AED] flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#292524] flex items-center gap-2">
                论坛 · 公开预览
                <span className="text-[10px] font-bold bg-white/80 text-[#6D28D9] border border-[#DDD0FA] px-1.5 py-0.5 rounded-full">
                  游客可见
                </span>
              </h3>
              <p className="text-[11.5px] text-[#6D5A7A] mt-0.5 leading-relaxed">
                你现在能浏览最近 {GUEST_FORUM_PREVIEW_LIMIT} 条话题的公开信息
                {total > 0 && <>（全站共 {total} 条）</>}。登录后可看全文、回复、发帖约练， 并与舞友加好友、私信。
              </p>
            </div>
          </div>
          <button
            onClick={onLogin}
            className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            登录查看全部
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="mt-2.5 text-[10.5px] text-[#8A7A96] flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 shrink-0" />
          预览只显示标题与摘要，约练地点、联系方式与活动群入口仅对登录舞友开放。
        </p>
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#F1E5D8] bg-[#FFF8F1] px-4 py-6 text-center text-xs text-[#8C7A6B]">
          正在加载公开话题…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-[#FFD5C8] bg-[#FFF1EC] px-4 py-3 text-xs text-[#D94834] text-center">
          公开话题暂时加载失败：{error}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="rounded-3xl border border-[#F1E5D8] bg-white px-5 py-10 text-center">
          <MessageSquare className="w-8 h-8 mx-auto text-[#C4B5FD] mb-2" />
          <p className="text-sm font-bold text-[#4A3E36]">还没有公开话题</p>
          <p className="text-xs text-[#8C7A6B] mt-1">登录后可以发起第一场舞室约练，或求教一个卡了很久的动作。</p>
          <button
            onClick={onLogin}
            className="mt-4 px-4 py-1.5 bg-[#7C3AED] text-white rounded-full text-xs font-bold cursor-pointer"
          >
            登录后发第一帖
          </button>
        </div>
      )}

      {visible.map((thread) => {
        const replyCount = thread.replies?.length ?? 0;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={onLogin}
            className="w-full text-left bg-white border border-[#EFE3D5] rounded-3xl p-4 sm:p-5 shadow-2xs hover:border-[#DDD0FA] hover:shadow-sm transition-all cursor-pointer group"
            aria-label={`查看话题「${thread.title}」需要登录`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${CATEGORY_STYLE[thread.category]}`}
                  >
                    {thread.category}
                  </span>
                  {thread.isPinned && (
                    <span className="text-[10px] font-bold text-[#B45309] bg-[#FFF1E0] border border-[#F5DFC4] px-1.5 py-0.5 rounded-full">
                      置顶
                    </span>
                  )}
                  {thread.meetup && (
                    <span className="text-[10px] text-[#78695C] bg-[#FAF2EB] px-1.5 py-0.5 rounded-full">
                      {thread.meetup.joinedBuddies.length}/{thread.meetup.targetCount} 人已报名
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-[#292524] leading-snug line-clamp-2 group-hover:text-[#6D28D9] transition-colors">
                  {thread.title}
                </h4>
                <p className="text-[11.5px] text-[#8C7A6B] mt-1 leading-relaxed line-clamp-2">
                  {previewText(thread.content)}
                </p>

                <div className="flex items-center gap-3 mt-2.5 text-[10.5px] text-[#A8988A]">
                  <span className="flex items-center gap-1">
                    <span
                      className={`w-4 h-4 rounded-full ${thread.avatarBg} font-bold text-[9px] flex items-center justify-center text-[#5A4535]`}
                    >
                      {thread.author.slice(0, 1)}
                    </span>
                    {thread.author}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Flame className="w-3 h-3" />
                    {thread.likes}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageCircle className="w-3 h-3" />
                    {replyCount}
                  </span>
                  <span>{thread.createdAt}</span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-center gap-1 text-[#B9A9F5] group-hover:text-[#7C3AED] transition-colors pt-1">
                <span className="w-7 h-7 rounded-full bg-[#F5F0FF] border border-[#E3D7FE] flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <span className="text-[9.5px] font-semibold whitespace-nowrap">登录查看</span>
              </div>
            </div>
          </button>
        );
      })}

      {total > visible.length && (
        <div className="rounded-2xl border border-dashed border-[#E3D7FE] bg-[#FBF7FF] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-[11.5px] text-[#6D5A7A] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#7C3AED]" />
            还有 {total - visible.length} 条话题与全部回复，登录后即可展开
          </p>
          <button
            onClick={onLogin}
            className="self-start sm:self-auto text-[11.5px] font-bold text-[#7C3AED] hover:underline cursor-pointer"
          >
            立即登录 →
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-1">
        <button
          onClick={onShowRules}
          className="text-[11px] text-[#7C3AED] font-semibold hover:underline underline-offset-2 cursor-pointer"
        >
          社区公约
        </button>
        <span aria-hidden="true" className="text-[#D9C9BA]">
          ·
        </span>
        <button
          onClick={onShowAccess}
          className="text-[11px] text-[#A8988A] hover:text-[#6B5A4D] underline underline-offset-2 cursor-pointer"
        >
          游客和登录具体差哪些功能？查看权限对比
        </button>
      </div>
    </div>
  );
};
