import React, { useState } from 'react';
import { Play, Square, Sliders, Music, Volume2 } from 'lucide-react';
import { metronomeInstance } from '../utils/audio';

interface GrooveMetronomeProps {
  isOpen: boolean;
  onClose: () => void;
  currentBeat: number;
  bpm: number;
  setBpm: (bpm: number) => void;
  isRunning: boolean;
  onToggle: () => void;
}

export const GrooveMetronome: React.FC<GrooveMetronomeProps> = ({
  isOpen,
  onClose,
  currentBeat,
  bpm,
  setBpm,
  isRunning,
  onToggle,
}) => {
  // 音量存在 audio 单例里（并写 localStorage），这里只是它的受控视图。
  // hooks 必须在 `if (!isOpen) return null` 之前调用，否则打开/收起时 hook 数量变化会报错。
  const [volume, setVolume] = useState<number>(() => Math.round(metronomeInstance.getVolume() * 100));

  if (!isOpen) return null;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    metronomeInstance.setVolume(val / 100);
  };

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setBpm(val);
    metronomeInstance.setTempo(val);
  };

  return (
    <div className="bg-[#FFF4EC] border-b border-[#F7DFC8] px-4 py-3 shadow-inner transition-all">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Info */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FFE0D1] flex items-center justify-center text-[#E65B47]">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-[#3D3126]">8-Count 练舞节拍器</span>
            <span className="text-[#8C7A6B] ml-2 text-xs hidden sm:inline">
              (第 1 与 第 5 拍带切分重音提醒，适合打点卡拍)
            </span>
          </div>
        </div>

        {/* Center: 8-count visual dots */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => {
            const isActive = currentBeat === count;
            const isAccent = count === 1 || count === 5;
            return (
              <div
                key={count}
                className={`w-7 h-8 sm:w-8 sm:h-9 rounded-lg flex flex-col items-center justify-center font-mono font-bold transition-all ${
                  isActive
                    ? isAccent
                      ? 'bg-[#FF6B6B] text-white scale-110 shadow-md ring-2 ring-[#FF6B6B]/40'
                      : 'bg-[#FF9F43] text-white scale-105 shadow-sm'
                    : isAccent
                      ? 'bg-[#FFE2D4] text-[#A64B2A] border border-[#F5C7B5]'
                      : 'bg-white/80 text-[#8C7A6B] border border-[#EADBCE]'
                }`}
              >
                <span className="text-xs sm:text-sm">{count}</span>
                {isAccent && (
                  <span className={`text-[8px] font-normal leading-none ${isActive ? 'text-white' : 'text-[#C05621]'}`}>
                    重
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Controls & BPM */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-[#E7D6C5]">
            <Sliders className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <input
              type="range"
              min="65"
              max="140"
              value={bpm}
              onChange={handleBpmChange}
              className="w-16 sm:w-20 accent-[#FF6B6B] cursor-pointer"
            />
            <span className="font-mono font-semibold text-xs text-[#3D3126] w-12 text-right">{bpm} BPM</span>
          </div>

          {/* 音量：手机外放普遍偏小，给一个能拉满的滑块，否则用户只能去调系统音量 */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-[#E7D6C5]">
            <Volume2 className="w-3.5 h-3.5 text-[#8C7A6B]" />
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={volume}
              onChange={handleVolumeChange}
              aria-label="节拍器音量"
              title={`音量 ${volume}%`}
              className="w-16 sm:w-20 accent-[#E65B47] cursor-pointer"
            />
            <span className="font-mono font-semibold text-[11px] text-[#3D3126] w-9 text-right">{volume}%</span>
          </div>

          <button
            onClick={onToggle}
            className={`flex items-center gap-1 px-3 py-1 rounded-full font-semibold text-xs transition-all shadow-sm ${
              isRunning ? 'bg-[#E65B47] hover:bg-[#D94C37] text-white' : 'bg-[#10B981] hover:bg-[#059669] text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>停止</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>开始</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="text-[#A8988A] hover:text-[#574B40] text-xs px-1.5 py-0.5 rounded hover:bg-black/5"
            title="收起"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};
