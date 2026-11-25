/**
 * DJIFFA ACADEMY - Top Navigation Bar
 * Conforms to Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (4-5 Nav Links) — Zone 3 (1 Primary Action / User Menu)
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TRANSLATIONS } from '../i18n/translations';
import {
  GraduationCap,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Globe,
  Sparkles,
  ChevronDown,
  BookOpen,
  Bell
} from 'lucide-react';
import { Currency, User } from '../types';

function getSafeHeaderDisplayName(user: User): string {
  const rawName = (user.name || '').trim();
  const emailLocal = (user.email || '').split('@')[0]?.trim().toLowerCase() || '';

  if (!rawName) {
    return user.role === 'admin' ? 'Direction' : 'Mon compte';
  }

  const looksLikeRawEmailOrTechnicalHandle =
    rawName.includes('@') ||
    (emailLocal.length > 0 &&
      rawName.toLowerCase() === emailLocal &&
      (/\d/.test(rawName) || !/\s/.test(rawName)));

  if (looksLikeRawEmailOrTechnicalHandle) {
    return user.role === 'admin' ? 'Direction' : 'Mon compte';
  }

  return rawName;
}

export const Navbar: React.FC = () => {
  const {
    activeView,
    navigateTo,
    currentUser,
    logout,
    currency,
    setCurrency,
    language,
    siteSettings,
    notifications,
    openAuthModal
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  const t = TRANSLATIONS[language];

  const navLinks = [
    { label: t.nav.courses, view: 'catalog' as const },
    { label: t.nav.method, view: 'course-detail' as const, courseId: 'course-faith-ariola-methode' },
    { label: t.nav.coaching, view: 'coaching' as const },
    { label: t.nav.about, view: 'about' as const },
    { label: t.nav.contact, view: 'contact' as const }
  ];

  const unreadCount = currentUser
    ? notifications.filter((n) => !n.read && (n.userId === 'all' || n.userId === currentUser.id)).length
    : 0;
  const headerDisplayName = currentUser ? getSafeHeaderDisplayName(currentUser) : '';

  const handleNavClick = (view: Parameters<typeof navigateTo>[0], courseId?: string) => {
    navigateTo(view, courseId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#08080A]/95 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-8">
        
        {/* Zone 1: Wordmark / Imported Agency Logo */}
        <button
          onClick={() => handleNavClick('home')}
          className="flex items-center gap-2.5 text-left group shrink-0 focus:outline-none cursor-pointer"
        >
          {siteSettings.agencyLogoDataUrl ? (
            <img
              src={siteSettings.agencyLogoDataUrl}
              alt="DJIFFA DESIGN AGENCY"
              className="w-10 h-10 rounded-lg object-contain bg-zinc-900 border border-[#D4AF37]/40 p-0.5"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shadow-inner group-hover:border-[#D4AF37] transition-colors">
              <span className="font-brand text-xl font-bold tracking-wider">D</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-brand text-lg sm:text-xl font-extrabold tracking-widest text-slate-100 uppercase group-hover:text-[#F3E5AB] transition-colors whitespace-nowrap">
              {siteSettings.academyName.toUpperCase().includes('DJIFFA') ? (
                <>
                  DJIFFA <span className="text-[#D4AF37]">{siteSettings.academyName.replace(/djiffa\s*/i, '') || 'ACADEMY'}</span>
                </>
              ) : (
                siteSettings.academyName
              )}
            </span>
            <span className="text-[10px] tracking-wider uppercase text-zinc-400 font-medium whitespace-nowrap truncate max-w-[190px] sm:max-w-none">
              Par {siteSettings.parentAgencyName}
            </span>
          </div>
        </button>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-zinc-300">
          {navLinks.map((link) => {
            const isActive = activeView === link.view && (!link.courseId || activeView === 'course-detail');
            return (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.view, link.courseId)}
                className={`transition-colors whitespace-nowrap py-1 relative hover:text-[#D4AF37] cursor-pointer ${
                  isActive ? 'text-[#F3E5AB] font-semibold' : 'text-zinc-300'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#D4AF37] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Currency + Primary Account Action */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Currency Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setCurrencyDropdownOpen(!currencyDropdownOpen);
                setUserDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900/90 hover:bg-zinc-800 rounded-md border border-zinc-800 transition-colors cursor-pointer"
              title="Changer de devise"
            >
              <Globe className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span className="font-mono">{currency}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {currencyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-1 z-50">
                {(['XOF', 'EUR', 'USD'] as Currency[]).map((cur) => (
                  <button
                    key={cur}
                    onClick={() => {
                      setCurrency(cur);
                      setCurrencyDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-zinc-800 cursor-pointer ${
                      currency === cur ? 'text-[#D4AF37] font-semibold bg-zinc-800/40' : 'text-zinc-300'
                    }`}
                  >
                    <span>{cur === 'XOF' ? 'FCFA (XOF)' : cur === 'EUR' ? 'Euro (EUR)' : 'Dollar (USD)'}</span>
                    {currency === cur && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account Menu / Sign In */}
          <div className="relative">
            {currentUser ? (
              <button
                onClick={() => {
                  setUserDropdownOpen(!userDropdownOpen);
                  setCurrencyDropdownOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-[#D4AF37]/30 hover:border-[#D4AF37] transition-all cursor-pointer text-left"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8C701E] flex items-center justify-center text-zinc-950 font-bold text-xs relative">
                  {(headerDisplayName.charAt(0) || 'D').toUpperCase()}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left gap-0.5 leading-tight">
                  <span className="text-xs font-semibold text-slate-100 max-w-[130px] truncate">
                    {headerDisplayName}
                  </span>
                  <span className="sr-only"> · </span>
                  <span className="text-[10px] text-zinc-400">
                    {currentUser.role === 'admin' ? 'Directrice' : 'Apprenant'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            ) : (
              <button
                onClick={() => openAuthModal('student')}
                className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-[#D4AF37] hover:bg-[#E5C158] rounded-md transition-all shadow-md whitespace-nowrap cursor-pointer"
              >
                {t.nav.signIn}
              </button>
            )}

            {userDropdownOpen && currentUser && (
              <div className="absolute right-0 mt-2 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl py-2 z-50">
                <div className="px-4 py-2.5 border-b border-zinc-800/80">
                  <p className="text-xs font-semibold text-slate-100">{headerDisplayName}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{currentUser.email}</p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-[#D4AF37]/10 text-[#F3E5AB] border border-[#D4AF37]/20">
                    {currentUser.role === 'admin' ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                        Compte Direction / Admin
                      </>
                    ) : (
                      <>
                        <GraduationCap className="w-3 h-3 text-[#D4AF37]" />
                        Compte Apprenant
                      </>
                    )}
                  </div>
                </div>

                <div className="py-1">
                  {currentUser.role === 'admin' ? (
                    <button
                      onClick={() => {
                        handleNavClick('admin-space');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-left text-zinc-200 hover:bg-zinc-900 flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                      Tableau de bord Administratrice
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleNavClick('student-space');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full px-4 py-2 text-xs text-left text-zinc-200 hover:bg-zinc-900 flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                        Mon Espace Apprenant
                      </span>
                      {unreadCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-[#D4AF37] font-mono">
                          <Bell className="w-3 h-3" /> {unreadCount}
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      handleNavClick('catalog');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-xs text-left text-zinc-200 hover:bg-zinc-900 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-zinc-400" />
                    Catalogue des formations
                  </button>

                  {currentUser.role !== 'admin' && (
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        openAuthModal('admin');
                      }}
                      className="w-full px-4 py-2 text-xs text-left text-zinc-400 hover:text-[#F3E5AB] hover:bg-zinc-900 flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-zinc-500" />
                      Accès Direction (Admin)
                    </button>
                  )}
                </div>

                <div className="pt-1 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      logout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-xs text-left text-red-400 hover:bg-red-950/20 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    Se déconnecter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-zinc-300 hover:text-white rounded-lg bg-zinc-900 border border-zinc-800 focus:outline-none cursor-pointer"
            aria-label="Ouvrir le menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-zinc-950 border-b border-zinc-800 px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.view, link.courseId)}
                className="text-left py-2.5 px-3 text-sm font-medium text-zinc-300 hover:text-[#D4AF37] hover:bg-zinc-900 rounded-md transition-colors"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
            {!currentUser ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal('student');
                }}
                className="w-full py-3 px-4 text-xs font-semibold text-zinc-950 bg-[#D4AF37] rounded-md text-center"
              >
                Se connecter / Créer un compte
              </button>
            ) : currentUser.role === 'admin' ? (
              <button
                onClick={() => handleNavClick('admin-space')}
                className="w-full py-3 px-4 text-xs font-semibold text-zinc-950 bg-[#D4AF37] rounded-md text-center"
              >
                Tableau de bord Directrice
              </button>
            ) : (
              <button
                onClick={() => handleNavClick('student-space')}
                className="w-full py-3 px-4 text-xs font-semibold text-zinc-950 bg-[#D4AF37] rounded-md text-center"
              >
                Mon Espace Apprenant
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
