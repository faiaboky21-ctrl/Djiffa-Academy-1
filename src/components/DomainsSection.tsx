/**
 * DJIFFA ACADEMY - Dynamic Domains of Training Section
 * Renders training domains configured by Administration
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { Video, Sparkles, Film, TrendingUp, Layers, ArrowRight } from 'lucide-react';

export const DomainsSection: React.FC = () => {
  const { domains, navigateTo } = useApp();

  const getDomainIcon = (id: string) => {
    if (id === 'video_ads_ai') return Video;
    if (id === 'virtual_fashion_ai') return Sparkles;
    if (id === 'cinema_storytelling_ai') return Film;
    if (id === 'digital_business') return TrendingUp;
    return Layers;
  };

  return (
    <section className="py-16 lg:py-24 bg-[#08080A] border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37] block mb-2">
              Architecture Pédagogique
            </span>
            <h2 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100">
              Nos {domains.length} Domaines d’Apprentissage
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 mt-2">
              Une sélection rigoureuse de disciplines pensées pour répondre à la demande mondiale des marques, agences et créateurs.
            </p>
          </div>

          <button
            onClick={() => navigateTo('catalog')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4AF37] hover:text-[#F3E5AB] transition-colors cursor-pointer self-start md:self-auto"
          >
            <span>Explorer toutes les formations</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Domain Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {domains.map((dom) => {
            const Icon = getDomainIcon(dom.id);
            return (
              <div
                key={dom.id}
                className="group p-6 sm:p-8 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-[#D4AF37]/50 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#D4AF37] group-hover:border-[#D4AF37]/60 group-hover:bg-[#D4AF37]/10 transition-colors">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-brand text-2xl font-bold text-zinc-700 group-hover:text-[#D4AF37]/60 transition-colors tabular-nums">
                      {dom.code}
                    </span>
                  </div>

                  <h3 className="font-brand text-xl font-bold text-slate-100 mb-2 group-hover:text-[#F3E5AB] transition-colors">
                    {dom.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-6">
                    {dom.description}
                  </p>

                  {dom.skills.length > 0 && (
                    <div className="space-y-2 mb-6">
                      <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block">
                        Compétences enseignées :
                      </span>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {dom.skills.map((skill, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[#D4AF37] text-sm leading-none mt-0.5">·</span>
                            <span>{skill}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-zinc-900 flex items-center justify-between">
                  {dom.highlightCourseId ? (
                    <button
                      onClick={() => navigateTo('course-detail', dom.highlightCourseId)}
                      className="text-xs font-semibold text-[#D4AF37] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Voir le programme détaillé</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    <button
                      onClick={() => navigateTo('catalog')}
                      className="text-xs font-semibold text-[#D4AF37] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Découvrir les cours</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => navigateTo('catalog')}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    Voir le catalogue
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
