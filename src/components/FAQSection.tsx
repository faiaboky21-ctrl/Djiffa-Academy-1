/**
 * DJIFFA ACADEMY - FAQ Accordion Section
 */

import React, { useState } from 'react';
import { FAQ_ITEMS } from '../data/coursesData';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section className="py-16 sm:py-24 bg-[#08080A] border-b border-zinc-800/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-[#D4AF37]/30 text-xs text-[#F3E5AB]">
            <HelpCircle className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Foire Aux Questions</span>
          </div>
          <h2 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100">
            Questions Fréquemment Posées
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Tout ce que vous devez savoir sur le fonctionnement, les paiements et les accès.
          </p>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl bg-zinc-950 border border-zinc-800/80 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-zinc-900/50 transition-colors cursor-pointer"
                >
                  <span className="font-brand text-sm sm:text-base font-bold text-slate-200">
                    {item.question}
                  </span>
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#D4AF37]" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-zinc-900">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
