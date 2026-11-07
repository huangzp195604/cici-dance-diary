/** 爵士舞技能树数据模型（页面与统计层共用的单一事实来源） */

export type SkillCategory =
  | '基础律动'
  | '隔离控制'
  | '身体开发'
  | '脚步与重心'
  | '旋转技巧'
  | '高跟 Jazz'
  | '地面技巧'
  | '音乐性'
  | '表现力'
  | '编舞与创作';

export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface JazzSkill {
  id: string;
  name: string;
  category: SkillCategory;
  difficulty: SkillLevel;
  description: string;
  isCustom?: boolean;
}

export type CheckInStatus = 'practicing' | 'mastered';

export interface SkillCheckIn {
  id: string;
  skillId: string;
  date: string; // YYYY-MM-DD
  status: CheckInStatus;
}

export type SkillStateStatus = 'locked' | 'available' | 'practicing' | 'mastered';

export interface SkillWithState {
  skill: JazzSkill;
  status: SkillStateStatus;
  locked: boolean;
  records: SkillCheckIn[];
}
