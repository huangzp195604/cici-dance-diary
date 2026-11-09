# 演示数据清理备份说明

清理时间：2026-11-06
清理原因：舞友论坛内容、真实舞友管理数据、舞伴名册中的内容均为内置演示数据，并非用户真实记录。本次清理后，相关模块从空状态开始，全部数据由用户自行新增、编辑、删除，并持久化到本地。

## 一、清空的数据结构

### 1. 舞友论坛帖子（ForumThread）

- 数量：4 条（ID：`thread-1` ~ `thread-4`）
- 关联回复：6 条（`rep-1` ~ `rep-6`）
- 字段：`id`、`title`、`content`、`category`、`author`、`authorRole`、`avatarBg`、`createdAt`、`likes`、`isLiked`、`views`、`replies`（回复数组）、`meetup`（约练信息：`studio`、`date`、`targetCount`、`joinedBuddies`、`isJoined`、`costNote`）、`isPinned`、`tags`
- 涉及演示作者：小桃_JazzChore、Kiki_慢热萌新、阿澈_Groove、Cici、米娅_韩舞控、Leo_转圈苦练中
- 涉及演示约练活动：`thread-1`（静安星光 2 号教室，joinedBuddies：小桃_JazzChore、Cici）、`thread-2`（胸部 Roll 求助帖）

### 2. 真实舞友管理数据（RealFriend）

- 数量：4 条（ID：`friend-1` ~ `friend-4`）
- 演示对象：小桃 (静安星光)、阿澈 (徐汇Vibe)、米娅 (韩舞翻跳)、婷婷 (同班闺蜜)
- 字段：`id`、`name`、`contact`（微信号/联系方式）、`studio`、`danceStyle`、`notes`、`avatarBg`、`status`（在线 / 练舞中 / 空闲）、`recentTopic`

### 3. 舞伴名册（DanceBuddy）

- 数量：5 条（ID：`buddy-1` ~ `buddy-5`）
- 演示对象：小桃_JazzChore、阿澈_Groove、米娅_韩舞控、Kiki_慢热萌新、Leo_转圈苦练中
- 字段：`id`、`name`、`avatarBg`、`initials`、`style`、`stage`（入门 / 进阶 / 挑战）、`bio`、`studio`、`frequency`、`followersCount`、`isFollowed`、`currentPractice`、`recentTrack`

### 4. 舞友墙留言（WallMessage，论坛历史数据）

- 数量：4 条（ID：`msg-1` ~ `msg-4`）
- 关联回复：4 条（`r-1` ~ `r-4`）
- 字段：`id`、`author`、`avatarBg`、`type`（约练 / 打气 / 找队友 / 动作拆解 / 随笔）、`content`、`studioLocation`、`createdAt`、`likes`、`isLiked`、`replies`

### 5. 舞蹈作品（DancePost，此前已清理）

- 数量：6 条（ID：`post-1` ~ `post-6`）
- 状态：上一轮已从展示区清空，数组保留为 `LEGACY_DEMO_POSTS`，仅用于识别并清理旧版本落库数据。

## 二、清理的存储位置

- IndexedDB：数据库 `cici_dance_diary_db`（v2）
  - `posts`：作品
  - `buddies`：舞伴名册
  - `messages`：舞友墙留言
  - `threads`：论坛帖子
  - `real_friends`：真实舞友
- localStorage 兜底键：
  - `cici_posts`、`cici_buddies`、`cici_messages`、`cici_threads`、`cici_real_friends`

## 三、原始数据备份位置

原始演示数组未删除，全部保留在 `src/data/initialData.ts`，并重命名为 `LEGACY_DEMO_*`：

- `LEGACY_DEMO_POSTS`
- `LEGACY_DEMO_BUDDIES`
- `LEGACY_DEMO_MESSAGES`
- `LEGACY_DEMO_THREADS`
- `LEGACY_DEMO_REAL_FRIENDS`

这些常量仅用于在读取旧数据时按 ID 识别并物理删除演示记录，不再作为页面初始内容写入任何存储。

## 四、清理后的行为约定

1. 应用启动时，四类数据（论坛帖、真实舞友、舞伴名册、舞友留言）默认为空。
2. 读取 IndexedDB / localStorage 时会过滤并删除上述演示 ID，避免旧缓存重新出现。
3. “重置数据”只清空本地数据，不再恢复演示数据。
4. 用户新增/编辑/删除的数据会即时写入 IndexedDB（失败时回退 localStorage），并同步更新界面。

## 五、回滚方式

如需临时恢复演示内容用于演示或对照，可从 `src/data/initialData.ts` 中的 `LEGACY_DEMO_*` 数组手动导入，但请仅限本地调试使用，避免再次污染真实数据。
