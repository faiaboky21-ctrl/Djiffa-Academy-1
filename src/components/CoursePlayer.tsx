/**
 * DJIFFA ACADEMY - Pedagogical Course Player & Learning Interface
 * Enforces enrollment protection, saves last accessed lesson for seamless resume, and supports videos/PDF/exercises/quizzes
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Lesson, CourseModule } from '../types';
import { resolveVideoSource, isSupabaseStorageRef, fetchProtectedSignedMediaUrl, safeExternalUrl } from '../lib/media';
import { resolveAssetImageUrl } from '../lib/assets';
import { getSupabaseAccessToken } from '../lib/supabase';
import { sanitizeLessonHtml } from '../lib/sanitizeHtml';
import {
  ArrowLeft,
  CheckCircle,
  Play,
  Pause,
  Download,
  Award,
  ChevronRight,
  ChevronLeft,
  Send,
  HelpCircle,
  FileText,
  RotateCcw,
  Volume2,
  Maximize2,
  Sparkles,
  BookOpen,
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CoursePlayerProps {
  courseId: string;
  initialLessonId?: string | null;
  onOpenCertificateModal: (courseId: string) => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  courseId,
  initialLessonId,
  onOpenCertificateModal
}) => {
  const {
    courses,
    currentUser,
    adminToken,
    isEnrolled,
    navigateTo,
    toggleLessonComplete,
    setLastAccessedLesson,
    submitExercise,
    submitQuizResult,
    getCourseProgress,
    getCourseCertificateEligibility
  } = useApp();

  const course = courses.find((c) => c.id === courseId) || courses[0];
  const hasAccess = isEnrolled(course.id);

  // Flatten all lessons
  const allLessons: { lesson: Lesson; module: CourseModule }[] = course.modules.flatMap((m) =>
    m.lessons.map((l) => ({ lesson: l, module: m }))
  );

  const [currentLessonIndex, setCurrentLessonIndex] = useState(() => {
    const savedResumeId = currentUser?.lastAccessedLessonByCourse?.[course.id];
    const targetId = initialLessonId || savedResumeId;
    if (targetId) {
      const idx = allLessons.findIndex((item) => item.lesson.id === targetId);
      if (idx !== -1) return idx;
    }
    if (currentUser) {
      const firstIncomplete = allLessons.findIndex(
        (item) => !currentUser.completedLessonIds.includes(item.lesson.id)
      );
      if (firstIncomplete !== -1) return firstIncomplete;
    }
    return 0;
  });

  const [activeTab, setActiveTab] = useState<'content' | 'exercise' | 'quiz' | 'resources' | 'final-quiz'>('content');
  const [isPlaying, setIsPlaying] = useState(false);
  const [exerciseText, setExerciseText] = useState('');
  const [exerciseLink, setExerciseLink] = useState('');
  const [exerciseSubmitted, setExerciseSubmitted] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

  const [signedVideoUrl, setSignedVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; total: number } | null>(null);

  const finalQuizId = `final-${course.id}`;
  const savedFinalQuiz = currentUser?.quizScores?.[finalQuizId];
  const [finalAnswers, setFinalAnswers] = useState<Record<string, number>>({});
  const [finalQuizSubmitted, setFinalQuizSubmitted] = useState(Boolean(savedFinalQuiz));
  const [finalQuizScore, setFinalQuizScore] = useState<{ score: number; total: number } | null>(
    savedFinalQuiz ? { score: savedFinalQuiz.score, total: savedFinalQuiz.total } : null
  );

  const currentItem = allLessons[currentLessonIndex] || allLessons[0];
  const currentLesson = currentItem?.lesson;
  const currentModule = currentItem?.module;

  useEffect(() => {
    const savedResumeId = currentUser?.lastAccessedLessonByCourse?.[course.id];
    const targetId = initialLessonId || savedResumeId;
    if (targetId) {
      const idx = allLessons.findIndex((item) => item.lesson.id === targetId);
      if (idx !== -1) {
        setCurrentLessonIndex(idx);
        return;
      }
    }
    if (currentUser) {
      const firstIncomplete = allLessons.findIndex(
        (item) => !currentUser.completedLessonIds.includes(item.lesson.id)
      );
      setCurrentLessonIndex(firstIncomplete !== -1 ? firstIncomplete : 0);
    } else {
      setCurrentLessonIndex(0);
    }
  }, [courseId, initialLessonId]);

  useEffect(() => {
    if (!currentLesson) return;
    const savedEx = currentUser?.submittedExercises?.[currentLesson.id];
    setExerciseText(savedEx?.submissionText || '');
    setExerciseLink(savedEx?.link || '');
    setExerciseSubmitted(Boolean(savedEx));

    const savedQuiz = currentUser?.quizScores?.[currentLesson.id];
    setSelectedAnswers({});
    setQuizSubmitted(Boolean(savedQuiz));
    setQuizScore(savedQuiz ? { score: savedQuiz.score, total: savedQuiz.total } : null);
    setDownloadFeedback(null);
    setVideoError(null);
  }, [currentLesson?.id]);

  useEffect(() => {
    if (hasAccess && currentLesson) {
      setLastAccessedLesson(course.id, currentLesson.id);
    }
  }, [hasAccess, course.id, currentLesson?.id]);

  const resolvedVideo = resolveVideoSource(currentLesson?.videoUrl);

  const loadSignedVideo = useCallback(async () => {
    if (resolvedVideo.kind !== 'supabase_storage') {
      setSignedVideoUrl(null);
      setVideoLoading(false);
      return;
    }
    setVideoLoading(true);
    setVideoError(null);
    try {
      const supabaseToken = await getSupabaseAccessToken();
      const res = await fetchProtectedSignedMediaUrl({
        bucket: 'course-videos',
        path: resolvedVideo.path,
        courseId: course.id,
        supabaseToken,
        adminToken
      });
      if (res.ok && res.signedUrl) {
        setSignedVideoUrl(res.signedUrl);
      } else {
        setSignedVideoUrl(null);
        setVideoError(res.error || 'Impossible de déverrouiller la vidéo privée sur Supabase Storage.');
      }
    } catch {
      setSignedVideoUrl(null);
      setVideoError('Erreur réseau lors de la récupération du lien vidéo sécurisé.');
    } finally {
      setVideoLoading(false);
    }
  }, [resolvedVideo.kind, resolvedVideo.kind === 'supabase_storage' ? resolvedVideo.path : '', course.id, adminToken]);

  useEffect(() => {
    if (hasAccess && resolvedVideo.kind === 'supabase_storage') {
      loadSignedVideo();
    } else {
      setSignedVideoUrl(null);
      setVideoLoading(false);
    }
  }, [hasAccess, currentLesson?.id, currentLesson?.videoUrl, loadSignedVideo]);

  // Strict Enrollment Protection Gate
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#08080A] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-zinc-900 border border-[#D4AF37]/50 mx-auto flex items-center justify-center text-[#D4AF37]">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold block">
              Contenu Privé Protégé
            </span>
            <h2 className="font-brand text-2xl font-bold text-slate-100">
              Accès réservé aux apprenants inscrits
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Vous n’avez pas encore acquis la formation « {course.title} ». Achetez cette formation individuellement pour débloquer les vidéos, supports PDF, exercices et votre certificat.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigateTo('course-detail', course.id)}
              className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase cursor-pointer"
            >
              Découvrir & Acheter la formation
            </button>
            <button
              onClick={() => navigateTo('catalog')}
              className="px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Retour au catalogue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentLesson || !currentModule) {
    return (
      <div className="min-h-screen bg-[#08080A] text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h2 className="font-brand text-xl font-bold">Programme en cours de préparation</h2>
          <p className="text-xs text-zinc-400">L’équipe pédagogique ajoute progressivement les leçons de ce cours.</p>
          <button
            onClick={() => navigateTo('student-space')}
            className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer"
          >
            Retour à mon espace
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = currentUser ? currentUser.completedLessonIds.includes(currentLesson.id) : false;
  const progress = getCourseProgress(course.id);
  const certEligibility = getCourseCertificateEligibility(course.id);

  const handleNextLesson = () => {
    if (currentLessonIndex < allLessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
      setActiveTab('content');
      setIsPlaying(false);
      setExerciseSubmitted(false);
      setQuizSubmitted(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
      setActiveTab('content');
      setIsPlaying(false);
      setExerciseSubmitted(false);
      setQuizSubmitted(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleToggleComplete = () => {
    toggleLessonComplete(course.id, currentLesson.id);
    if (!isCompleted && progress.percentage >= 85) {
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSubmitExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseText.trim()) return;
    submitExercise(currentLesson.id, exerciseText, exerciseLink);
    setExerciseSubmitted(true);
  };

  const handleSubmitQuiz = () => {
    if (!currentLesson.quiz || currentLesson.quiz.length === 0) return;
    let correctCount = 0;
    currentLesson.quiz.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });

    setQuizScore({ score: correctCount, total: currentLesson.quiz.length });
    setQuizSubmitted(true);
    submitQuizResult(currentLesson.id, correctCount, currentLesson.quiz.length);
  };

  const handleSubmitFinalQuiz = () => {
    if (!course.finalQuiz || course.finalQuiz.length === 0) return;
    let correctCount = 0;
    course.finalQuiz.forEach((q) => {
      if (finalAnswers[q.id] === q.correctIndex) {
        correctCount++;
      }
    });
    setFinalQuizScore({ score: correctCount, total: course.finalQuiz.length });
    setFinalQuizSubmitted(true);
    submitQuizResult(finalQuizId, correctCount, course.finalQuiz.length);
  };

  const handleDownloadResource = async (resName: string, url?: string) => {
    const sbRef = isSupabaseStorageRef(url);
    if (sbRef) {
      setDownloadFeedback(`Génération du lien sécurisé pour « ${resName} »...`);
      try {
        const supabaseToken = await getSupabaseAccessToken();
        const res = await fetchProtectedSignedMediaUrl({
          bucket: sbRef.bucket,
          path: sbRef.path,
          courseId: course.id,
          supabaseToken,
          adminToken
        });
        if (res.ok && res.signedUrl) {
          const link = document.createElement('a');
          link.href = res.signedUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.click();
          setDownloadFeedback(`Ouverture sécurisée de « ${resName} ».`);
        } else {
          setDownloadFeedback(res.error || 'Accès refusé ou fichier introuvable dans Supabase Storage.');
        }
      } catch {
        setDownloadFeedback('Erreur réseau lors de la récupération du PDF sécurisé.');
      }
      setTimeout(() => setDownloadFeedback(null), 4000);
      return;
    }

    if (url) {
      const safeHref = safeExternalUrl(url);
      if (!safeHref) {
        setDownloadFeedback('Lien de ressource invalide (seuls les liens http/https sont autorisés).');
        setTimeout(() => setDownloadFeedback(null), 3500);
        return;
      }
      const link = document.createElement('a');
      link.href = safeHref;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      setDownloadFeedback(`Ouverture de la ressource « ${resName} ».`);
      setTimeout(() => setDownloadFeedback(null), 3500);
      return;
    }
    const content = `DJIFFA ACADEMY — Ressource Pédagogique\nFormation : ${course.title}\nLeçon : ${currentLesson.title}\nFichier : ${resName}\n\n(Support de démonstration prêt à être relié à votre stockage cloud sécurisé.)`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${resName.replace(/\.[^/.]+$/, '')}_DJIFFA.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
    setDownloadFeedback(`Document « ${resName} » téléchargé.`);
    setTimeout(() => setDownloadFeedback(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#08080A] text-slate-100 flex flex-col">
      
      {/* Top Learning Bar */}
      <div className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateTo('student-space')}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            title="Retour à mon espace"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="hidden sm:block">
            <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
              {course.title}
            </span>
            <span className="text-xs text-zinc-300 font-medium">
              {currentModule.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-end">
          <div className="hidden md:flex flex-col items-end w-44">
            <span className="text-[10px] text-zinc-400 font-mono tabular-nums">
              Progression : {progress.percentage}% ({progress.completedCount}/{progress.totalCount})
            </span>
            <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-[#D4AF37] to-[#E5C158] transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>

          {course.certificateEligible && certEligibility.eligible && (
            <button
              onClick={() => onOpenCertificateModal(course.id)}
              className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-[11px] sm:text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline sm:inline">Certificat</span>
              <span className="hidden sm:inline">Officiel</span>
            </button>
          )}

          {course.certificateEligible &&
            !certEligibility.eligible &&
            progress.percentage === 100 &&
            certEligibility.finalQuizRequired &&
            !certEligibility.finalQuizPassed && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('final-quiz');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-950/70 border border-[#D4AF37]/60 text-[#F3E5AB] font-semibold text-[11px] sm:text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Examen Final Requis</span>
              </button>
            )}

          <button
            onClick={handleToggleComplete}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isCompleted
                ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
            }`}
          >
            <CheckCircle className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCompleted ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span>{isCompleted ? 'Terminée' : 'Marquer terminée'}</span>
          </button>
        </div>
      </div>

      {/* Main Learning Grid */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Stage Area (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Video Stage */}
          <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-2xl aspect-[16/9]">
            {resolvedVideo.kind === 'supabase_storage' ? (
              videoLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-xs text-zinc-300 bg-zinc-950">
                  <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                  <span>Chargement sécurisé du flux vidéo depuis le cloud privé...</span>
                </div>
              ) : videoError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-zinc-950">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-xs text-red-300 max-w-md">{videoError}</p>
                  <button
                    onClick={loadSignedVideo}
                    className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer"
                  >
                    Réessayer le chargement
                  </button>
                </div>
              ) : signedVideoUrl ? (
                <video
                  key={signedVideoUrl}
                  src={signedVideoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  onError={() =>
                    setVideoError('La lecture de ce fichier vidéo a échoué sur cet appareil. Vérifiez le format MP4/H.264.')
                  }
                  className="w-full h-full object-contain bg-black"
                />
              ) : null
            ) : resolvedVideo.kind === 'iframe' ? (
              <div className="relative w-full h-full">
                <iframe
                  key={resolvedVideo.embedUrl}
                  src={resolvedVideo.embedUrl}
                  title={currentLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/75 border border-zinc-700 text-[10px] text-zinc-300 pointer-events-none">
                  {resolvedVideo.providerLabel}
                </span>
              </div>
            ) : resolvedVideo.kind === 'video' ? (
              videoError ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-zinc-950">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                  <p className="text-xs text-red-300 max-w-md">{videoError}</p>
                  <button
                    onClick={() => setVideoError(null)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    Recharger le lecteur
                  </button>
                </div>
              ) : (
                <video
                  key={resolvedVideo.url}
                  src={resolvedVideo.url}
                  controls
                  playsInline
                  preload="metadata"
                  controlsList="nodownload"
                  onError={() =>
                    setVideoError('Impossible de lire le flux vidéo externe. Vérifiez que le lien pointe vers un MP4/WebM accessible.')
                  }
                  className="w-full h-full object-contain bg-black"
                />
              )
            ) : (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <img
                    src={resolveAssetImageUrl(course.coverImage)}
                    alt={currentLesson.title}
                    className="w-full h-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="relative z-10 w-20 h-20 rounded-full bg-black/70 hover:bg-[#D4AF37] text-white hover:text-zinc-950 border border-[#D4AF37]/60 flex items-center justify-center shadow-2xl hover:scale-105 transition-all cursor-pointer"
                    aria-label={isPlaying ? 'Mettre en pause' : 'Lire la leçon'}
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8 fill-current" />
                    ) : (
                      <Play className="w-8 h-8 fill-current ml-1" />
                    )}
                  </button>
                </div>

                <div className="absolute top-4 left-4 z-10 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-700/60 text-xs text-slate-200">
                  <span>{isPlaying ? 'Lecture aperçu studio (connecter URL vidéo dans l’Admin)' : 'Aperçu pédagogique DJIFFA ACADEMY'}</span>
                </div>

                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 flex items-center justify-between text-xs text-zinc-300">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-[#D4AF37] cursor-pointer">
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-[11px] tabular-nums">
                      <span>{isPlaying ? '04:12' : '00:00'}</span>
                      <span>/</span>
                      <span>{currentLesson.duration}</span>
                    </div>
                  </div>
                  <div className="flex-1 mx-4 h-1 bg-zinc-700/60 rounded-full overflow-hidden">
                    <div className={`h-full bg-[#D4AF37] transition-all ${isPlaying ? 'w-1/2' : 'w-0'}`} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-zinc-400" />
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-zinc-800">1080p</span>
                    <Maximize2 className="w-4 h-4 text-zinc-400" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Lesson Title & Prev/Next */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                {currentModule.title}
              </span>
              <h1 className="font-brand text-xl sm:text-2xl font-bold text-slate-100 mt-0.5">
                {currentLesson.title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevLesson}
                disabled={currentLessonIndex === 0}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Précédent</span>
              </button>

              <button
                onClick={handleNextLesson}
                disabled={currentLessonIndex === allLessons.length - 1}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
              >
                <span>Suivant</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lesson Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                activeTab === 'content' ? 'bg-zinc-800 text-[#F3E5AB]' : 'text-zinc-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Notes de cours</span>
            </button>

            {currentLesson.exercise && (
              <button
                onClick={() => setActiveTab('exercise')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'exercise' ? 'bg-zinc-800 text-[#F3E5AB]' : 'text-zinc-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Exercice Pratique</span>
              </button>
            )}

            {currentLesson.quiz && currentLesson.quiz.length > 0 && (
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'quiz' ? 'bg-zinc-800 text-[#F3E5AB]' : 'text-zinc-400 hover:text-slate-200'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Évaluation & Quiz</span>
              </button>
            )}

            {currentLesson.downloads && currentLesson.downloads.length > 0 && (
              <button
                onClick={() => setActiveTab('resources')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'resources' ? 'bg-zinc-800 text-[#F3E5AB]' : 'text-zinc-400 hover:text-slate-200'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Téléchargements ({currentLesson.downloads.length})</span>
              </button>
            )}

            {course.finalQuiz && course.finalQuiz.length > 0 && (
              <button
                onClick={() => setActiveTab('final-quiz')}
                className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'final-quiz' ? 'bg-zinc-800 text-[#F3E5AB]' : 'text-zinc-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Examen Final ({course.finalQuiz.length})</span>
              </button>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === 'content' && (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-6">
              <div
                className="prose prose-invert max-w-none text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-3"
                dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(currentLesson.contentHtml) }}
              />
              {currentLesson.keyTakeaways && currentLesson.keyTakeaways.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-2.5">
                  <span className="text-xs font-semibold text-[#F3E5AB] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    À retenir pour votre pratique :
                  </span>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {currentLesson.keyTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#D4AF37] leading-none mt-0.5 font-bold">✓</span>
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'exercise' && currentLesson.exercise && (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-6">
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                  Mise en Situation Réelle
                </span>
                <h3 className="font-brand text-lg font-bold text-slate-100">{currentLesson.exercise.title}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">{currentLesson.exercise.instructions}</p>
              </div>

              <form onSubmit={handleSubmitExercise} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-medium text-slate-200 block mb-1">
                    Votre rendu textuel ou prompts utilisés *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={exerciseText}
                    onChange={(e) => setExerciseText(e.target.value)}
                    placeholder="Collez ici votre concept, votre découpage de scènes ou les prompts testés..."
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-100 placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200 block mb-1">
                    Lien vers votre création vidéo ou dossier (Optionnel)
                  </label>
                  <input
                    type="url"
                    value={exerciseLink}
                    onChange={(e) => setExerciseLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-100 placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500">Votre devoir est archivé dans votre espace personnel.</span>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Soumettre mon devoir</span>
                  </button>
                </div>
              </form>

              {exerciseSubmitted && (
                <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-600/50 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Devoir enregistré avec succès !</span>
                  </div>
                  <div className="text-xs text-zinc-300">
                    <p className="font-semibold text-[#F3E5AB] mb-1">Correction type de Faith Ariola :</p>
                    <p className="italic">{currentLesson.exercise.modelCorrection}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'quiz' && currentLesson.quiz && (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-6">
              <div className="space-y-1">
                <h3 className="font-brand text-lg font-bold text-slate-100">Évaluation des Connaissances</h3>
                <p className="text-xs text-zinc-400">
                  Répondez aux questions pour valider ce module et progresser vers votre certificat.
                </p>
              </div>
              <div className="space-y-6">
                {currentLesson.quiz.map((q, qIndex) => (
                  <div key={q.id} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                    <span className="text-xs font-semibold text-slate-200 block">
                      {qIndex + 1}. {q.question}
                    </span>
                    <div className="space-y-2">
                      {q.options.map((opt, optIndex) => {
                        const isSelected = selectedAnswers[q.id] === optIndex;
                        const isCorrect = q.correctIndex === optIndex;
                        let optionClass = 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700';

                        if (quizSubmitted) {
                          if (isCorrect) optionClass = 'border-emerald-500 bg-emerald-950/50 text-emerald-300';
                          else if (isSelected && !isCorrect) optionClass = 'border-red-500 bg-red-950/50 text-red-300';
                        } else if (isSelected) {
                          optionClass = 'border-[#D4AF37] bg-[#D4AF37]/10 text-white font-medium';
                        }

                        return (
                          <button
                            key={optIndex}
                            type="button"
                            onClick={() => {
                              if (!quizSubmitted) {
                                setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIndex }));
                              }
                            }}
                            className={`w-full text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between cursor-pointer ${optionClass}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && (
                      <p className="text-[11px] text-zinc-400 pt-1">
                        <strong>Explication :</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {!quizSubmitted ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={Object.keys(selectedAnswers).length < currentLesson.quiz.length}
                  className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
                >
                  Valider mes réponses
                </button>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-xs">
                    <span className="font-bold text-slate-100">
                      Score : {quizScore?.score} / {quizScore?.total}
                    </span>
                    <span className="text-zinc-400 ml-2">
                      ({quizScore && quizScore.score / quizScore.total >= 0.7 ? 'Validé avec succès' : 'À perfectionner'})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setSelectedAnswers({});
                    }}
                    className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Recommencer</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'resources' && currentLesson.downloads && (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h3 className="font-brand text-lg font-bold text-slate-100 flex items-center gap-2">
                <Download className="w-4 h-4 text-[#D4AF37]" />
                <span>Documents & Outils Téléchargeables</span>
              </h3>
              {downloadFeedback && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-300">
                  {downloadFeedback}
                </div>
              )}
              <div className="space-y-3">
                {currentLesson.downloads.map((res, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-100 block">{res.name}</span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        {res.description} · Format {res.type} ({res.size})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownloadResource(res.name, res.url)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'final-quiz' && course.finalQuiz && course.finalQuiz.length > 0 && (
            <div className="p-6 rounded-2xl bg-zinc-950 border border-[#D4AF37]/40 space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
                  Validation Finale · {course.title}
                </span>
                <h3 className="font-brand text-lg font-bold text-slate-100">Examen Final du Programme</h3>
                <p className="text-xs text-zinc-400">
                  Évaluez votre maîtrise globale des concepts du programme ({course.finalQuiz.length} question(s)).
                </p>
              </div>
              <div className="space-y-6">
                {course.finalQuiz.map((q, qIndex) => (
                  <div key={q.id} className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                    <span className="text-xs font-semibold text-slate-200 block">
                      {qIndex + 1}. {q.question}
                    </span>
                    <div className="space-y-2">
                      {q.options.map((opt, optIndex) => {
                        const isSelected = finalAnswers[q.id] === optIndex;
                        const isCorrect = q.correctIndex === optIndex;
                        let optionClass = 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-700';

                        if (finalQuizSubmitted) {
                          if (isCorrect) optionClass = 'border-emerald-500 bg-emerald-950/50 text-emerald-300';
                          else if (isSelected && !isCorrect) optionClass = 'border-red-500 bg-red-950/50 text-red-300';
                        } else if (isSelected) {
                          optionClass = 'border-[#D4AF37] bg-[#D4AF37]/10 text-white font-medium';
                        }

                        return (
                          <button
                            key={optIndex}
                            type="button"
                            onClick={() => {
                              if (!finalQuizSubmitted) {
                                setFinalAnswers((prev) => ({ ...prev, [q.id]: optIndex }));
                              }
                            }}
                            className={`w-full text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between cursor-pointer ${optionClass}`}
                          >
                            <span>{opt}</span>
                            {finalQuizSubmitted && isCorrect && (
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {finalQuizSubmitted && (
                      <p className="text-[11px] text-zinc-400 pt-1">
                        <strong>Explication :</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {!finalQuizSubmitted ? (
                <button
                  onClick={handleSubmitFinalQuiz}
                  disabled={Object.keys(finalAnswers).length < course.finalQuiz.length}
                  className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer"
                >
                  Valider l’Examen Final
                </button>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-xs">
                    <span className="font-bold text-slate-100">
                      Score Final : {finalQuizScore?.score} / {finalQuizScore?.total}
                    </span>
                    <span className="text-zinc-400 ml-2">
                      ({finalQuizScore && finalQuizScore.score / finalQuizScore.total >= 0.7
                        ? 'Examen réussi'
                        : 'À perfectionner'})
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setFinalQuizSubmitted(false);
                      setFinalAnswers({});
                    }}
                    className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Recommencer</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Right Sidebar: Course Curriculum */}
        <div className="lg:col-span-4 sticky top-20 rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Sommaire du Cours</span>
            <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
              {progress.completedCount}/{progress.totalCount} leçons
            </span>
          </div>

          <div className="max-h-[600px] overflow-y-auto divide-y divide-zinc-900 p-2">
            {course.modules.map((mod) => (
              <div key={mod.id} className="py-2">
                <div className="px-3 py-1 text-[11px] uppercase tracking-wider font-semibold text-[#D4AF37]">
                  Module {mod.order} · {mod.title.split(':')[1]?.trim() || mod.title}
                </div>
                <div className="space-y-1 mt-1">
                  {mod.lessons.map((lesson) => {
                    const active = lesson.id === currentLesson.id;
                    const done = currentUser?.completedLessonIds.includes(lesson.id);
                    const lessonGlobalIndex = allLessons.findIndex((item) => item.lesson.id === lesson.id);

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          setCurrentLessonIndex(lessonGlobalIndex);
                          setActiveTab('content');
                          setIsPlaying(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`w-full p-2.5 rounded-lg text-left text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#F3E5AB]'
                            : 'hover:bg-zinc-900/80 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <CheckCircle className={`w-3.5 h-3.5 shrink-0 ${done ? 'text-emerald-400' : 'text-zinc-600'}`} />
                          <span className="truncate">{lesson.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 shrink-0">{lesson.duration}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {course.finalQuiz && course.finalQuiz.length > 0 && (
            <div className="p-3 border-t border-zinc-800 bg-zinc-900/40">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('final-quiz');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                  activeTab === 'final-quiz'
                    ? 'bg-[#D4AF37] text-zinc-950 font-bold'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-[#F3E5AB] border border-[#D4AF37]/30'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  <span>Examen Final du Programme</span>
                </span>
                <span className="text-[10px] font-mono">{course.finalQuiz.length} Q</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
