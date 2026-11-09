# 工程护栏与组件边界

## 为什么不用 ESLint

项目里 `typescript` 是 7.x（原生版本），已经移除了 `createSourceFile` 这类编译器 API。
`typescript-eslint` 的 peer 依赖写死 `<6.1.0`，装上直接 `ERESOLVE` 失败；强行 `--legacy-peer-deps`
也会在解析阶段崩掉。所以 lint 走 Rust 实现的 **oxlint**：不依赖 TS 编译器、能解析 TSX，
扫 60+ 个文件约 200ms。

```bash
npm run lint        # tsc --noEmit && oxlint src
npm run lint:js     # 只跑 oxlint
npm run format      # prettier --write .
npm run verify      # lint + format:check + build:cloud（CI 用的就是这套）
```

### 规则取舍

`.oxlintrc.json` 里只把**会真出线上事故**的规则设为 error：

| 规则                                                  | 级别  | 原因                                                       |
| ----------------------------------------------------- | ----- | ---------------------------------------------------------- |
| `react/rules-of-hooks`                                | error | Hook 顺序错会直接白屏                                      |
| `correctness` 分类                                    | error | 常量断言、自比较等确定性 bug                               |
| `no-unused-vars`                                      | warn  | 目前 80 条，其中几条是真问题（如循环播放开关未接），逐步清 |
| `react/set-state-in-effect`、`purity`、`immutability` | warn  | React Compiler 的实验规则，命中大量既有写法，先当提示      |

## CI

`.github/workflows/ci.yml` 监听 `cloud-snapshot` 与 `main`，以及所有 PR。
在此之前唯一的 workflow 只监听 `push main`，而留痕分支是 `cloud-snapshot`——
等于每次推送都没有任何检查。

## 组件拆分进度

`Timeline.tsx` 曾经 2910 行，上传、播放、编辑、日历、图表混在一个组件里，
改一处容易碰坏另一处（`notes` 字段缺失导致白屏那次就是这种耦合的后果）。

已抽出（各自持有自己的状态，父组件只保留数据与持久化）：

| 文件                    | 职责                     | 行数 |
| ----------------------- | ------------------------ | ---- |
| `StartDateModal.tsx`    | 起步日历、预设、清除确认 | 475  |
| `StyleManagerModal.tsx` | 舞种新增 / 筛选 / 删除   | 585  |

拆分后 `Timeline.tsx` 约 2150 行。

### 下一批（按收益排序）

1. **`TimelinePostCard`**：作品卡片 + 评论线程，约 250 行渲染，是列表里复制粘贴最多的一段。
2. **`DanceBuddies` 的发帖弹窗**：`isNewThreadOpen` 那套表单状态（标题、分类、约练字段、
   群入口、校验错误）本身就是一组独立状态，抽出后约 −230 行。
3. **`DanceBuddies` 的帖子卡片**：约 550 行，是论坛列表的主渲染体，抽出的收益最大，
   但依赖父级的展开态、回复草稿、举报弹窗状态，需要先收成一个 `ThreadCardProps` 包。

拆分原则：**只搬状态，不改行为**。每拆一块跑一次 `tsc`，再用无头浏览器点一遍该模块的
真实入口（打开 → 操作 → 关闭），确认可见行为一致后才继续下一块。

## 论坛分页

`fetchForumPage(user, { offset, limit })` 先按 20 条取帖子，再用
`.in('thread_id', ids)` 只取这一页的回帖与互动。此前是整表拉
（帖子 100 / 回帖 500 / 互动 1000），帖子一多，移动端就要渲染上千个节点。
`fetchForum` 保留为「只取第一页」的兼容包装。

## 视频「仅存本机」的补救路径

结构化的标题、心得、日期、封面（canvas 抽帧转 base64）本来就会上云，
换设备后缺的只有视频本体。缺片界面上现在给一个「从这台设备重新选这支视频」，
选中后只替换 `mediaUrl` 引用，记录本身不动——比让用户重新发一条合理。
