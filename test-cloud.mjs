// 云端连通性测试：匿名读取 forum_threads（验证 endpoint/公钥/RLS 公开读策略）
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';

const cloud = createWorkBuddyCloud({
  endpoint: 'https://cici-dance-diary.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_x7egMd8He1j7Ebb2DgCHnA_eIFEB0FA2iTx90ncKbBKX2m1iwuY0Bw8',
});

console.log('--- 1. 匿名读取 forum_threads ---');
const threads = await cloud.database.from('forum_threads').select('*').limit(5);
console.log('error:', threads.error);
console.log('rows:', threads.data?.length ?? 0);

console.log('--- 2. 匿名读取 forum_replies ---');
const replies = await cloud.database.from('forum_replies').select('*').limit(5);
console.log('error:', replies.error);
console.log('rows:', replies.data?.length ?? 0);

console.log('--- 3. 匿名读取 forum_interactions ---');
const ints = await cloud.database.from('forum_interactions').select('*').limit(5);
console.log('error:', ints.error);
console.log('rows:', ints.data?.length ?? 0);

console.log('--- 4. 匿名写入应被 RLS 拒绝 ---');
const denied = await cloud.database.from('forum_threads').insert({ title: 'RLS test' }).select();
console.log('写入被拒绝?', !!denied.error, denied.error?.code || denied.error?.message);
