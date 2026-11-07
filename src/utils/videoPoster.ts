/**
 * 视频封面与兼容性检测
 *
 * 顺手做三件事：
 * 1. 抓一帧画面当封面（列表卡片用 <img> 显示，不能拿视频地址当图片 src）
 * 2. 探测浏览器能否解码该视频（iPhone 拍的 HEVC/MOV 在很多浏览器上放不了）
 * 3. 读取真实时长，替换原来写死的 00:15
 */
export interface VideoProbeResult {
  /** 压缩后的 JPEG dataURL；抓取失败时为 null */
  poster: string | null;
  /** 浏览器能否解码（false 时前端应给出格式提示，而不是让用户对着黑屏） */
  playable: boolean;
  /** 秒数；无法读取时为 null */
  duration: number | null;
}

export function formatDuration(seconds: number | null): string | undefined {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function probeVideo(file: Blob): Promise<VideoProbeResult> {
  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    let loaded = false;
    let loadedDuration: number | null = null;
    let seekFallback: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: VideoProbeResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (seekFallback) clearTimeout(seekFallback);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(tempUrl);
      resolve(result);
    };

    // 超时不能一律判定「不可播」：只要已经加载出画面，就说明浏览器能解码，
    // 只是抓封面帧失败而已（iOS Safari 上 seek 事件偶尔不触发）。
    const timer = setTimeout(
      () => finish({ poster: null, playable: loaded, duration: loadedDuration }),
      10000
    );

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = tempUrl;

    video.onerror = () => finish({ poster: null, playable: false, duration: null });

    video.onloadeddata = () => {
      loaded = true;
      const duration = Number.isFinite(video.duration) ? video.duration : null;
      loadedDuration = duration;
      // seek 未回触发时兜底抓当前帧，避免干等 10 秒
      seekFallback = setTimeout(
        () => drawFrame(duration),
        1200
      );
      // 跳到 0.1 秒（或片中）再抓帧，避开全黑的第一帧
      try {
        video.currentTime = Math.min(0.1, duration ? duration / 2 : 0.1);
      } catch {
        // 某些流无法 seek，直接用当前帧
        drawFrame(duration);
      }
    };

    video.onseeked = () => {
      if (seekFallback) clearTimeout(seekFallback);
      drawFrame(loadedDuration ?? (Number.isFinite(video.duration) ? video.duration : null));
    };

    const drawFrame = (duration: number | null) => {
      try {
        if (!video.videoWidth || !video.videoHeight) {
          finish({ poster: null, playable: true, duration });
          return;
        }
        const maxW = 640;
        const scale = Math.min(1, maxW / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish({ poster: null, playable: true, duration });
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish({ poster: canvas.toDataURL('image/jpeg', 0.72), playable: true, duration });
      } catch {
        finish({ poster: null, playable: true, duration });
      }
    };
  });
}
