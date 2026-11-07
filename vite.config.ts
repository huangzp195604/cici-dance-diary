import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // 双部署目标：GitHub Pages 走子路径，WorkBuddy 云端域名走根路径
    // 云端构建：DEPLOY_TARGET=cloud vite build
    base: process.env.DEPLOY_TARGET === 'cloud' ? '/' : '/cici-dance-diary/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 端口/host 统一在这里管：dev 脚本不再写死，预览面板注入 PORT 时能自动跟随
      // （as const 保持字面量 true，满足 vite 8 的类型约束）
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
  };
});
