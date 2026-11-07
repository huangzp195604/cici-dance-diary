import React from 'react';
import { Calendar, UploadCloud, Users, Sparkles, Volume2, VolumeX, Download, LogIn, LogOut, UserCircle2, LineChart } from 'lucide-react';

interface NavbarProps {
  activeTab: 'timeline' | 'upload' | 'buddies' | 'growth' | 'about';
  setActiveTab: (tab: 'timeline' | 'upload' | 'buddies' | 'growth' | 'about') => void;
  metronomeActive: boolean;
  toggleMetronome: () => void;
  metronomeBeat: number;
  userAvatar?: string | null;
  /** undefined=会话恢复中；null=未登录；有值=已登录昵称 */
  userName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  /** 打开个人资料弹窗（昵称 / 性别 / 年龄） */
  onOpenProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  metronomeActive,
  toggleMetronome,
  metronomeBeat,
  userAvatar,
  userName,
  onLogin,
  onLogout,
  onOpenProfile,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF9]/90 backdrop-blur-md border-b border-[#F1E5D8] transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 md:gap-8">
        
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => setActiveTab('timeline')}>
          <div className="w-9 h-9 rounded-full bg-[#FFE8E0] text-[#FF6B6B] flex items-center justify-center font-bold text-lg shadow-sm border border-[#FFD5C8] overflow-hidden">
            <img
              src={userAvatar || '/assets/aistudio/image_f83d6670.png'}
              alt="Cici"
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/image_f83d6670.png';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-lg tracking-tight text-[#292524] whitespace-nowrap">
              Cici&apos;s Jazz Diary
            </span>
            <span className="text-[11px] text-[#8C7A6B] -mt-0.5 tracking-wider font-medium">
              普通爱好者的跳舞小角落
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Capsule / Pill style with clean states) */}
        <nav className="flex items-center gap-1 sm:gap-2 p-1 bg-[#F7EFE7] rounded-full border border-[#ECE0D3]">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-white text-[#292524] shadow-sm'
                : 'text-[#78695C] hover:text-[#292524] hover:bg-white/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#FF6B6B]" />
            <span>时间线</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-white text-[#292524] shadow-sm'
                : 'text-[#78695C] hover:text-[#292524] hover:bg-white/50'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#E67E22]" />
            <span>上传作品</span>
          </button>

          <button
            onClick={() => setActiveTab('buddies')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'buddies'
                ? 'bg-white text-[#292524] shadow-sm ring-2 ring-[#8B5CF6]/30'
                : 'text-[#78695C] hover:text-[#292524] hover:bg-white/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="relative flex items-center gap-1.5 font-bold tracking-tight text-[#5B21B6] transition-colors">
              舞友论坛
              <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-extrabold text-[#7C3AED] bg-[#EDE9FE] rounded-full border border-[#DDD0FA]">
                活跃
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('growth')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'growth'
                ? 'bg-white text-[#292524] shadow-sm'
                : 'text-[#78695C] hover:text-[#292524] hover:bg-white/50'
            }`}
          >
            <LineChart className="w-3.5 h-3.5 text-[#0EA5E9]" />
            <span>成长报告</span>
            <span className="hidden sm:inline-flex items-center justify-center px-1.5 text-[10px] font-extrabold text-[#B45309] bg-[#FFF1E0] rounded-full border border-[#F5DFC4]">
              新
            </span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-full transition-all whitespace-nowrap ${
              activeTab === 'about'
                ? 'bg-white text-[#292524] shadow-sm'
                : 'text-[#78695C] hover:text-[#292524] hover:bg-white/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
            <span>关于我</span>
          </button>
        </nav>

        {/* Zone 3: Login + Metronome + Download Package Button */}
        <div className="flex items-center gap-2 shrink-0">
          {userName === undefined ? null : userName ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenProfile}
                title="编辑我的资料（昵称 / 性别 / 年龄）"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD0FA] hover:bg-[#E2DBFA] transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserCircle2 className="w-3.5 h-3.5" />
                {userName}
              </button>
              <button
                onClick={onLogout}
                title="退出登录"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">退出</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              title="登录后可发帖、点赞、约练"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border bg-[#EDE9FE] hover:bg-[#E2DBFA] text-[#5B21B6] border-[#DDD0FA] whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden md:inline">登录论坛</span>
              <span className="md:hidden">登录</span>
            </button>
          )}

          <a
            href="/cici-dance-diary-project.zip"
            download="cici-dance-diary-project.zip"
            title="一键下载完整项目源码包 (ZIP，约240KB)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border bg-[#FFF4EC] hover:bg-[#FFEAE0] text-[#D94834] border-[#F6DCBE] whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">下载项目包</span>
            <span className="md:hidden">下载</span>
          </a>

          <button
            onClick={toggleMetronome}
            title={metronomeActive ? '暂停 Jazz 8-Count 节拍器' : '开启 Jazz 8-Count 节拍器'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border whitespace-nowrap cursor-pointer ${
              metronomeActive
                ? 'bg-[#FF7E67] text-white border-[#FF6B6B] ring-2 ring-[#FF7E67]/20 shadow-md'
                : 'bg-white text-[#574B40] border-[#E8DACB] hover:bg-[#FFF7F0] hover:text-[#292524]'
            }`}
          >
            {metronomeActive ? (
              <>
                <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                <span className="hidden sm:inline">Jazz 节拍:</span>
                <span className="font-mono font-bold text-white px-1 py-0.2 bg-black/20 rounded">
                  {metronomeBeat > 0 ? metronomeBeat : 1}
                </span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#A8988A]" />
                <span className="hidden sm:inline">8-Count 节拍器</span>
                <span className="sm:hidden">节拍器</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
