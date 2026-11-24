/**
 * DJIFFA ACADEMY - Student Personal Space & Dashboard
 * Complete workspace: Courses, Resume, Resources (with signed cloud URLs), Exercises, Progress, Certificates, Purchases, Coaching, Profile
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { isSupabaseStorageRef, fetchProtectedSignedMediaUrl, safeExternalUrl } from '../lib/media';
import { resolveAssetImageUrl } from '../lib/assets';
import { getSupabaseAccessToken } from '../lib/supabase';
import {
  BookOpen,
  Award,
  FileText,
  CheckCircle,
  Download,
  CreditCard,
  User as UserIcon,
  HelpCircle,
  Play,
  Bell,
  Save,
  Cloud
} from 'lucide-react';

interface StudentDashboardProps {
  onOpenCertificateModal: (courseId: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onOpenCertificateModal }) => {
  const {
    currentUser,
    adminToken,
    supabaseReady,
    courses,
    orders,
    coachingRequests,
    notifications,
    markNotificationRead,
    navigateTo,
    getCourseProgress,
    updateUserProfile,
    syncCurrentStudentToCloud,
    openAuthModal,
    siteSettings
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'courses' | 'resources' | 'progress' | 'certificates' | 'orders' | 'coaching' | 'profile'
  >('courses');

  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profilePhone, setProfilePhone] = useState(currentUser?.phone || '');
  const [profileCountry, setProfileCountry] = useState(currentUser?.country || 'Bénin');
  const [profileSaved, setProfileSaved] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<string | null>(null);
  const [resourceStatus, setResourceStatus] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfilePhone(currentUser.phone || '');
      setProfileCountry(currentUser.country || 'Bénin');
    }
  }, [currentUser?.id, currentUser?.name, currentUser?.phone, currentUser?.country]);

  if (!currentUser) {
    return (
      <div className="py-20 px-4 text-center max-w-md mx-auto space-y-4">
        <UserIcon className="w-12 h-12 text-[#D4AF37] mx-auto" />
        <h2 className="font-brand text-2xl font-bold text-slate-100">
          Connectez-vous à votre Espace Apprenant
        </h2>
        <p className="text-xs text-zinc-400">
          Accédez à vos cours achetés, ressources téléchargeables, exercices, certificats et reçus.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => openAuthModal('student')}
            className="px-6 py-3 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs uppercase cursor-pointer"
          >
            Se connecter / Créer un compte
          </button>
          <button
            onClick={() => navigateTo('catalog')}
            className="px-5 py-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs font-semibold cursor-pointer"
          >
            Découvrir les formations
          </button>
        </div>
      </div>
    );
  }

  const enrolledCourses = courses.filter((c) => currentUser.enrolledCourseIds.includes(c.id));
  const userOrders = orders.filter((o) => o.userEmail === currentUser.email || o.userId === currentUser.id);
  const userCoaching = coachingRequests.filter((r) => r.userEmail === currentUser.email || r.userId === currentUser.id);
  const userNotifications = notifications.filter((n) => n.userId === 'all' || n.userId === currentUser.id);

  // Aggregate downloadable resources from all enrolled courses (keeping courseId for private signed URL resolution)
  const enrolledDownloads = enrolledCourses.flatMap((c) =>
    c.modules.flatMap((m) =>
      m.lessons.flatMap((l) =>
        (l.downloads || []).map((d) => ({ ...d, courseId: c.id, courseTitle: c.title, lessonTitle: l.title }))
      )
    )
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({ name: profileName, phone: profilePhone, country: profileCountry });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleCloudSync = async () => {
    setCloudSyncMsg('Synchronisation en cours...');
    const res = await syncCurrentStudentToCloud();
    setCloudSyncMsg(res.message);
    setTimeout(() => setCloudSyncMsg(null), 4500);
  };

  const handleResourceDownload = async (res: {
    name: string;
    url?: string;
    courseId: string;
    courseTitle: string;
    lessonTitle: string;
  }) => {
    const sbRef = isSupabaseStorageRef(res.url);
    if (sbRef) {
      setResourceStatus(`Préparation du téléchargement sécurisé pour « ${res.name} »...`);
      try {
        const supabaseToken = await getSupabaseAccessToken();
        const result = await fetchProtectedSignedMediaUrl({
          bucket: sbRef.bucket,
          path: sbRef.path,
          courseId: res.courseId,
          supabaseToken,
          adminToken
        });
        if (result.ok && result.signedUrl) {
          const a = document.createElement('a');
          a.href = result.signedUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.click();
          setResourceStatus(`Ouverture sécurisée de « ${res.name} ».`);
        } else {
          setResourceStatus(result.error || 'Ressource privée inaccessible.');
        }
      } catch {
        setResourceStatus('Erreur lors de la récupération du document cloud.');
      }
      setTimeout(() => setResourceStatus(null), 4000);
      return;
    }

    if (res.url) {
      const safeHref = safeExternalUrl(res.url);
      if (!safeHref) {
        setResourceStatus('Lien de ressource invalide ou non sécurisé.');
        setTimeout(() => setResourceStatus(null), 4000);
        return;
      }
      const a = document.createElement('a');
      a.href = safeHref;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }

    const blob = new Blob(
      [`DJIFFA ACADEMY - ${res.name}\nCours: ${res.courseTitle}\nLeçon: ${res.lessonTitle}`],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${res.name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-10 sm:py-16 bg-[#08080A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">

        {/* Welcome Header */}
        <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8C701E] flex items-center justify-center text-zinc-950 font-brand text-2xl font-extrabold shadow-md shrink-0">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                Espace Personnel Apprenant · {siteSettings.academyName}
              </span>
              <h1 className="font-brand text-2xl sm:text-3xl font-bold text-slate-100">
                Bienvenue, {currentUser.name}
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                {currentUser.email} {currentUser.country ? `· ${currentUser.country}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigateTo('catalog')}
              className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
            >
              Explorer le catalogue
            </button>
            <button
              onClick={() => navigateTo('coaching')}
              className="px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-xs font-bold text-zinc-950 transition-colors shadow-md cursor-pointer"
            >
              Demander un accompagnement
            </button>
          </div>
        </div>

        {/* Notifications Strip (if unread) */}
        {userNotifications.some((n) => !n.read) && (
          <div className="p-4 rounded-xl bg-zinc-950 border border-[#D4AF37]/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F3E5AB]">
              <Bell className="w-4 h-4 text-[#D4AF37]" />
              <span>Notifications de votre académie</span>
            </div>
            <div className="space-y-1.5">
              {userNotifications
                .filter((n) => !n.read)
                .slice(0, 3)
                .map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between gap-4 text-xs text-zinc-300 bg-zinc-900/60 p-2.5 rounded-lg"
                  >
                    <div>
                      <strong className="text-slate-100">{n.title} : </strong>
                      <span>{n.message}</span>
                    </div>
                    <button
                      onClick={() => markNotificationRead(n.id)}
                      className="text-[11px] text-[#D4AF37] hover:underline shrink-0 cursor-pointer"
                    >
                      Marquer lu
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Dashboard Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'courses' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Mes Formations ({enrolledCourses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('resources')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'resources' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ressources ({enrolledDownloads.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('progress')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'progress' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Progression & Devoirs</span>
          </button>

          <button
            onClick={() => setActiveTab('certificates')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'certificates' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Certificats ({currentUser.certificates.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'orders' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Achats & Reçus ({userOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('coaching')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'coaching' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Accompagnement ({userCoaching.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'profile' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Mes Informations</span>
          </button>
        </div>

        {/* Tab 1: My Enrolled Courses */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <h2 className="font-brand text-xl font-bold text-slate-100">Mes Formations Achetées</h2>

            {enrolledCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledCourses.map((c) => {
                  const prog = getCourseProgress(c.id);
                  const resumeLessonId = currentUser.lastAccessedLessonByCourse?.[c.id];
                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden flex flex-col justify-between hover:border-[#D4AF37]/50 transition-all shadow-lg"
                    >
                      <div className="aspect-[16/9] relative bg-zinc-900">
                        <img
                          src={resolveAssetImageUrl(c.coverImage)}
                          alt={c.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white tabular-nums">
                          <span className="font-mono">
                            {prog.completedCount}/{prog.totalCount} leçons
                          </span>
                          <span className="font-bold text-[#D4AF37]">{prog.percentage}%</span>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div>
                          <h3 className="font-brand text-base font-bold text-slate-100 line-clamp-2">{c.title}</h3>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{c.subtitle}</p>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-[#D4AF37]" style={{ width: `${prog.percentage}%` }} />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <button
                            onClick={() => navigateTo('course-detail', c.id)}
                            className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                          >
                            Programme
                          </button>

                          <button
                            onClick={() => navigateTo('player', c.id, resumeLessonId)}
                            className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>{resumeLessonId ? 'Reprendre ma leçon' : 'Commencer le cours'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
                <h3 className="font-brand text-lg font-bold text-slate-200">
                  Aucune formation achetée pour l’instant
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Découvrez nos programmes en création vidéo IA, mode virtuelle et cinéma pour débuter votre apprentissage.
                </p>
                <button
                  onClick={() => navigateTo('catalog')}
                  className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs uppercase cursor-pointer"
                >
                  Consulter le catalogue
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Downloadable Resources */}
        {activeTab === 'resources' && (
          <div className="space-y-6">
            <h2 className="font-brand text-xl font-bold text-slate-100">Mes Ressources Téléchargeables</h2>
            {resourceStatus && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200">
                {resourceStatus}
              </div>
            )}
            {enrolledDownloads.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrolledDownloads.map((res, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
                        {res.courseTitle}
                      </span>
                      <span className="text-xs font-bold text-slate-100 block mt-0.5">{res.name}</span>
                      <span className="text-[11px] text-zinc-400 block mt-0.5">
                        {res.description} · {res.type} ({res.size})
                      </span>
                    </div>
                    <button
                      onClick={() => handleResourceDownload(res)}
                      className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-[#D4AF37] hover:text-zinc-950 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Télécharger</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Vos PDF, prompts et modèles s’afficheront ici dès que vous aurez rejoint une formation.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Progress, Exercises & Evaluations */}
        {activeTab === 'progress' && (
          <div className="space-y-8">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h2 className="font-brand text-lg font-bold text-slate-100">Suivi Global d’Apprentissage</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block">Leçons complétées</span>
                  <span className="font-brand text-2xl font-bold text-[#D4AF37] tabular-nums mt-1 block">
                    {currentUser.completedLessonIds.length}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block">Devoirs soumis</span>
                  <span className="font-brand text-2xl font-bold text-[#D4AF37] tabular-nums mt-1 block">
                    {Object.keys(currentUser.submittedExercises).length}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[11px] text-zinc-400 block">Quiz / Évaluations</span>
                  <span className="font-brand text-2xl font-bold text-[#D4AF37] tabular-nums mt-1 block">
                    {Object.keys(currentUser.quizScores).length}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h3 className="font-brand text-lg font-bold text-slate-100">Historique de mes Devoirs</h3>
              {Object.keys(currentUser.submittedExercises).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(currentUser.submittedExercises).map(([lessonId, sub]) => {
                    const matchedCourse = courses.find((c) =>
                      c.modules.some((m) => m.lessons.some((l) => l.id === lessonId))
                    );
                    const matchedLesson = matchedCourse?.modules
                      .flatMap((m) => m.lessons)
                      .find((l) => l.id === lessonId);
                    return (
                      <div key={lessonId} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-[#F3E5AB] block">
                              {matchedLesson ? matchedLesson.title : `Leçon ${lessonId}`}
                            </span>
                            {matchedCourse && (
                              <span className="text-[10px] text-zinc-500">{matchedCourse.title}</span>
                            )}
                          </div>
                          <span className="text-zinc-500 font-mono text-[10px] shrink-0">
                            {new Date(sub.submittedAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-zinc-300 italic bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                          « {sub.submissionText} »
                        </p>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-emerald-400">Statut : Enregistré</span>
                          {safeExternalUrl(sub.link) && (
                            <a
                              href={safeExternalUrl(sub.link)!}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-[#D4AF37] hover:underline"
                            >
                              Voir le lien fourni →
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Aucun devoir soumis pour le moment.</p>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h3 className="font-brand text-lg font-bold text-slate-100">Résultats de mes Quiz & Évaluations</h3>
              {Object.keys(currentUser.quizScores).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(currentUser.quizScores).map(([lessonId, qRes]) => {
                    const isFinalExam = lessonId.startsWith('final-');
                    const matchedCourse = isFinalExam
                      ? courses.find((c) => c.id === lessonId.replace(/^final-/, ''))
                      : courses.find((c) =>
                          c.modules.some((m) => m.lessons.some((l) => l.id === lessonId))
                        );
                    const matchedLesson = matchedCourse?.modules
                      .flatMap((m) => m.lessons)
                      .find((l) => l.id === lessonId);
                    return (
                      <div key={lessonId} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-semibold text-slate-100 block">
                            {isFinalExam
                              ? `Examen Final — ${matchedCourse?.title || 'Formation'}`
                              : matchedLesson
                              ? matchedLesson.title
                              : `Évaluation ${lessonId}`}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {new Date(qRes.completedAt).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-[#D4AF37] block">
                            {qRes.score} / {qRes.total}
                          </span>
                          <span className={`text-[10px] font-semibold ${qRes.passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {qRes.passed ? 'Validé' : 'À revoir'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Aucun quiz réalisé pour le moment.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Certificates */}
        {activeTab === 'certificates' && (
          <div className="space-y-6">
            <h2 className="font-brand text-xl font-bold text-slate-100">Mes Certificats Officiels</h2>
            {currentUser.certificates.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {currentUser.certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-6 rounded-2xl bg-zinc-950 border border-[#D4AF37]/40 shadow-xl space-y-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37]">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
                          Certificat d’Excellence
                        </span>
                        <h3 className="font-brand text-base font-bold text-slate-100">{cert.courseTitle}</h3>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs space-y-1">
                      <div className="flex justify-between text-zinc-400">
                        <span>Délivré à :</span>
                        <span className="text-slate-200 font-semibold">{cert.studentName}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Date :</span>
                        <span className="text-slate-200">{cert.issuedDate}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Code de vérification :</span>
                        <span className="font-mono text-[#D4AF37]">{cert.verificationCode}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onOpenCertificateModal(cert.courseId)}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase cursor-pointer"
                    >
                      Afficher & Télécharger le Certificat
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <Award className="w-10 h-10 text-zinc-600 mx-auto" />
                <h3 className="font-brand text-base font-bold text-slate-200">
                  Aucun certificat obtenu pour l’instant
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Complétez 100% des leçons d’une formation pour recevoir automatiquement votre certificat vérifié.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Orders & Receipts */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <h2 className="font-brand text-xl font-bold text-slate-100">Historique d’Achats & Reçus</h2>
            {userOrders.length > 0 ? (
              <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                      <tr>
                        <th className="p-4">Référence</th>
                        <th className="p-4">Formation</th>
                        <th className="p-4">Méthode</th>
                        <th className="p-4">Montant</th>
                        <th className="p-4">Statut</th>
                        <th className="p-4">Reçu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {userOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-zinc-900/40">
                          <td className="p-4 font-mono font-bold text-[#F3E5AB]">
                            {ord.reference}
                            {ord.isDemoTransaction && (
                              <span className="block text-[9px] text-amber-400 uppercase">Test / Démo</span>
                            )}
                          </td>
                          <td className="p-4 font-medium text-slate-200">{ord.courseTitle}</td>
                          <td className="p-4 text-zinc-400">
                            {ord.paymentMethod.toUpperCase()} ({ord.paymentProvider})
                          </td>
                          <td className="p-4 font-mono text-[#D4AF37] tabular-nums font-bold">
                            {ord.amount.toLocaleString('fr-FR')} {ord.currency}
                          </td>
                          <td className="p-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                                ord.status === 'confirmed'
                                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                                  : ord.status === 'pending' || ord.status === 'processing'
                                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                                  : 'bg-red-950 text-red-400 border-red-800'
                              }`}
                            >
                              {ord.status === 'confirmed'
                                ? 'Confirmé (Payé)'
                                : ord.status === 'pending'
                                ? 'En attente'
                                : ord.status === 'processing'
                                ? 'En cours'
                                : ord.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => window.print()}
                              className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Imprimer</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Aucune transaction enregistrée.</p>
            )}
          </div>
        )}

        {/* Tab 6: Coaching */}
        {activeTab === 'coaching' && (
          <div className="space-y-6">
            <h2 className="font-brand text-xl font-bold text-slate-100">Mes Demandes d’Accompagnement</h2>
            {userCoaching.length > 0 ? (
              <div className="space-y-4">
                {userCoaching.map((req) => (
                  <div key={req.id} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-brand font-bold text-base text-slate-100">{req.programTitle}</span>
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase self-start sm:self-auto ${
                          req.status === 'validated' || req.status === 'scheduled'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        Statut : {req.status === 'validated' ? 'Validé par la Directrice' : req.status}
                      </span>
                    </div>
                    <p className="text-zinc-400 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                      <strong>Votre besoin :</strong> {req.needDescription}
                    </p>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-zinc-900 gap-2">
                      <span>Date souhaitée : {req.preferredDate}</span>
                      {safeExternalUrl(req.meetingLink) && (
                        <a
                          href={safeExternalUrl(req.meetingLink)!}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="px-3 py-1 rounded bg-[#D4AF37] text-zinc-950 font-bold hover:bg-[#E5C158]"
                        >
                          Lien Visio →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                <p className="text-xs text-zinc-400">Vous n’avez aucune demande d’accompagnement active.</p>
                <button
                  onClick={() => navigateTo('coaching')}
                  className="px-4 py-2 bg-[#D4AF37] text-zinc-950 font-bold text-xs rounded-md cursor-pointer"
                >
                  Faire une demande d’accompagnement
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Personal Profile & Cloud Sync */}
        {activeTab === 'profile' && (
          <div className="max-w-xl p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
            <h2 className="font-brand text-xl font-bold text-slate-100">Mes Informations Personnelles</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Nom complet (affiché sur vos certificats)</label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Adresse email</label>
                <input
                  type="email"
                  disabled
                  value={currentUser.email}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800 text-zinc-500 cursor-not-allowed"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Téléphone WhatsApp</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+229 97 00 00 00"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Pays</label>
                  <input
                    type="text"
                    value={profileCountry}
                    onChange={(e) => setProfileCountry(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
              {profileSaved && (
                <p className="text-xs text-emerald-400 font-medium">✓ Informations mises à jour.</p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Enregistrer mes modifications</span>
                </button>

                {supabaseReady && (
                  <button
                    type="button"
                    onClick={handleCloudSync}
                    className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Synchroniser ma progression cloud</span>
                  </button>
                )}
              </div>
              {cloudSyncMsg && (
                <p className="text-xs text-[#F3E5AB] bg-zinc-900 p-2.5 rounded-lg border border-zinc-800">
                  {cloudSyncMsg}
                </p>
              )}
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
