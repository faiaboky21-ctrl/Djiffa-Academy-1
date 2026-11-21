/**
 * DJIFFA ACADEMY - Complete Course Catalog Component
 * Dynamic filtering by domain, level, price range, sorting, and search query
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TRANSLATIONS } from '../i18n/translations';
import { Course, CourseDomain, CourseLevel } from '../types';
import { CourseCard } from './CourseCard';
import { Search, Sparkles, Filter, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface CourseCatalogProps {
  onOpenCheckout: (course: Course) => void;
}

export const CourseCatalog: React.FC<CourseCatalogProps> = ({ onOpenCheckout }) => {
  const { courses, domains, language } = useApp();
  const t = TRANSLATIONS[language];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<CourseDomain | 'all'>('all');
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel | 'all'>('all');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under_100k' | '100k_plus'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'price_asc' | 'price_desc'>('default');

  const levels: (CourseLevel | 'all')[] = ['all', 'Tous niveaux', 'Débutant', 'Intermédiaire', 'Avancé'];

  const filteredCourses = courses
    .filter((course) => {
      if (!course.isPublished) return false;
      if (selectedDomain !== 'all' && course.domain !== selectedDomain) return false;
      if (selectedLevel !== 'all' && course.level !== selectedLevel) return false;

      if (priceFilter === 'under_100k' && course.priceXOF >= 100000) return false;
      if (priceFilter === '100k_plus' && course.priceXOF < 100000) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = course.title.toLowerCase().includes(q);
        const matchSubtitle = course.subtitle.toLowerCase().includes(q);
        const matchDesc = course.description.toLowerCase().includes(q);
        const matchSkills = course.skillsAcquired.some((s) => s.toLowerCase().includes(q));
        if (!matchTitle && !matchSubtitle && !matchDesc && !matchSkills) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return a.priceXOF - b.priceXOF;
      if (sortBy === 'price_desc') return b.priceXOF - a.priceXOF;
      return 0;
    });

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedDomain('all');
    setSelectedLevel('all');
    setPriceFilter('all');
    setSortBy('default');
  };

  return (
    <div className="py-12 sm:py-16 bg-[#08080A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Catalog Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-[#D4AF37]/30 text-xs text-[#F3E5AB] mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Catalogue Officiel DJIFFA ACADEMY</span>
          </div>
          <h1 className="font-brand text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100">
            {t.catalog.title}
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 mt-3">
            {t.catalog.subtitle}
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="space-y-4 mb-10">
          
          {/* Top row: Search, Level Filter, Price Filter, Sort */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.catalog.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-slate-100 placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Effacer
                </button>
              )}
            </div>

            {/* Level, Price & Sort Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value as CourseLevel | 'all')}
                  aria-label="Filtrer par niveau"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                >
                  {levels.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl === 'all' ? 'Niveau : Tous' : `Niveau : ${lvl}`}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as 'all' | 'under_100k' | '100k_plus')}
                aria-label="Filtrer par budget"
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#D4AF37] cursor-pointer"
              >
                <option value="all">Prix : Tous les budgets</option>
                <option value="under_100k">Moins de 100 000 FCFA</option>
                <option value="100k_plus">100 000 FCFA et plus</option>
              </select>

              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'default' | 'price_asc' | 'price_desc')}
                  aria-label="Trier par prix"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                >
                  <option value="default">Tri : Recommandé</option>
                  <option value="price_asc">Prix croissant</option>
                  <option value="price_desc">Prix décroissant</option>
                </select>
              </div>
            </div>

          </div>

          {/* Bottom row: Dynamic Domain Segmented Controls */}
          <div className="flex items-center gap-1.5 p-1.5 bg-zinc-900/90 border border-zinc-800/80 rounded-xl overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedDomain('all')}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                selectedDomain === 'all'
                  ? 'bg-[#D4AF37] text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-slate-100 hover:bg-zinc-800/60'
              }`}
            >
              {t.catalog.allCourses}
            </button>
            {domains.map((dom) => {
              const active = selectedDomain === dom.id;
              return (
                <button
                  key={dom.id}
                  onClick={() => setSelectedDomain(dom.id)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    active
                      ? 'bg-[#D4AF37] text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-slate-100 hover:bg-zinc-800/60'
                  }`}
                >
                  {dom.shortLabel}
                </button>
              );
            })}
          </div>

        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-6">
          <span>
            {filteredCourses.length} {filteredCourses.length > 1 ? 'formations disponibles' : 'formation disponible'}
          </span>
          {(searchQuery || selectedDomain !== 'all' || selectedLevel !== 'all' || priceFilter !== 'all') && (
            <button
              onClick={resetAllFilters}
              className="text-[#D4AF37] hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>

        {/* Course Cards Grid */}
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onOpenCheckout={onOpenCheckout}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 px-4 rounded-2xl bg-zinc-950 border border-zinc-800/80">
            <Filter className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <h3 className="font-brand text-lg font-bold text-slate-200 mb-1">
              Aucune formation ne correspond à vos critères
            </h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
              Essayez d’élargir votre recherche ou de réinitialiser les filtres appliqués.
            </p>
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-[#D4AF37] rounded-md cursor-pointer"
            >
              Voir tout le catalogue
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
