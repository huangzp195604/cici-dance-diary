// 云端发布用静态服务器：托管 dist/（vite 云端构建产物），监听 $PORT
// 沙箱只暴露一个 HTTP 端口，此文件不引入任何数据库/外部服务依赖
//
// 2026-11 性能修正：
// 1) 之前 express.static 裸传，1.19MB 的 JS 不压缩就发给手机——现在走 gzip，
//    实测可降到 331KB（-72%），弱网首屏省 1~2 秒。
// 2) 带 hash 的 assets 之前是 max-age=0，每次回访都要协商；现在设为一年 immutable，
//    回访直接命中本地缓存。index.html 必须保持 no-cache，否则发版后用户拿不到新页面。
import compression from 'compression';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const app = express();

// 不暴露 Express 指纹
app.disable('x-powered-by');

// gzip 压缩（客户端支持 br 时由网关处理，这里保证至少 gzip 生效）
app.use(
  compression({
    threshold: 1024,
    // 已经是压缩格式的（图片/视频）不再压，省 CPU
    filter: (req, res) => {
      const type = String(res.getHeader('Content-Type') || '');
      if (/^(image|video|audio)\//.test(type)) return false;
      return compression.filter(req, res);
    },
  })
);

// 构建产物带 content hash，可以放心长缓存
app.use(
  '/assets',
  express.static(path.join(dist, 'assets'), {
    maxAge: '1y',
    immutable: true,
    index: false,
    fallthrough: true,
  })
);

// 其余静态资源（og-cover、samples 等）短缓存；HTML 一律协商，保证发版即时生效
app.use(
  express.static(dist, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// SPA 回退：任何未命中静态文件的路径都返回 index.html
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`cici-dance-diary serving dist/ on port ${port}`);
});
