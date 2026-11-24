/**
 * DJIFFA ACADEMY - Hero Presentation Section
 * Displays brand vision, Faith Ariola portrait, key value proposition and primary CTAs
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, Sparkles, Award, ShieldCheck, PlayCircle } from 'lucide-react';
import { BRAND_IMAGES } from '../lib/assets';

export const Hero: React.FC = () => {
  const { navigateTo, siteSettings } = useApp();

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 border-b border-zinc-800/60">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#D4AF37]/10 via-transparent to-transparent pointer-events-none blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Agency Kicker */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-[#D4AF37]/30 text-xs text-zinc-300 mb-8 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
          <span className="font-medium text-[#F3E5AB]">{siteSettings.parentAgencyName}</span>
          <span className="text-zinc-500">·</span>
          <span>Fondée par {siteSettings.directorName}</span>
        </div>

        {/* 2-Column Split: Editorial Value Proposition & Cinematic Portrait */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headlines & Action Deck */}
          <div className="lg:col-span-7 space-y-6">
            <h1 className="font-brand text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-100 leading-[1.1] text-balance">
              L’École Internationale pour Maîtriser l’<span className="gold-gradient-text">IA Créative</span> & le Business Digital
            </h1>

            <p className="text-base sm:text-lg text-zinc-300 leading-relaxed max-w-2xl text-pretty">
              {siteSettings.academyPresentation}
            </p>

            {/* Mode of Learning highlights (Unboxed discipline) */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5 text-zinc-200">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                Formations autonomes à la carte
              </span>
              <span className="text-zinc-600">·</span>
              <span className="flex items-center gap-1.5 text-zinc-200">
                <Award className="w-4 h-4 text-[#D4AF37]" />
                Accompagnement VIP sur-mesure
              </span>
              <span className="text-zinc-600">·</span>
              <span className="flex items-center gap-1.5 text-zinc-200">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                Certification officielle
              </span>
            </div>

            {/* Primary CTA Deck */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <button
                onClick={() => navigateTo('catalog')}
                className="px-6 py-3.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>Découvrir les formations</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigateTo('coaching')}
                className="px-6 py-3.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-slate-100 font-semibold text-sm border border-zinc-700 hover:border-[#D4AF37]/60 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>Être accompagné</span>
              </button>

              <button
                onClick={() => navigateTo('course-detail', 'course-faith-ariola-methode')}
                className="px-4 py-3 text-xs text-[#D4AF37] hover:text-[#F3E5AB] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Voir la Méthode Faith Ariola</span>
              </button>
            </div>
          </div>

          {/* Right Column: Visual Anchor - Faith Ariola Studio Portrait */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Outer decorative gold hairline frame */}
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-[#D4AF37]/30 via-zinc-800 to-transparent blur-sm -z-10" />
              
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
                <img
                  src={BRAND_IMAGES.faithPortrait}
                  alt="Faith Ariola - Directrice et Créatrice de DJIFFA ACADEMY et DJIFFA DESIGN AGENCY"
                  className="w-full h-[420px] sm:h-[480px] object-cover object-top"
                  referrerPolicy="no-referrer"
                />

                {/* Subdued contrast scrim with verified author caption */}
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/95 via-black/75 to-transparent text-left">
                  <span className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold block mb-0.5">
                    Direction & Vision
                  </span>
                  <p className="font-brand text-lg font-bold text-white tracking-wide">
                    {siteSettings.directorName}
                  </p>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Fondatrice de {siteSettings.parentAgencyName} & Directrice de {siteSettings.academyName}
                  </p>
                </div>
              </div>

              {/* Floating aesthetic marker */}
              <div className="absolute -top-3 -right-3 hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-950/90 border border-[#D4AF37]/40 shadow-xl backdrop-blur-md">
                <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                <span className="text-xs font-semibold text-slate-100 font-brand tracking-wider">
                  Édition 2026
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* 4-Zone KPI Strip below the hero split */}
        <div className="mt-16 pt-10 border-t border-zinc-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="font-brand text-2xl sm:text-3xl font-extrabold text-[#D4AF37] tabular-nums block">
              100%
            </span>
            <span className="text-xs text-zinc-300 font-medium mt-1 block">
              Axé sur la Pratique Réelle
            </span>
            <span className="text-[11px] text-zinc-500 block">
              Aucune théorie inutile
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="font-brand text-2xl sm:text-3xl font-extrabold text-[#D4AF37] tabular-nums block">
              4 Pôles
            </span>
            <span className="text-xs text-zinc-300 font-medium mt-1 block">
              Domaines Spécialisés IA
            </span>
            <span className="text-[11px] text-zinc-500 block">
              Vidéo, Mode, Cinéma, Business
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="font-brand text-2xl sm:text-3xl font-extrabold text-[#D4AF37] tabular-nums block">
              Mobile Money
            </span>
            <span className="text-xs text-zinc-300 font-medium mt-1 block">
              Paiement Local & Mondial
            </span>
            <span className="text-[11px] text-zinc-500 block">
              MTN, Moov & Cartes Visa/Mastercard
            </span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <span className="font-brand text-2xl sm:text-3xl font-extrabold text-[#D4AF37] tabular-nums block">
              À Vie
            </span>
            <span className="text-xs text-zinc-300 font-medium mt-1 block">
              Accès Permanent & Mises à Jour
            </span>
            <span className="text-[11px] text-zinc-500 block">
              Achat individuel sans abonnement
            </span>
          </div>
        </div>

      </div>
    </section>
  );
};
