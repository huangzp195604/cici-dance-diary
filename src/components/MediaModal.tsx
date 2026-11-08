import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, RotateCcw, FlipHorizontal, Heart, MessageCircle, Send, Music, AlertCircle } from 'lucide-react';
import { DancePost } from '../types';
import { useResolvedMedia } from '../hooks/useResolvedMedia';

interface MediaModalProps {
  post: DancePost | null;
  onClose: () => void;
  onToggleLike: (postId: string) => void;
  onAddComment: (postId: string, commentText: string) => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  post,
  onClose,
  onToggleLike,
  onAddComment,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [commentInput, setCommentInput] = useState<string>('');
  const [mediaError, setMediaError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  // 本地视频存的是引用，播放前需从 IndexedDB 还原成 objectURL
  const resolved = useResolvedMedia(post?.mediaUrl);

  useEffect(() => {
    setMediaError(false);
  }, [post?.mediaUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, resolved.url]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!post || post.mediaType === 'text') return null;

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onAddComment(post.id, commentInput.trim());
    setCommentInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl bg-[#FFFDF9] rounded-3xl shadow-2xl overflow-hidden border border-[#EADCCE] max-h-[92vh] flex flex-col md:flex-row">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-[#292524] flex items-center justify-center shadow-md transition-all border border-[#E3D3C4]"
          title="关闭 (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left: Media Player / Viewer */}
        <div className="flex-1 bg-black flex flex-col relative min-h-[280px] md:min-h-[460px] overflow-hidden">
          {post.mediaType === 'video' ? (
            <div className="flex-1 min-h-0 w-full flex flex-col">
              {/* 视频舞台：不叠加任何浮层，保证原生控件（进度条 / 音量 / 全屏）始终可见可点。
                  用 absolute inset-0 撑出确定高度，竖屏视频的 max-h-full 才能正确生效，不会溢出压到工具条。 */}
              <div className="flex-1 min-h-0 w-full relative">
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-1">
                {resolved.loading ? (
                  <div className="text-white/80 text-sm px-6 text-center">正在读取本地视频…</div>
                ) : resolved.missing || !resolved.url ? (
                  <div className="text-white/85 text-sm px-6 text-center leading-relaxed">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                    这段视频保存在上传时的那台设备，本设备没有视频文件。
                    <br />
                    请在原设备查看，或重新上传一次。
                  </div>
                ) : mediaError ? (
                  <div className="text-white/85 text-sm px-6 text-center leading-relaxed">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                    视频无法播放：格式不受支持或资源已失效。
                    <br />
                    iPhone 拍摄的 HEVC/MOV 建议先转成 MP4(H.264) 再上传。
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    src={resolved.url}
                    autoPlay
                    muted
                    loop={isLooping}
                    playsInline
                    controls
                    preload="metadata"
                    className={`max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-200 ${
                      isMirrored ? 'scale-x-[-1]' : ''
                    }`}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onError={() => setMediaError(true)}
                  />
                )}
                </div>
              </div>

              {/* 扒舞工具条：独立占位在画面下方，不再覆盖视频底部，避免遮住原生进度条 / 音量 / 全屏 */}
              {resolved.url && !resolved.missing && !mediaError && (
              <div className="shrink-0 bg-black/85 px-3 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-white text-xs border-t border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
                    title={isPlaying ? '暂停' : '播放'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = 0;
                    }}
                    className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white"
                    title="从头开始"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Dance Practice Speed Toggles (0.5x, 0.75x, 1x) */}
                <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl">
                  <span className="text-[10px] text-white/70 px-1 font-medium">扒舞倍速:</span>
                  {[0.5, 0.75, 1.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => handleSpeedChange(spd)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all ${
                        playbackRate === spd
                          ? 'bg-[#FF7E67] text-white shadow-sm'
                          : 'text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Mirror Mode & Loop */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMirrored(!isMirrored)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-medium transition-all ${
                      isMirrored ? 'bg-[#8B5CF6] text-white' : 'bg-white/15 text-white/80 hover:bg-white/25'
                    }`}
                    title="翻转画面（方便对着镜子或屏幕练习，免去大脑换向）"
                  >
                    <FlipHorizontal className="w-3 h-3" />
                    <span>镜面</span>
                  </button>
                </div>
              </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 w-full flex items-center justify-center p-4">
              {resolved.url && !mediaError ? (
                <img
                  src={resolved.url}
                  alt={post.title}
                  referrerPolicy="no-referrer"
                  onError={() => setMediaError(true)}
                  className="max-h-[60vh] md:max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
                />
              ) : (
                <div className="text-white/85 text-sm text-center leading-relaxed">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  图片加载失败，可能保存在上传时的那台设备或链接已失效
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Notes, Details & Comments */}
        <div className="w-full md:w-88 flex flex-col bg-[#FFFDF9] border-t md:border-t-0 md:border-l border-[#F0E2D4]">
          {/* Header Info */}
          <div className="p-4 sm:p-5 border-b border-[#F1E5D8]">
            <div className="flex items-center gap-2 text-xs text-[#8C7A6B] mb-1.5">
              <span>{post.date}</span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#FF6B6B]">{post.stage}</span>
              <span aria-hidden="true">·</span>
              <span>{post.categories.join(' / ')}</span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#292524] tracking-tight leading-snug">
              {post.title}
            </h3>

            {post.musicName && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[#7B6A5D] bg-[#F7EFE7] px-2.5 py-1 rounded-lg">
                <Music className="w-3.5 h-3.5 text-[#FF7E67] shrink-0" />
                <span className="truncate">{post.musicName}</span>
                {post.bpm && <span className="font-mono text-[#A8988A] ml-auto shrink-0">{post.bpm} BPM</span>}
              </div>
            )}
          </div>

          {/* Practice Notes */}
          <div className="p-4 sm:p-5 border-b border-[#F1E5D8] bg-[#FFFBF7]">
            <div className="text-xs font-bold text-[#8C7A6B] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>📝 练舞小记 & 心得</span>
            </div>
            <p className="text-xs sm:text-sm text-[#4A3E36] leading-relaxed whitespace-pre-wrap">
              {post.notes || '今天专心享受节奏与跳舞的快乐～'}
            </p>
          </div>

          {/* Social Stats & Likes */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-[#F1E5D8] bg-white">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleLike(post.id)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                  post.isLiked
                    ? 'bg-[#FFE8E8] text-[#E02424] border border-[#FFD0D0]'
                    : 'bg-[#F5EDE3] text-[#695B4F] hover:bg-[#EFE3D6]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-current text-[#E02424]' : ''}`} />
                <span>{post.likes} 赞</span>
              </button>

              <div className="flex items-center gap-1 text-xs text-[#8C7A6B]">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{post.comments.length} 条互动</span>
              </div>
            </div>
          </div>

          {/* Comments Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-56 md:max-h-64">
            {post.comments.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#A8988A]">
                还没有留言，留一句打气的话吧～
              </div>
            ) : (
              post.comments.map((comment) => (
                <div key={comment.id} className="text-xs bg-[#FAF3EB] p-2.5 rounded-2xl border border-[#F0E3D6]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[#3D3126] flex items-center gap-1">
                      {comment.author}
                      {comment.isOwner && (
                        <span className="text-[10px] bg-[#FFE0D1] text-[#E65B47] px-1 py-0.2 rounded font-normal">
                          作者
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-[#A8988A]">{comment.createdAt}</span>
                  </div>
                  <p className="text-[#574B40] leading-relaxed">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment Form */}
          <form onSubmit={handleCommentSubmit} className="p-3 bg-white border-t border-[#F1E5D8] flex gap-2">
            <input
              type="text"
              placeholder="留一句鼓励或练舞心得..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-xl border border-[#E8DACB] focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/50 bg-[#FFFDF9]"
            />
            <button
              type="submit"
              disabled={!commentInput.trim()}
              className="px-3 py-2 bg-[#FF7E67] hover:bg-[#E65B47] disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <Send className="w-3 h-3" />
              <span>发送</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
};
