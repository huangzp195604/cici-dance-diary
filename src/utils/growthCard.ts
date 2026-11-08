/**
 * 成长报告分享卡：把派生统计数据画成一张可保存的 PNG
 * 纯前端 Canvas，无第三方依赖，也不上传任何数据。
 */
import type { GrowthStats } from './skillData';

const W = 900;
const H = 1280;
const FONT_STACK = '"PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const drawStat = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  value: string,
  unit: string,
  label: string
) => {
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, x, y, w, 132, 24);
  ctx.fill();
  ctx.strokeStyle = '#F3E4D6';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#292524';
  ctx.font = `bold 54px ${FONT_STACK}`;
  ctx.fillText(value, x + w / 2, y + 66);

  const valueWidth = ctx.measureText(value).width;
  ctx.fillStyle = '#B45309';
  ctx.font = `600 22px ${FONT_STACK}`;
  ctx.fillText(unit, x + w / 2 + valueWidth / 2 + 14, y + 66);

  ctx.fillStyle = '#8C7A6B';
  ctx.font = `500 22px ${FONT_STACK}`;
  ctx.fillText(label, x + w / 2, y + 106);
};

export async function downloadGrowthCard(
  stats: GrowthStats,
  options: { name?: string } = {}
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持 Canvas');

  // 背景
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#FFFDF9');
  bg.addColorStop(0.55, '#FFF7EF');
  bg.addColorStop(1, '#FFEFE4');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 装饰圆
  ctx.fillStyle = 'rgba(255, 107, 107, 0.08)';
  ctx.beginPath();
  ctx.arc(W - 60, 90, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(139, 92, 246, 0.07)';
  ctx.beginPath();
  ctx.arc(90, H - 120, 220, 0, Math.PI * 2);
  ctx.fill();

  // 顶部标签
  ctx.textAlign = 'left';
  ctx.fillStyle = '#B45309';
  ctx.font = `700 24px ${FONT_STACK}`;
  ctx.fillText('GROWTH REPORT', 64, 96);

  ctx.fillStyle = '#292524';
  ctx.font = `bold 62px ${FONT_STACK}`;
  ctx.fillText('我的舞蹈成长报告', 64, 178);

  ctx.fillStyle = '#8C7A6B';
  ctx.font = `500 26px ${FONT_STACK}`;
  const nameText = options.name ? `${options.name} · 舞迹记录` : '舞迹记录';
  ctx.fillText(`${nameText} · ${stats.firstPracticeDate ?? '—'} 起`, 64, 222);

  // 舞龄主视觉
  ctx.fillStyle = '#FF6B6B';
  ctx.font = `bold 148px ${FONT_STACK}`;
  const ageText = String(stats.practiceAgeDays);
  ctx.fillText(ageText, 64, 400);
  const ageWidth = ctx.measureText(ageText).width;
  ctx.fillStyle = '#8C7A6B';
  ctx.font = `600 34px ${FONT_STACK}`;
  ctx.fillText('天舞龄', 64 + ageWidth + 18, 398);

  // 四宫格统计
  const cardW = 366;
  drawStat(ctx, 64, 460, cardW, String(stats.masteredCount), `/ ${stats.totalSkillCount}`, '已掌握动作');
  drawStat(ctx, 470, 460, cardW, String(stats.practiceDayCount), '天', '累计练习天数');
  drawStat(ctx, 64, 616, cardW, String(stats.totalCheckIns), '次', '累计打卡次数');
  drawStat(ctx, 470, 616, cardW, String(stats.currentStreak), '天', '当前连续打卡');

  // 分类进度条（取掌握数最高的 5 类）
  ctx.textAlign = 'left';
  ctx.fillStyle = '#292524';
  ctx.font = `bold 34px ${FONT_STACK}`;
  ctx.fillText('技能分布', 64, 830);

  const top = [...stats.categoryProgress]
    .filter((item) => item.total > 0)
    .sort((a, b) => b.mastered - a.mastered || b.ratio - a.ratio)
    .slice(0, 5);

  top.forEach((item, index) => {
    const y = 878 + index * 62;
    ctx.fillStyle = '#78695C';
    ctx.font = `600 24px ${FONT_STACK}`;
    ctx.fillText(item.category, 64, y + 10);

    const barX = 264;
    const barW = 470;
    ctx.fillStyle = '#F5E7DA';
    roundRect(ctx, barX, y - 12, barW, 22, 11);
    ctx.fill();

    if (item.ratio > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      gradient.addColorStop(0, '#FF9A7B');
      gradient.addColorStop(1, '#FF6B6B');
      ctx.fillStyle = gradient;
      roundRect(ctx, barX, y - 12, Math.max(22, barW * item.ratio), 22, 11);
      ctx.fill();
    }

    ctx.fillStyle = '#A8988A';
    ctx.font = `600 22px ${FONT_STACK}`;
    ctx.fillText(`${item.mastered}/${item.total}`, barX + barW + 18, y + 6);
  });

  // 成就进度
  const unlocked = stats.milestones.filter((m) => m.unlocked).length;
  ctx.fillStyle = '#292524';
  ctx.font = `bold 34px ${FONT_STACK}`;
  ctx.fillText('成就徽章', 64, 1160);

  ctx.fillStyle = '#B45309';
  ctx.font = `bold 40px ${FONT_STACK}`;
  ctx.fillText(`${unlocked}`, 64, 1214);
  const unlockedWidth = ctx.measureText(`${unlocked}`).width;
  ctx.fillStyle = '#8C7A6B';
  ctx.font = `500 26px ${FONT_STACK}`;
  ctx.fillText(`/ ${stats.milestones.length} 枚已点亮`, 64 + unlockedWidth + 10, 1212);

  // 页脚
  ctx.fillStyle = '#C4B2A3';
  ctx.font = `500 22px ${FONT_STACK}`;
  ctx.fillText('舞蹈成长日记 · 每一次练习都算数', 64, H - 48);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('图片生成失败');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cici-growth-${stats.lastPracticeDate ?? 'report'}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
