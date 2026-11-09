import React, { useState } from 'react';
import { compressImageFile } from '../utils/imageCompress';
import {
  MediaStorageError,
  LOCAL_MEDIA_PREFIX,
  hasRoomForMedia,
  makeLocalMediaId,
  saveMediaBlob,
} from '../utils/mediaStore';
import { formatDuration, probeVideo } from '../utils/videoPoster';
import { useResolvedMedia } from '../hooks/useResolvedMedia';
import { VIDEO_NOTE_LOCAL, VIDEO_UPLOAD_NOTICE } from '../utils/videoNotice';
import { STORAGE_FULL_TIP, STORAGE_TIGHT_TIP, WECHAT_VIDEO_TIP, isWeChat } from '../utils/env';
import {
  UploadCloud,
  Film,
  Image as ImageIcon,
  Calendar,
  Check,
  Sparkles,
  Music,
  FileText,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DancePost, DanceCategory, DanceStage } from '../types';

interface UploadFormProps {
  onAddPost: (post: DancePost) => void;
  onCancel: () => void;
  /** 从空状态引导进入时的默认记录方式：text 表示先写一句话，不必先找视频 */
  initialMode?: 'media' | 'text';
}

// 示例素材：随站点一起打包的本地文件（相对路径，兼容根域与子路径部署）
// 以前指向外部 mp4 与一张不存在的图片，实测 403 / 404，点开会是空白卡片
const PRESET_SAMPLES = [
  {
    name: '基础律动与隔离 (视频示范)',
    type: 'video' as const,
    url: 'samples/sample-landscape.webm',
    title: '下课后在舞室的卡点复习',
    categories: ['Jazz', '基础练习'] as DanceCategory[],
    stage: '入门' as DanceStage,
    bpm: 94,
    musicName: 'Smooth Jazz Walk & Hit',
    notes: '今天重点练习了手腕的延伸和胸部的上下卡点，虽然还有点僵硬，但节奏稳多了！',
  },
  {
    name: '快歌卡点排练 (视频示范)',
    type: 'video' as const,
    url: 'samples/sample-portrait.webm',
    title: '周末韩舞翻跳打卡：快节奏挑战',
    categories: ['韩舞', 'Jazz'] as DanceCategory[],
    stage: '进阶' as DanceStage,
    bpm: 118,
    musicName: 'Fast Pop Beat Sync',
    notes: '速度提上来之后呼吸容易乱，这次学会了在慢拍偷换气，体力撑下来了！',
  },
  {
    name: '结课定格抓拍 (照片示范)',
    type: 'image' as const,
    url: 'samples/sample-photo.jpg',
    title: '抒情 Jazz 结课抓拍',
    categories: ['编舞', 'Jazz'] as DanceCategory[],
    stage: '进阶' as DanceStage,
    bpm: 82,
    musicName: 'Emotional Contemporary Jazz',
    notes: '结课的时候老师帮忙拍的定点抓拍，身体线条越来越舒展了，纪念这一刻！',
  },
];

