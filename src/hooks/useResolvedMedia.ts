import { useEffect, useState } from 'react';
import { isLocalMedia, resolveMediaUrl } from '../utils/mediaStore';

export interface ResolvedMedia {
  /** 可直接放进 <video src> / <img src> 的地址；null 表示引用失效 */
  url: string | null;
  loading: boolean;
  /** 本地视频 Blob 不在本设备（换设备同步过来的帖子） */
  missing: boolean;
}

/**
 * 把帖子里的 mediaUrl 解析成可播放地址。
 * 本地视频是异步从 IndexedDB 读 Blob 再生成 objectURL，所以组件必须走这个 hook。
 */
export function useResolvedMedia(src?: string | null): ResolvedMedia {
  const [state, setState] = useState<ResolvedMedia>(() => ({
    url: isLocalMedia(src) ? null : src || null,
    loading: isLocalMedia(src),
    missing: false,
  }));

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setState({ url: null, loading: false, missing: false });
      return;
    }
    setState({ url: isLocalMedia(src) ? null : src, loading: isLocalMedia(src), missing: false });

    resolveMediaUrl(src).then((url) => {
      if (cancelled) return;
      setState({ url, loading: false, missing: isLocalMedia(src) && !url });
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return state;
}
