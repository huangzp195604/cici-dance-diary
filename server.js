// 云端发布用静态服务器：托管 dist/（vite 云端构建产物），监听 $PORT
// 沙箱只暴露一个 HTTP 端口，此文件不引入任何数据库/外部服务依赖
import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, 'dist');
const app = express();

app.use(express.static(dist));
// SPA 回退：任何未命中静态文件的路径都返回 index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`cici-dance-diary serving dist/ on port ${port}`);
});