export const UploadForm: React.FC<UploadFormProps> = ({ onAddPost, onCancel, initialMode = 'media' }) => {
  const [entryMode, setEntryMode] = useState<'media' | 'text'>(initialMode);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [mediaType, setMediaType] = useState<'video' | 'image'>('video');
  const [mediaUrl, setMediaUrl] = useState('');
  const [stage, setStage] = useState<DanceStage>('入门');
  const [selectedCategories, setSelectedCategories] = useState<DanceCategory[]>(['Jazz']);
  const [notes, setNotes] = useState('');
  const [musicName, setMusicName] = useState('');
  const [bpm, setBpm] = useState<number | undefined>(92);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [mediaNotice, setMediaNotice] = useState('');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [durationText, setDurationText] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // 本地视频的 mediaUrl 只是引用，需要异步从 IndexedDB 还原成可播放地址
  const resolved = useResolvedMedia(mediaUrl);

  const allCategories: DanceCategory[] = ['Jazz', '韩舞', '编舞', '基础练习', '其他'];

  /** 纯文字模式：新用户不必先找视频，写一句话就能完成第一次记录 */
  const isTextMode = entryMode === 'text';

  const toggleCategory = (cat: DanceCategory) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return; // Keep at least one
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  // Local file picker handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');
    setMediaNotice('');
    setPosterUrl(null);
    setDurationText(undefined);
    setMediaUrl('');
    const isVid = file.type.startsWith('video') || /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name);
    setMediaType(isVid ? 'video' : 'image');

    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ''));
    }

    if (isVid) {
      // 视频体积大：Blob 存 IndexedDB，帖子只保存引用，刷新后仍能重新解析播放
      setBusy(true);
      try {
        // 先粗判空间，别让用户等完解码才失败
        if (!(await hasRoomForMedia())) {
          setErrorMsg(STORAGE_TIGHT_TIP);
          return;
        }
        const probe = await probeVideo(file);
        const id = makeLocalMediaId();
        await saveMediaBlob(id, file);
        setMediaUrl(`${LOCAL_MEDIA_PREFIX}${id}`);
        setPosterUrl(probe.poster);
        setDurationText(formatDuration(probe.duration));

        if (!probe.playable) {
          setErrorMsg(
            '当前浏览器无法解码这个视频（常见于 iPhone 拍摄的 HEVC/MOV）。建议改用 MP4(H.264)，或在相册里「导出/转存」一次再上传。'
          );
        } else {
          setMediaNotice(isWeChat() ? `${VIDEO_UPLOAD_NOTICE} ${WECHAT_VIDEO_TIP}` : VIDEO_UPLOAD_NOTICE);
        }
      } catch (err) {
        console.warn('视频保存失败', err);
        if (err instanceof MediaStorageError && err.kind === 'quota') {
          setErrorMsg(STORAGE_FULL_TIP);
        } else if (err instanceof MediaStorageError && err.kind === 'unsupported') {
          setErrorMsg('这个浏览器不让我们把视频存在本机（常见于隐私模式或微信限制）。换普通浏览器打开，或先改传照片。');
        } else {
          setErrorMsg('视频保存失败，可能是文件太大或浏览器存储受限。请换一个较小的视频，或改传照片。');
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    // 图片压缩后转 base64，才能持久保存并跨设备同步
    try {
      const dataUrl = await compressImageFile(file);
      setMediaUrl(dataUrl);
    } catch (err) {
      console.warn('图片压缩失败，回退原图', err);
      setErrorMsg('这张图片处理失败，请换一张试试');
    }
  };

  const handleApplyPreset = (preset: (typeof PRESET_SAMPLES)[0]) => {
    setMediaType(preset.type);
    setMediaUrl(preset.url);
    setPosterUrl(null);
    setDurationText(undefined);
    setErrorMsg('');
    setMediaNotice(
      preset.type === 'video' ? '这是内置示例素材，可直接保存体验完整流程；想换成自己的视频就点「重新选择」。' : ''
    );
    setTitle(preset.title);
    setStage(preset.stage);
    setSelectedCategories(preset.categories);
    setNotes(preset.notes);
    setMusicName(preset.musicName);
    setBpm(preset.bpm);
    setFileName(`[预设示例] ${preset.name}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('请填写作品或打卡标题哦');
      return;
    }
    if (!isTextMode && (!mediaUrl.trim() || busy)) {
      setErrorMsg(
        busy
          ? '视频还在处理中，请稍等一下再保存'
          : '请选择一段舞蹈视频或上传照片；如果暂时没有素材，可以切换到「只写文字」。'
      );
      return;
    }

    const newPost: DancePost = {
      id: `post-${Date.now()}`,
      title: title.trim(),
      date,
      mediaType: isTextMode ? 'text' : mediaType,
      mediaUrl: isTextMode ? '' : mediaUrl.trim(),
      // 视频封面必须是图片，不能把视频地址塞给 <img>（旧实现在这里就裂了）
      thumbnailUrl: !isTextMode && mediaType === 'video' ? (posterUrl ?? undefined) : undefined,
      stage,
      categories: selectedCategories,
      notes: notes.trim(),
      likes: 1, // Self love!
      isLiked: true,
      comments: [],
      musicName: musicName.trim() || undefined,
      bpm: bpm || undefined,
      duration: !isTextMode && mediaType === 'video' ? durationText : undefined,
    };

    onAddPost(newPost);

    // Trigger sweet celebration confetti!
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF7E67', '#FFD166', '#8B5CF6', '#06D6A0'],
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-[#FFF4EC] border border-[#F6DCBE] rounded-3xl p-5 mb-6 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFE4D4] text-[#E65B47] flex items-center justify-center shrink-0">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#292524] tracking-tight">
              记录每一次练舞成长
            </h2>
            <p className="text-xs sm:text-sm text-[#7D6B5E] mt-0.5">
              每一个动作的记忆、每一次流汗的八拍，都是业余舞者最珍贵的闪光时刻。
            </p>
          </div>
        </div>
      </div>

      {/* 记录方式切换：新手不必先找素材，写一句话也能完成第一次记录 */}
      <div className="flex items-center gap-1.5 p-1 mb-5 bg-[#F6EDE4] rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setEntryMode('media');
            setErrorMsg('');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            !isTextMode ? 'bg-white text-[#C4432E] shadow-2xs' : 'text-[#8C7A6B] hover:bg-white/60'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>传视频 / 照片</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setEntryMode('text');
            setErrorMsg('');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isTextMode ? 'bg-white text-[#C4432E] shadow-2xs' : 'text-[#8C7A6B] hover:bg-white/60'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>只写文字（最快）</span>
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {mediaNotice && !errorMsg && (
        <div className="mb-4 p-3 bg-sky-50 border border-sky-200 text-sky-800 rounded-2xl text-xs leading-relaxed">
          {mediaNotice}
        </div>
      )}

      {/* Main Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#EDE0D2] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6"
      >
        {/* 1. Media Upload / Preset Selector */}
        <div className={isTextMode ? 'hidden' : ''}>
          <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-2">
            1. 舞蹈媒体 (视频 / 图片) *
          </label>

          <div className="border-2 border-dashed border-[#E3D3C4] hover:border-[#FF7E67] bg-[#FFFDFB] rounded-2xl p-4 sm:p-6 text-center transition-colors">
            {busy ? (
              <div className="py-8 text-sm text-[#8C7A6B]">正在处理视频并生成本地封面…</div>
            ) : mediaUrl ? (
              <div className="space-y-3">
                {mediaType === 'video' ? (
                  <>
                    <div className="max-w-md mx-auto aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                      {resolved.loading ? (
                        <span className="text-xs text-white/70">正在读取本地视频…</span>
                      ) : resolved.url ? (
                        <video
                          src={resolved.url}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-white/80 px-4">本地视频读取失败，请重新选择</span>
                      )}
                    </div>
                    {/* 视频区域备注：选完就告知「换设备打不开原片」，
                        不让用户等到换设备那天才发现，也不让人误以为已上云 */}
                    <div className="max-w-md mx-auto flex items-start gap-1.5 text-left text-[11px] leading-snug text-[#9A8578]">
                      <HardDrive className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{VIDEO_NOTE_LOCAL}</span>
                    </div>
                  </>
                ) : (
                  <div className="max-w-md mx-auto max-h-56 rounded-xl overflow-hidden flex items-center justify-center bg-[#F7EFE7]">
                    <img src={resolved.url || undefined} alt="Preview" className="max-h-56 object-contain" />
                  </div>
                )}
                <div className="text-xs text-[#574B40] font-medium flex flex-wrap items-center justify-center gap-2">
                  <span className="break-all">已就绪: {fileName || '已选取媒体'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaUrl('');
                      setFileName('');
                      setPosterUrl(null);
                      setDurationText(undefined);
                      setMediaNotice('');
                      setErrorMsg('');
                    }}
                    className="text-[#E02424] hover:underline"
                  >
                    重新选择
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-12 h-12 rounded-full bg-[#FFEAE0] text-[#FF7E67] flex items-center justify-center mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-[#292524]">拖拽或点击上传本地视频 / 照片</p>
                <p className="text-xs text-[#8C7A6B] mt-1 leading-relaxed">
                  支持 MP4 / MOV / WEBM 视频或 JPG / PNG 图片
                  <br className="sm:hidden" />
                  <span className="hidden sm:inline"> · </span>
                  手机拍摄建议用 MP4(H.264)，兼容性最好
                </p>

                <input
                  type="file"
                  id="dance-media-input"
                  accept="video/*,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="dance-media-input"
                  className="mt-4 px-4 py-2 bg-[#FF7E67] hover:bg-[#E65B47] text-white text-xs font-semibold rounded-full cursor-pointer shadow-sm transition-all"
                >
                  从设备选择文件
                </label>
              </div>
            )}
          </div>

          {/* Quick Preset Selector for Easy Demo */}
          <div className="mt-3 bg-[#FFF9F3] border border-[#F5E6D8] rounded-xl p-3">
            <span className="text-[11px] font-bold text-[#8C7A6B] flex items-center gap-1 mb-2">
              <Sparkles className="w-3 h-3 text-[#FF7E67]" />
              手头暂时没有素材？先用内置示例走一遍流程：
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_SAMPLES.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(sample)}
                  className="px-2.5 py-1 text-xs bg-white hover:bg-[#FFEAE0] text-[#635346] hover:text-[#C4432E] border border-[#E8DACB] rounded-lg transition-all"
                >
                  {sample.type === 'video' ? '🎥 ' : '📷 '}
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isTextMode && (
          <div className="bg-[#FFF9F3] border border-[#F5E6D8] rounded-2xl p-4 text-xs text-[#78695C] leading-relaxed">
            <span className="font-bold text-[#574B40]">今天先写一句话，也算一次记录。</span>
            标题写「今天练了什么」，想到什么就写什么；以后想补视频，随时可以再传一条。
          </div>
        )}

        {/* 2. Title & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1.5">
              {isTextMode ? '2. 今天练了什么 *' : '2. 作品标题 *'}
            </label>
            <input
              type="text"
              required
              placeholder={
                isTextMode
                  ? '例如：今天练了 40 分钟胸腔隔离，终于能连着做完 8 个八拍'
                  : '例如：第一次完整跳完一支 Jazz、周二胸腔隔离练习'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#E3D4C5] focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/50 bg-[#FFFDF9]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#8C7A6B]" />
              <span>练习日期 *</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-[#E3D4C5] focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/50 bg-[#FFFDF9]"
            />
          </div>
        </div>

        {/* 3. Stage & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Stage */}
          <div>
            <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-2">
              3. 所处阶段 *
            </label>
            <div className="flex gap-2">
              {(['入门', '进阶', '挑战'] as DanceStage[]).map((stg) => (
                <button
                  key={stg}
                  type="button"
                  onClick={() => setStage(stg)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    stage === stg
                      ? 'bg-[#FF7E67] text-white border-[#E65B47] shadow-sm'
                      : 'bg-[#FAF2E9] text-[#78695C] border-[#E8DACB] hover:bg-[#F3E5D7]'
                  }`}
                >
                  {stg === '入门' ? '🌱 入门' : stg === '进阶' ? '🌿 进阶' : '🔥 挑战'}
                </button>
              ))}
            </div>
          </div>

          {/* Categories (Multi-select) */}
          <div>
            <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-2">
              4. 舞种分类 (多选) *
            </label>
            <div className="flex flex-wrap gap-1.5">
              {allCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-[#E67E22] text-white shadow-2xs'
                        : 'bg-[#FAF2E9] text-[#78695C] border border-[#E8DACB] hover:bg-[#F3E5D7]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 4. Music & BPM (Optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#FFFBF7] p-3.5 rounded-2xl border border-[#F1E5D8]">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#66564A] mb-1 flex items-center gap-1">
              <Music className="w-3 h-3 text-[#FF7E67]" />
              <span>伴奏曲目 (选填)</span>
            </label>
            <input
              type="text"
              placeholder="如：Feeling Good - Nina Simone"
              value={musicName}
              onChange={(e) => setMusicName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF7E67]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#66564A] mb-1">节奏速度 (BPM)</label>
            <input
              type="number"
              min="50"
              max="180"
              placeholder="92"
              value={bpm || ''}
              onChange={(e) => setBpm(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-[#E3D4C5] bg-white focus:outline-none focus:ring-1 focus:ring-[#FF7E67]"
            />
          </div>
        </div>

        {/* 5. Notes & Reflection */}
        <div>
          <label className="block text-xs font-bold text-[#574B40] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <span>5. 练舞小记 & 避坑心得</span>
          </label>
          <textarea
            rows={4}
            placeholder="今天学会了哪个动作？哪个拍子卡准了？下半身力量还是胸部Roll遇到了瓶颈？真实记录每一次微小的改变～"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full text-xs sm:text-sm p-3.5 rounded-2xl border border-[#E3D4C5] focus:outline-none focus:ring-2 focus:ring-[#FF7E67]/50 bg-[#FFFDF9] leading-relaxed"
          />
        </div>

        {/* Submit and Cancel Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1E5D8]">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-[#DED0C1] text-xs font-semibold text-[#6B5A4D] hover:bg-[#F7EFE7] transition-all cursor-pointer"
          >
            取消
          </button>

          <button
            type="submit"
            disabled={busy}
            className="px-6 py-2.5 bg-[#FF7E67] hover:bg-[#E65B47] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isTextMode ? '保存这条记录' : '保存到成长日记'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
