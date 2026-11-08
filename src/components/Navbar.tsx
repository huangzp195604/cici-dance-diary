import React, { useEffect, useRef, useState } from 'react';
import { Calendar, UploadCloud, Users, Sparkles, Volume2, VolumeX, Download, LogIn, LogOut, UserCircle2, LineChart, ChevronRight } from 'lucide-react';
import { brandTitle, brandInitial } from '../utils/brand';

interface NavbarProps {
  activeTab: 'timeline' | 'upload' | 'buddies' | 'growth' | 'about';
  setActiveTab: (tab: 'timeline' | 'upload' | 'buddies' | 'growth' | 'about') => void;
  metronomeActive: boolean;
  toggleMetronome: () => void;
  metronomeBeat: number;
  userAvatar?: string | null;
  /** undefined=会话恢复中；null=未登录；有值=已登录昵称 */
  userName?: string | null;
  /** 品牌标题用的昵称：与「关于我」等页面同源，避免手机号脱敏名跑进站名 */
  brandName?: string | null;
  onLogin: () => void;
  onLogout: () => void;
  /** 打开个人资料弹窗（昵称 / 性别 / 年龄） */
  onOpenProfile?: () => void;
}

/** 胶囊导航项：抽成数组，桌面单行 / 移动端横向滚动共用一份，避免两份实现走样 */
const NAV_ITEMS = [
  { key: 'timeline', label: '时间线', icon: Calendar, iconClass: 'text-[#FF6B6B]' },
  { key: 'upload', label: '上传作品', icon: UploadCloud, iconClass: 'text-[#E67E22]' },
  { key: 'buddies', label: '舞友论坛', icon: Users, iconClass: 'text-[#8B5CF6]' },
  { key: 'growth', label: '成长报告', icon: LineChart, iconClass: 'text-[#0EA5E9]' },
  { key: 'about', label: '关于我', icon: Sparkles, iconClass: 'text-[#10B981]' },
] as const;

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  metronomeActive,
  toggleMetronome,
  metronomeBeat,
  userAvatar,
  userName,
  brandName,
  onLogin,
  onLogout,
  onOpenProfile,
}) => {
  const navRef = useRef<HTMLElement>(null);
  /** 极窄屏（<350px）才回退到横滑，且必须给出可见提示，避免「无声溢出」 */
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 350);
  /** 仅当导航确实可横向滚动、且尚未滑到末尾时，才显示右缘箭头 */
  const [showMoreHint, setShowMoreHint] = useState(false);

  // 站名跟随账号昵称：未登录 / 未设昵称 → 「你的舞蹈成长日记」
  const brandText = brandTitle(brandName ?? userName);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 350);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const overflowing = nav.scrollWidth > nav.clientWidth + 2;
      setShowMoreHint(overflowing && nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    nav.addEventListener('scroll', update, { passive: true });
    return () => {
      observer.disconnect();
      nav.removeEventListener('scroll', update);
    };
  }, [narrow]);

  /** 从 #growth / #about 深链进入或切换标签时，把选中项滚到可见区中央（仅在存在溢出时生效） */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth + 2) return;
    const active = nav.querySelector<HTMLElement>(`[data-nav-key="${activeTab}"]`);
    if (!active) return;
    nav.scrollTo({
      left: Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2),
      behavior: 'smooth',
    });
  }, [activeTab, narrow]);

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF9]/90 backdrop-blur-md border-b border-[#F1E5D8] transition-all">
      {/*
        移动端两行：第一行 logo + 操作区，第二行 5 等分紧凑标签栏（图标上、文字下），
        5 个入口首屏全部可见；桌面端 md:flex-nowrap 回到原来的单行胶囊导航。
        nav 仍保留 min-w-0 + overflow-x-auto：极窄屏（<350px）回退横滑时不会把页面
        撑宽，避免 iOS Safari 自动缩小整页（表现为"字很小、要缩放才看得全"）。
      */}
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-x-2 gap-y-2 md:gap-4 lg:gap-8">

        {/* Zone 1: wordmark */}
        <div className="flex items-center gap-2 shrink-0 order-1 cursor-pointer" onClick={() => setActiveTab('timeline')}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FFE8E0] text-[#FF6B6B] flex items-center justify-center font-bold text-lg shadow-sm border border-[#FFD5C8] overflow-hidden">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName || '我的头像'}
                className="w-full h-full object-cover rounded-full"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span aria-hidden="true" className="select-none">{brandInitial(brandText)}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0 max-w-[150px] sm:max-w-[280px]">
            <span
              className="font-display font-extrabold text-base sm:text-lg tracking-tight text-[#292524] truncate"
              title={brandText}
            >
              {brandText}
            </span>
            <span className="hidden sm:block text-[11px] text-[#8C7A6B] -mt-0.5 tracking-wider font-medium truncate">
              记录每一次练舞与成长
            </span>
          </div>
        </div>

        {/* Zone 2: 标签导航（移动端 5 等分全可见；md 以上恢复单行胶囊）。
            同一份 NAV_ITEMS 数据 + 同一套图标/配色，只切换排布，标签含义与顺序不变。 */}
        <div className="relative order-3 md:order-2 w-full md:w-auto min-w-0">
          <nav
            ref={navRef}
            aria-label="主导航"
            className={`${narrow ? 'flex' : 'grid grid-cols-5 md:flex'} items-center gap-1 sm:gap-2 p-1 bg-[#F7EFE7] rounded-2xl md:rounded-full border border-[#ECE0D3] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            {NAV_ITEMS.map(({ key, label, icon: Icon, iconClass }) => (
              <button
                key={key}
                type="button"
                data-nav-key={key}
                aria-current={activeTab === key ? 'page' : undefined}
                onClick={() => setActiveTab(key)}
                className={`relative flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 px-1 md:px-3 lg:px-4 py-2 md:py-1.5 min-h-[44px] md:min-h-0 rounded-xl md:rounded-full text-[11px] sm:text-xs md:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  narrow ? 'min-w-[62px] md:min-w-0' : 'min-w-0'
                } ${
                  activeTab === key
                    ? 'bg-white text-[#292524] shadow-sm'
                    : 'text-[#78695C] hover:text-[#292524] hover:bg-white/50'
                }`}
              >
                <span className="relative inline-flex shrink-0">
                  <Icon className={`w-4 h-4 md:w-3.5 md:h-3.5 ${iconClass}`} />
                  {key === 'buddies' && (
                    <span aria-hidden="true" className="md:hidden absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
                  )}
                  {key === 'growth' && (
                    <span aria-hidden="true" className="md:hidden absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                  )}
                </span>
                <span className={key === 'buddies' ? 'font-bold tracking-tight text-[#5B21B6]' : ''}>{label}</span>
                {key === 'buddies' && (
                  <span className="hidden md:inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-extrabold text-[#7C3AED] bg-[#EDE9FE] rounded-full border border-[#DDD0FA]">
                    活跃
                  </span>
                )}
                {key === 'growth' && (
                  <span className="hidden md:inline-flex items-center justify-center px-1.5 text-[10px] font-extrabold text-[#B45309] bg-[#FFF1E0] rounded-full border border-[#F5DFC4]">
                    新
                  </span>
                )}
              </button>
            ))}
          </nav>
          {/* 只有真的出现溢出时才出现，属于滚动提示、不是二级菜单 */}
          {showMoreHint && (
            <button
              type="button"
              aria-label="查看更多标签"
              onClick={() =>
                navRef.current?.scrollBy({ left: navRef.current.clientWidth * 0.7, behavior: 'smooth' })
              }
              className="md:hidden absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-[#ECE0D3] text-[#78695C] shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Zone 3: 登录 / 资料 + 下载 + 节拍器 */}
        <div className="flex items-center gap-1.5 shrink-0 order-2 md:order-3 ml-auto md:ml-0">
          {/* 会话恢复中（userName=undefined）也保留登录按钮：自动弹窗万一没出现，
              用户仍能手动进入登录，手机上不至于完全找不到入口 */}
          {userName ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onOpenProfile}
                title="编辑我的资料（昵称 / 性别 / 年龄）"
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD0FA] hover:bg-[#E2DBFA] transition-colors whitespace-nowrap cursor-pointer max-w-[110px] sm:max-w-none"
              >
                <UserCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{userName}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                title="退出登录（需二次确认）"
                aria-label="退出登录，需二次确认"
                className="flex items-center gap-1 ml-0.5 pl-2 border-l border-[#ECE0D3] px-2 py-1.5 rounded-full text-xs font-semibold text-[#8C7A6B] hover:bg-[#F7EFE7] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">退出</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              title="登录后可发帖、点赞、约练，并同步你的数据"
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border bg-[#EDE9FE] hover:bg-[#E2DBFA] text-[#5B21B6] border-[#DDD0FA] whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>登录</span>
            </button>
          )}

          {/* 手机上下载源码包意义不大，小屏隐藏以给第一行腾出空间 */}
          <a
            href="/cici-dance-diary-project.zip"
            download="cici-dance-diary-project.zip"
            title="一键下载完整项目源码包 (ZIP)"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border bg-[#FFF4EC] hover:bg-[#FFEAE0] text-[#D94834] border-[#F6DCBE] whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">下载项目包</span>
            <span className="lg:hidden">下载</span>
          </a>

          <button
            onClick={toggleMetronome}
            title={metronomeActive ? '暂停 8-Count 练舞节拍器' : '开启 8-Count 练舞节拍器'}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border whitespace-nowrap cursor-pointer ${
              metronomeActive
                ? 'bg-[#FF7E67] text-white border-[#FF6B6B] ring-2 ring-[#FF7E67]/20 shadow-md'
                : 'bg-white text-[#574B40] border-[#E8DACB] hover:bg-[#FFF7F0] hover:text-[#292524]'
            }`}
          >
            {metronomeActive ? (
              <>
                <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                <span className="font-mono font-bold text-white px-1 py-0.2 bg-black/20 rounded">
                  {metronomeBeat > 0 ? metronomeBeat : 1}
                </span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-[#A8988A]" />
                <span className="hidden lg:inline">8-Count 节拍器</span>
                <span className="hidden sm:inline lg:hidden">节拍器</span>
              </>
            )}
          </button>
        </div>

      </div>
    </header>
  );
};
