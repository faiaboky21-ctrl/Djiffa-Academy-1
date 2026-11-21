/**
 * DJIFFA ACADEMY - Main Application Component
 * Brand: DJIFFA ACADEMY | Parent: DJIFFA DESIGN AGENCY | Founder: Faith Ariola
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { DomainsSection } from './components/DomainsSection';
import { CourseCatalog } from './components/CourseCatalog';
import { CourseCard } from './components/CourseCard';
import { CourseDetailPage } from './components/CourseDetailPage';
import { CoursePlayer } from './components/CoursePlayer';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { CoachingSection } from './components/CoachingSection';
import { FaithAriolaStory } from './components/FaithAriolaStory';
import { FAQSection } from './components/FAQSection';
import { ContactSection } from './components/ContactSection';
import { Footer } from './components/Footer';
import { CheckoutModal } from './components/CheckoutModal';
import { CertificateModal } from './components/CertificateModal';
import { AuthModal } from './components/AuthModal';
import { Course } from './types';
import { ArrowRight, Sparkles, CheckCircle, MessageSquareQuote } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const {
    activeView,
    selectedCourseId,
    activeLessonId,
    navigateTo,
    courses,
    testimonials
  } = useApp();

  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [certificateCourseId, setCertificateCourseId] = useState<string | null>(null);

  const featuredCourses = courses.filter((c) => c.isFeatured && c.isPublished);
  const flagshipCourse = courses.find((c) => c.id === 'course-faith-ariola-methode') || courses[0];

  if (activeView === 'player' && selectedCourseId) {
    return (
      <div className="min-h-screen bg-[#08080A] text-slate-100 flex flex-col">
        <CoursePlayer
          courseId={selectedCourseId}
          initialLessonId={activeLessonId}
          onOpenCertificateModal={(id) => setCertificateCourseId(id)}
        />
        {certificateCourseId && (
          <CertificateModal
            courseId={certificateCourseId}
            onClose={() => setCertificateCourseId(null)}
          />
        )}
        <AuthModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080A] text-slate-100 flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-[#F3E5AB]">
      <Navbar />

      <main className="flex-1">
        {activeView === 'home' && (
          <div>
            <Hero />

            {/* Flagship Method Spotlight */}
            {flagshipCourse && (
              <section className="py-12 bg-gradient-to-b from-zinc-950 via-[#08080A] to-[#08080A] border-b border-zinc-800/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="rounded-3xl bg-zinc-950 border border-[#D4AF37]/50 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
                      <div className="lg:col-span-7 space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-[#D4AF37]/40 text-xs text-[#F3E5AB]">
                          <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                          <span>Programme Phare Officiel</span>
                        </div>

                        <h2 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-100 leading-tight">
                          La Méthode Faith Ariola : De l’Idée à la Vidéo Publicitaire par IA
                        </h2>

                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl">
                          Le pipeline complet pour créer des publicités cinématiques de marques avec l’intelligence artificielle : prompts d’éclairage, cohérence des personnages, animation de caméras, voix off émotionnelles et montage de prestige.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400 pt-2">
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <CheckCircle className="w-4 h-4 text-[#D4AF37]" />
                            24 heures de formation intensive
                          </span>
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <CheckCircle className="w-4 h-4 text-[#D4AF37]" />
                            120+ Master Prompts publicitaires
                          </span>
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <CheckCircle className="w-4 h-4 text-[#D4AF37]" />
                            Devoirs corrigés & Certificat officiel
                          </span>
                          <span className="flex items-center gap-1.5 text-zinc-300">
                            <CheckCircle className="w-4 h-4 text-[#D4AF37]" />
                            Modèles de contrats agence inclus
                          </span>
                        </div>

                        <div className="pt-4 flex flex-wrap items-center gap-4">
                          <button
                            onClick={() => setCheckoutCourse(flagshipCourse)}
                            className="px-6 py-3.5 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                          >
                            <span>Acheter cette formation</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => navigateTo('course-detail', flagshipCourse.id)}
                            className="px-5 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-slate-200 text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
                          >
                            Consulter le programme détaillé
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-5 relative">
                        <div className="relative rounded-2xl overflow-hidden border border-zinc-800 shadow-xl aspect-[16/10]">
                          <img
                            src="/src/assets/images/course_method_faith_ariola_1794341070404.jpg"
                            alt="Pipeline de production vidéo IA Faith Ariola"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-4">
                            <span className="text-[11px] text-zinc-300 font-medium">
                              Studio virtuel DJIFFA DESIGN AGENCY
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <DomainsSection />

            {/* Featured Courses Grid */}
            <section className="py-16 sm:py-24 bg-[#08080A] border-b border-zinc-800/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#D4AF37] block mb-1">
                      Sélection d’Excellence
                    </span>
                    <h2 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-100">
                      Formations Mises en Avant
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                      Des cursus certifiants conçus pour créer des compétences immédiatement monétisables.
                    </p>
                  </div>

                  <button
                    onClick={() => navigateTo('catalog')}
                    className="text-xs font-semibold text-[#D4AF37] hover:text-[#F3E5AB] flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <span>Voir tout le catalogue ({courses.filter(c => c.isPublished).length})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {featuredCourses.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      onOpenCheckout={(courseToBuy) => setCheckoutCourse(courseToBuy)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <FaithAriolaStory />

            {/* Real Verified Testimonials — Rendered ONLY when real testimonials have been published */}
            {testimonials.length > 0 && (
              <section className="py-16 sm:py-24 bg-[#08080A] border-b border-zinc-800/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                  <div className="text-center max-w-2xl mx-auto space-y-2">
                    <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold block">
                      Retours Vérifiés
                    </span>
                    <h2 className="font-brand text-2xl sm:text-3xl font-bold text-slate-100">
                      Témoignages de nos Apprenants
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((t) => (
                      <div key={t.id} className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                        <MessageSquareQuote className="w-5 h-5 text-[#D4AF37]" />
                        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed italic">
                          « {t.quote} »
                        </p>
                        <div className="pt-3 border-t border-zinc-900 text-xs">
                          <strong className="text-slate-100 block">{t.authorName}</strong>
                          <span className="text-zinc-400">{t.authorRole} · {t.courseTitle}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <CoachingSection />
            <FAQSection />
            <ContactSection />
          </div>
        )}

        {activeView === 'catalog' && (
          <CourseCatalog onOpenCheckout={(courseToBuy) => setCheckoutCourse(courseToBuy)} />
        )}

        {activeView === 'course-detail' && selectedCourseId && (
          <CourseDetailPage
            courseId={selectedCourseId}
            onOpenCheckout={(courseToBuy) => setCheckoutCourse(courseToBuy)}
          />
        )}

        {activeView === 'student-space' && (
          <StudentDashboard onOpenCertificateModal={(id) => setCertificateCourseId(id)} />
        )}

        {activeView === 'admin-space' && <AdminDashboard />}

        {activeView === 'coaching' && <CoachingSection />}

        {activeView === 'about' && (
          <div>
            <FaithAriolaStory />
            <DomainsSection />
          </div>
        )}

        {activeView === 'contact' && <ContactSection />}
      </main>

      <Footer />

      {checkoutCourse && (
        <CheckoutModal course={checkoutCourse} onClose={() => setCheckoutCourse(null)} />
      )}

      {certificateCourseId && (
        <CertificateModal courseId={certificateCourseId} onClose={() => setCertificateCourseId(null)} />
      )}

      <AuthModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
