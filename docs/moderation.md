# 内容治理后台（举报 / 反馈处理）

## 入口

登录管理员账号 → 页面底部页脚 → **处理队列**（仅管理员账号可见，其他账号不渲染这个入口）。

## 权限模型

权限在数据库层，前端只负责显示：

| 表                | 普通登录用户                                   | 管理员                  |
| ----------------- | ---------------------------------------------- | ----------------------- |
| `content_reports` | 只能读自己提交的；只能新增                     | 可读全部；可改 `status` |
| `app_admins`      | 只能读自己那一行（用来判断「我是不是管理员」） | 同左                    |
| 游客（anon）      | 无任何权限（已收回 SELECT）                    | —                       |

实现的策略：

- `content_reports_read_own` / `content_reports_insert_own`（原有）
- `content_reports_read_admin`、`content_reports_update_admin`（新增，`EXISTS (SELECT 1 FROM app_admins WHERE user_id = auth.uid())`）
- `app_admins_read_self`（`user_id = auth.uid()`）

表级权限收紧为 `SELECT, INSERT, UPDATE`，并收回了 anon 的 SELECT —— 举报数据不该被未登录请求碰到。

## 处理流程

1. 打开「处理队列」，默认只看 `open`。
2. 判断内容：需要删除的，去对应帖子 / 回复 / 私信上删除（后台只管记录状态，不代替内容操作）。
3. 点「已处理」或「判定不违规」，状态写入 `status`。
4. 涉及诈骗、骚扰、色情的，先删除内容再标记，必要时限制账号。

目标是在 24 小时内把 `open` 清零 —— 这是举报弹窗里对用户的承诺。

## 新增管理员

```sql
INSERT INTO app_admins (user_id, note) VALUES ('<用户 uid>', '<备注>')
  ON CONFLICT (user_id) DO NOTHING;
```

uid 从 `profiles.user_id` 取（按昵称对上人）。移除管理员就是删这一行，无需改代码或重新部署。

## SQL 兜底（后台打不开时）

```sql
-- 待处理队列
SELECT id, target_type, reason, detail, owner_name, created_at
FROM content_reports WHERE status = 'open' ORDER BY created_at DESC;

-- 处理
UPDATE content_reports SET status = 'resolved' WHERE id = <id>;
```

## 意见与数据请求

「关于我 → 意见与请求」（页脚「意见与反馈」）也落同一张表，`target_type = 'feedback'`，
`target_excerpt` 存类型（功能建议 / 数据问题 / 删除我的账号数据 / 其他），`detail` 存正文。
后台里以紫色「意见 / 请求」标签区分。

删除账号数据的请求要额外做三件事：导出或确认无需保留、删除 `user_data` / `profiles` /
`forum_*` / `social_*` 中该 uid 的记录、把这条记录标记为 `resolved` 并回复用户。
