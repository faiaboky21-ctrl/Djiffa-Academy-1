/**
 * DJIFFA ACADEMY - Faith Ariola Bio & DJIFFA DESIGN AGENCY Heritage
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Award, ArrowRight, Video, Target, Compass } from 'lucide-react';
import { BRAND_IMAGES } from '../lib/assets';

export const FaithAriolaStory: React.FC = () => {
  const { navigateTo, siteSettings } = useApp();

  return (
    <section className="py-16 sm:py-24 bg-[#08080A] border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Portrait & Studio visual */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
              <img
                src={BRAND_IMAGES.faithPortrait}
                alt="Faith Ariola - Directrice de DJIFFA DESIGN AGENCY"
                className="w-full h-[450px] object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-6 flex flex-col justify-end text-left">
                <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                  Fondatrice & Directrice
                </span>
                <h3 className="font-brand text-2xl font-bold text-white">
                  {siteSettings.directorName}
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  « La créativité africaine propulsée par la technologie mondiale »
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Narrative Prose & Agency Heritage */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-[#D4AF37]/30 text-xs text-[#F3E5AB]">
                <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Une Vision Née à {siteSettings.parentAgencyName}</span>
              </div>

              <h2 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100 leading-tight">
                À Propos de {siteSettings.directorName} & de {siteSettings.academyName}
              </h2>
            </div>

            <p className="text-sm sm:text-base text-zinc-300 leading-relaxed font-light">
              {siteSettings.directorBio}
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {siteSettings.parentAgencyPresentation}
            </p>

            {/* 3 Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <Target className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-xs font-bold text-slate-200 block">Excellence Pratique</span>
                <p className="text-[11px] text-zinc-400">Des projets calibrés pour les exigences des marques.</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <Compass className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-xs font-bold text-slate-200 block">Impact International</span>
                <p className="text-[11px] text-zinc-400">Vendre ses prestations à l’étranger depuis Cotonou.</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <Award className="w-5 h-5 text-[#D4AF37]" />
                <span className="text-xs font-bold text-slate-200 block">Indépendance Totale</span>
                <p className="text-[11px] text-zinc-400">Aucun abonnement forcé, des cours acquis à vie.</p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigateTo('course-detail', 'course-faith-ariola-methode')}
                className="px-6 py-3 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>Découvrir La Méthode Faith Ariola</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigateTo('coaching')}
                className="px-5 py-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-700 cursor-pointer"
              >
                Demander un mentorat 1-sur-1
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
