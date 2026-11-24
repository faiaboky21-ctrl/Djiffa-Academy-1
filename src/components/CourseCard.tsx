/**
 * DJIFFA ACADEMY - Course Card Component
 * Adheres strictly to Zero-Pill metadata guidelines and Domain-Native luxury aesthetics
 */

import React, { useState } from 'react';
import { Course } from '../types';
import { useApp } from '../context/AppContext';
import { getCoursePricing } from '../lib/pricing';
import { Clock, BookOpen, CheckCircle, ArrowRight, Video } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  onOpenCheckout: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, onOpenCheckout }) => {
  const { navigateTo, formatPrice, isEnrolled, getCourseProgress, domains } = useApp();
  const [imgError, setImgError] = useState(false);

  const enrolled = isEnrolled(course.id);
  const progress = getCourseProgress(course.id);
  const pricing = getCoursePricing(course);

  const domainMatch = domains.find((d) => d.id === course.domain);
  const domainLabel = domainMatch ? domainMatch.shortLabel : course.domain;

  return (
    <div className="group rounded-2xl bg-zinc-950/90 border border-zinc-800/80 hover:border-[#D4AF37]/50 transition-all duration-300 flex flex-col overflow-hidden shadow-lg">
      
      {/* Cover Image Container with Zero-Broken-Image Fallback */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-900">
        {!imgError ? (
          <img
            src={course.coverImage}
            alt={course.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black p-4 text-center">
            <Video className="w-8 h-8 text-[#D4AF37] mb-2" />
            <span className="font-brand text-xs font-semibold text-zinc-300">{course.title}</span>
          </div>
        )}

        {/* Subtle scrim for bottom title readability if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

        {/* Top unboxed kicker */}
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-medium text-[#F3E5AB] border border-zinc-700/60">
          {domainLabel}
        </div>

        {/* Enrolled Status Indicator if active */}
        {enrolled && (
          <div className="absolute top-3 right-3 bg-emerald-950/90 backdrop-blur-md px-2.5 py-1 rounded text-[11px] font-medium text-emerald-300 border border-emerald-600/50 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <span>Inscrit ({progress.percentage}%)</span>
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        
        <div>
          {/* Metadata line: Zero-Pill text with bullet separators */}
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2.5">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>{course.duration.split('·')[0].trim()}</span>
            </span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
              <span>{course.modulesCount} modules</span>
            </span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>{course.level}</span>
          </div>

          <h3 className="font-brand text-lg font-bold text-slate-100 group-hover:text-[#F3E5AB] transition-colors leading-snug mb-2 line-clamp-2">
            {course.title}
          </h3>

          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
            {course.subtitle}
          </p>
        </div>

        {/* Price & Action Strip */}
        <div className="pt-4 border-t border-zinc-900 flex items-center justify-between gap-3">
          
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {pricing.isPromo && pricing.discountPercent ? `Offre spéciale · -${pricing.discountPercent}%` : 'Tarif unique'}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-brand text-lg sm:text-xl font-bold text-[#D4AF37] tabular-nums">
                {formatPrice(pricing.activeXOF)}
              </span>
              {pricing.crossedOutXOF && (
                <span className="text-xs text-zinc-500 line-through tabular-nums">
                  {formatPrice(pricing.crossedOutXOF)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTo('course-detail', course.id)}
              className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-md border border-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              Programme
            </button>

            {enrolled ? (
              <button
                onClick={() => navigateTo('player', course.id)}
                className="px-3.5 py-2 text-xs font-bold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
              >
                <span>Accéder</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={() => onOpenCheckout(course)}
                className="px-3.5 py-2 text-xs font-bold text-zinc-950 bg-[#D4AF37] hover:bg-[#E5C158] rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-sm"
              >
                <span>Acheter</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
