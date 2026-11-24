/**
 * DJIFFA ACADEMY - Course Detail Page Component
 * Detailed syllabus, objectives, curriculum modules, instructor bio & instant purchase trigger
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getCoursePricing } from '../lib/pricing';
import { BRAND_IMAGES, resolveAssetImageUrl } from '../lib/assets';
import { Course } from '../types';
import { 
  ArrowLeft, 
  Clock, 
  BookOpen, 
  Award, 
  CheckCircle, 
  Download, 
  Play, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CourseDetailPageProps {
  courseId: string;
  onOpenCheckout: (course: Course) => void;
}

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({ courseId, onOpenCheckout }) => {
  const { courses, navigateTo, formatPrice, isEnrolled, getCourseProgress, siteSettings } = useApp();
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    'mod-1': true,
    'mod-2': true
  });

  const course = courses.find((c) => c.id === courseId) || courses[0];
  const enrolled = isEnrolled(course.id);
  const progress = getCourseProgress(course.id);
  const pricing = getCoursePricing(course);

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  return (
    <div className="py-10 sm:py-16 bg-[#08080A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Back navigation */}
        <button
          onClick={() => navigateTo('catalog')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-[#D4AF37] transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au catalogue des formations</span>
        </button>

        {/* 2-Column Layout: Main Content (Left) & Sticky Enrollment Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Main Content Area (8 cols) */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Header / Intro */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="text-[#D4AF37] font-semibold uppercase tracking-wider">
                  {siteSettings.academyName}
                </span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span>{course.duration}</span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span>Niveau : {course.level}</span>
              </div>

              <h1 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-100 leading-tight">
                {course.title}
              </h1>

              <p className="text-base text-zinc-300 leading-relaxed font-light">
                {course.subtitle}
              </p>
            </div>

            {/* Banner Cover with Play Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-[16/9] shadow-2xl">
              <img
                src={resolveAssetImageUrl(course.coverImage)}
                alt={course.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-center justify-center">
                {enrolled ? (
                  <button
                    onClick={() => navigateTo('player', course.id)}
                    className="p-5 rounded-full bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 shadow-2xl hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Play className="w-8 h-8 fill-current ml-1" />
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenCheckout(course)}
                    className="p-4 rounded-full bg-black/70 hover:bg-[#D4AF37] hover:text-zinc-950 text-white border border-[#D4AF37]/50 shadow-2xl hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
                  >
                    <Play className="w-7 h-7 fill-current ml-1" />
                  </button>
                )}
              </div>
            </div>

            {/* Description & Overview */}
            <div className="space-y-4">
              <h2 className="font-brand text-xl font-bold text-slate-100">
                À propos de cette formation
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {course.description}
              </p>
            </div>

            {/* Objectives / Ce que vous allez apprendre */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
              <h2 className="font-brand text-xl font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                <span>Objectifs Pédagogiques & Compétences Clés</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {course.objectives.map((obj, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                    <CheckCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Curriculum Modules Breakdown */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-brand text-xl font-bold text-slate-100">
                    Programme Détaillé du Cours
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {course.modules.length || course.modulesCount} modules structurés ·{' '}
                    {course.modules.reduce((acc, m) => acc + m.lessons.length, 0) || course.lessonsCount} leçons pratiques
                  </p>
                </div>

                <button
                  onClick={() => {
                    const allOpen = Object.values(expandedModules).every(Boolean);
                    const next: Record<string, boolean> = {};
                    course.modules.forEach(m => { next[m.id] = !allOpen; });
                    setExpandedModules(next);
                  }}
                  className="text-xs text-[#D4AF37] hover:underline cursor-pointer"
                >
                  Tout déplier / replier
                </button>
              </div>

              <div className="space-y-3">
                {course.modules.map((mod) => {
                  const isOpen = !!expandedModules[mod.id];
                  return (
                    <div
                      key={mod.id}
                      className="rounded-xl bg-zinc-950 border border-zinc-800/80 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleModule(mod.id)}
                        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-zinc-900/50 transition-colors cursor-pointer"
                      >
                        <div className="space-y-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                            Module {mod.order}
                          </span>
                          <h3 className="font-brand text-sm sm:text-base font-bold text-slate-100">
                            {mod.title}
                          </h3>
                          <p className="text-xs text-zinc-400">
                            {mod.description}
                          </p>
                        </div>
                        <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0 ml-4">
                          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 pt-2 border-t border-zinc-900 space-y-2.5">
                          {mod.lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/60 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-3">
                                <Play className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                                <span className="text-zinc-200 font-medium">
                                  {lesson.title}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                                {lesson.duration}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Included Resources */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/80 space-y-4">
              <h2 className="font-brand text-lg font-bold text-slate-100 flex items-center gap-2">
                <Download className="w-4 h-4 text-[#D4AF37]" />
                <span>Ressources Incluses avec cette Formation</span>
              </h2>

              <ul className="space-y-2 text-xs text-zinc-300">
                {course.resourcesIncluded.map((res, idx) => (
                  <li key={idx} className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
                    <span>{res}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructor Presentation */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <img
                src={BRAND_IMAGES.faithPortrait}
                alt={siteSettings.directorName}
                className="w-24 h-24 rounded-full object-cover border-2 border-[#D4AF37]/60 shrink-0 shadow-lg"
                referrerPolicy="no-referrer"
              />
              <div className="space-y-2 text-center sm:text-left">
                <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                  Votre Formatrice & Directrice
                </span>
                <h3 className="font-brand text-lg font-bold text-slate-100">
                  {siteSettings.directorName}
                </h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {siteSettings.directorBio}
                </p>
              </div>
            </div>

          </div>

          {/* Sticky Enrollment Card (Right 4 cols) */}
          <div className="lg:col-span-4 sticky top-28 space-y-6">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800/90 shadow-2xl space-y-6">
              
              <div>
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold block mb-1">
                  {pricing.isPromo && pricing.discountPercent
                    ? `Offre Promotionnelle (-${pricing.discountPercent}%)`
                    : 'Accès Individuel Illimité'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-brand text-3xl font-extrabold text-[#D4AF37] tabular-nums">
                    {formatPrice(pricing.activeXOF)}
                  </span>
                  {pricing.crossedOutXOF && (
                    <span className="text-sm text-zinc-500 line-through tabular-nums">
                      {formatPrice(pricing.crossedOutXOF)}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-500 mt-0.5 block">
                  Paiement en une fois · Aucun abonnement récurrent
                </span>
              </div>

              {/* Action Button */}
              {enrolled ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-600/40 text-emerald-300 text-xs text-center font-medium">
                    ✓ Vous possédez déjà cette formation ({progress.percentage}% complété)
                  </div>
                  <button
                    onClick={() => navigateTo('player', course.id)}
                    className="w-full py-3.5 px-4 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Reprendre ma leçon</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onOpenCheckout(course)}
                  className="w-full py-4 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-extrabold text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Acheter cette formation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Key Features included */}
              <div className="space-y-3 pt-4 border-t border-zinc-900 text-xs text-zinc-300">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#D4AF37]" />
                  <span>{course.duration}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#D4AF37]" />
                  <span>
                    {course.modules.reduce((acc, m) => acc + m.lessons.length, 0) || course.lessonsCount} leçon(s) structurée(s)
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-[#D4AF37]" />
                  <span>Ressources & prompts téléchargeables</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Award className="w-4 h-4 text-[#D4AF37]" />
                  <span>Certificat de complétion vérifié inclus</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span>Paiement 100% sécurisé (Mobile Money & Cartes)</span>
                </div>
              </div>

              {/* Mobile Money logos preview */}
              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-center">
                <span className="text-[10px] text-zinc-400 font-medium block mb-1.5 uppercase tracking-wider">
                  Moyens de paiement acceptés :
                </span>
                <span className="text-xs text-slate-200 font-semibold">
                  MTN MoMo · Moov Money · Visa · Mastercard
                </span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
