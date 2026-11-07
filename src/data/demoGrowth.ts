/**
 * 成长报告示例数据（仅内存预览，不写入 IndexedDB / localStorage）
 * 用于空状态或对外演示时展示报告的真实样子。
 */
import type { JazzSkill, SkillCheckIn } from '../types/skill';
import { DEFAULT_JAZZ_SKILLS } from '../utils/skillData';

const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (offsetFromToday: number, today = new Date()): string => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(date.getTime() - offsetFromToday * DAY_MS);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
    target.getDate()
  ).padStart(2, '0')}`;
};

/** 生成一份"练了约 10 周"的示例打卡记录 */
export function buildDemoCheckIns(skills: JazzSkill[] = DEFAULT_JAZZ_SKILLS): SkillCheckIn[] {
  // 已掌握动作：入门层全部 + 部分 2/3 星
  const masteredIds = skills
    .filter((skill) => skill.difficulty === 1)
    .map((skill) => skill.id)
    .concat(
      skills
        .filter((skill) => skill.difficulty === 2)
        .slice(0, 5)
        .map((skill) => skill.id),
      skills
        .filter((skill) => skill.difficulty === 3)
        .slice(0, 2)
        .map((skill) => skill.id)
    );

  const records: SkillCheckIn[] = [];

  // 掌握记录：均匀铺在最近 68 天里，形成一条爬升曲线
  masteredIds.forEach((skillId, index) => {
    const offset = Math.max(1, 68 - Math.round((index / Math.max(1, masteredIds.length - 1)) * 62));
    records.push({
      id: `demo-mastered-${skillId}`,
      skillId,
      date: dayKey(offset),
      status: 'mastered',
    });
  });

  // 练习记录：近 5 周几乎每天一次，制造连续打卡与热力图
  const practicePool = skills.slice(0, 24).map((skill) => skill.id);
  for (let offset = 0; offset < 40; offset += 1) {
    if (offset % 9 === 4) continue; // 留出几处断档，让连续天数看起来真实
    const skillId = practicePool[(offset * 5) % practicePool.length];
    records.push({
      id: `demo-practice-${offset}`,
      skillId,
      date: dayKey(offset),
      status: 'practicing',
    });
  }

  return records;
}

export const DEMO_SKILLS: JazzSkill[] = DEFAULT_JAZZ_SKILLS;
