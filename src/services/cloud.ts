/**
 * WorkBuddy 云服务客户端（全应用唯一实例）
 * 数据面基地址与公钥来自云服务的 publicConfig，可随前端代码分发。
 * publishableKey 本身不携带任何权限，服务端按 Origin 精确匹配校验。
 */
import { createWorkBuddyCloud } from '@tencent-ai/workbuddy-cloud-sdk';

const publicConfig = {
  endpoint: 'https://cici-dance-diary.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_x7egMd8He1j7Ebb2DgCHnA_eIFEB0FA2iTx90ncKbBKX2m1iwuY0Bw8',
};

export const cloud = createWorkBuddyCloud(publicConfig);

/** 当前登录用户（在云端身份体系里的最小画像） */
export interface CloudUser {
  id: string;
  name: string;
}
