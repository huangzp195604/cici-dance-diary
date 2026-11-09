/**
 * ProfileModal —— 个人资料：昵称 / 性别 / 年龄
 *
 * 昵称是论坛里唯一能被别人看到的名字，因此必填；
 * 性别与年龄选填，填了会显示在帖子与评论的作者信息旁。
 */
import React, { useEffect, useState } from 'react';
import { X, UserRound, Loader2, Check } from 'lucide-react';
import type { Gender, UserProfile } from '../types';
import { saveProfile } from '../services/userDataApi';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initial: UserProfile | null;
  /** 未设置昵称时强制填写，不允许直接关闭 */
  required?: boolean;
  onSaved: (profile: UserProfile) => void;
}

const NICKNAME_MAX = 12;

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  initial,
  required = false,
  onSaved,
}) => {
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNickname(initial?.nickname ?? '');
    setGender(initial?.gender ?? null);
    setAge(initial?.age ? String(initial.age) : '');
    setError('');
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const name = nickname.trim();
    if (!name) {
      setError('请填写昵称，舞友们才知道怎么称呼你');
      return;
    }
    if (name.length > NICKNAME_MAX) {
      setError(`昵称不超过 ${NICKNAME_MAX} 个字`);
      return;
    }

    let ageNum: number | null = null;
    if (age.trim()) {
      ageNum = Number(age);
      if (!Number.isFinite(ageNum) || ageNum < 10 || ageNum > 80) {
        setError('年龄请填写 10-80 之间的数字');
        return;
      }
    }

    setSaving(true);
    try {
      await saveProfile(userId, { nickname: name, gender, age: ageNum });
      onSaved({
        user_id: userId,
        nickname: name,
        gender,
        age: ageNum,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => {
        if (!required) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-[#FFFDF9] border border-[#F1E5D8] shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {!required && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-[#EDE9FE] text-[#7C3AED] flex items-center justify-center">
            <UserRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg text-[#292524]">
              {required ? '先给自己起个名字吧' : '我的资料'}
            </h3>
            <p className="text-xs text-[#8C7A6B]">
              {required ? '昵称会显示在你的帖子与评论里' : '昵称公开可见，性别年龄可选填'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#574B40] mb-1.5">
              昵称 <span className="text-[#E65B47]">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              maxLength={NICKNAME_MAX}
              onChange={(e) => {
                setNickname(e.target.value);
                setError('');
              }}
              placeholder="如：小鹿 / 阿棠 / 小满"
              className="w-full px-4 py-3 rounded-2xl border border-[#E8DACB] bg-white text-sm text-[#292524] placeholder-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]/40 transition-all"
            />
            <p className="mt-1 text-[10px] text-[#A8988A]">
              {nickname.length}/{NICKNAME_MAX} 字
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#574B40] mb-1.5">性别（选填）</label>
            <div className="grid grid-cols-2 gap-2">
              {(['女', '男'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(gender === g ? null : g)}
                  className={`py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    gender === g
                      ? 'bg-[#7C3AED] text-white border-[#6D28D9] shadow-2xs'
                      : 'bg-[#FAF2EB] text-[#736357] border-[#E8DACB] hover:bg-[#F3E5D7]'
                  }`}
                >
                  {gender === g && <Check className="w-3 h-3" />}
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#574B40] mb-1.5">年龄（选填）</label>
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={80}
              value={age}
              onChange={(e) => {
                setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 2));
                setError('');
              }}
              placeholder="如：24"
              className="w-full px-4 py-3 rounded-2xl border border-[#E8DACB] bg-white text-sm text-[#292524] placeholder-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED]/40 transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-[#D94834] bg-[#FFF1EC] border border-[#FFD5C8] rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white text-sm font-bold shadow-lg shadow-[#7C3AED]/20 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 保存中…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" /> 保存资料
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-[10px] text-[#A8988A] text-center leading-relaxed">
          资料会同步到云端，换设备登录同一手机号即可看到
        </p>
      </div>
    </div>
  );
};
