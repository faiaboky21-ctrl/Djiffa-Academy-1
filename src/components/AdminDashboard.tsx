/**
 * DJIFFA ACADEMY - Secure Administrative Dashboard
 * Reserved for Director Faith Ariola (verified via /api/auth/admin-verify)
 * Manages courses, curriculum modules/lessons, domains, students, orders, promos, coaching, agency logo, testimonials, and payment status
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Course, CourseModule, Lesson } from '../types';
import { getSupabaseAccessToken } from '../lib/supabase';
import { createPreMigrationBackup, loadStoredBackupMeta } from '../lib/migration';
import { LaunchCenter } from './LaunchCenter';
import {
  ShieldCheck,
  BookOpen,
  DollarSign,
  Users,
  HelpCircle,
  Plus,
  Edit3,
  Trash2,
  X,
  Key,
  TrendingUp,
  FileText,
  Tag,
  Image as ImageIcon,
  Layers,
  MessageSquareQuote,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  UploadCloud,
  Database,
  RotateCcw,
  Rocket
} from 'lucide-react';

const escapeHtmlText = (str: string) =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const AdminDashboard: React.FC = () => {
  const {
    courses,
    domains,
    promoCodes,
    siteSettings,
    coachingPrograms,
    testimonials,
    students,
    orders,
    coachingRequests,
    paymentConfig,
    infraStatus,
    adminToken,
    formatPrice,
    saveCourse,
    deleteCourse,
    saveDomain,
    deleteDomain,
    savePromoCode,
    deletePromoCode,
    saveCoachingProgram,
    addTestimonial,
    deleteTestimonial,
    updateSiteSettings,
    updateOrderStatus,
    refundOrderServer,
    updateCoachingStatus,
    grantManualCourseAccess,
    revokeCourseAccess,
    refreshServerPaymentStatus,
    migrateLocalCatalogToCloud,
    refreshSupabaseAdminData,
    currentUser,
    adminSessionExpiredNotice,
    dismissAdminSessionExpiredNotice,
    openAuthModal
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'launch-center' | 'courses' | 'students' | 'orders' | 'coaching' | 'settings'
  >('overview');

  // Confirmation state for destructive deletes
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Course editing state
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newModTitle, setNewModTitle] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [lessonDraftByMod, setLessonDraftByMod] = useState<
    Record<
      string,
      {
        title: string;
        duration: string;
        videoUrl: string;
        summary: string;
        pdfName: string;
        pdfUrl: string;
        exTitle: string;
        exInstructions: string;
        exCorrection: string;
      }
    >
  >({});
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  // New Domain form
  const [newDomainTitle, setNewDomainTitle] = useState('');
  const [newDomainShort, setNewDomainShort] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');

  // Orders filter & Promo form
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPercent, setNewPromoPercent] = useState(15);

  // Site settings & Testimonial form
  const [settingsForm, setSettingsForm] = useState(siteSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [testAuthor, setTestAuthor] = useState('');
  const [testRole, setTestRole] = useState('');
  const [testCourse, setTestCourse] = useState(courses[0]?.title || '');
  const [testQuote, setTestQuote] = useState('');

  // Cloud infrastructure, upload & refund feedback states
  const [confirmRefundOrderId, setConfirmRefundOrderId] = useState<string | null>(null);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);
  const [migratingCloud, setMigratingCloud] = useState(false);
  const [migrationFeedback, setMigrationFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    setSettingsForm(siteSettings);
  }, [siteSettings]);

  // Strict security gate
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="py-20 px-4 text-center max-w-md mx-auto space-y-5">
        <div className="w-16 h-16 rounded-full bg-red-950/80 border border-red-600/60 mx-auto flex items-center justify-center text-red-400">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="font-brand text-2xl font-bold text-slate-100">
          Espace Réservé à la Direction
        </h2>
        {adminSessionExpiredNotice && (
          <div className="p-3.5 rounded-xl bg-amber-950/60 border border-[#D4AF37]/50 text-xs text-[#F3E5AB] leading-relaxed text-left">
            {adminSessionExpiredNotice}
          </div>
        )}
        <p className="text-xs text-zinc-400 leading-relaxed">
          Aucun visiteur ni compte apprenant ordinaire ne peut accéder à cet espace. Veuillez vous authentifier avec les identifiants de Direction de Faith Ariola.
        </p>
        <button
          onClick={() => {
            dismissAdminSessionExpiredNotice();
            openAuthModal('admin');
          }}
          className="px-6 py-3 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          Connexion Administratrice
        </button>
      </div>
    );
  }

  // Metrics
  const confirmedOrders = orders.filter((o) => o.status === 'confirmed');
  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing');
  const failedOrders = orders.filter((o) => o.status === 'failed' || o.status === 'cancelled');

  const totalRevenueXOF = confirmedOrders.reduce(
    (acc, curr) => acc + (curr.currency === 'XOF' ? curr.amount : curr.amount * 655),
    0
  );

  // Sales breakdown by course
  const salesByCourse = courses.map((c) => {
    const matching = confirmedOrders.filter((o) => o.courseId === c.id);
    const rev = matching.reduce((acc, o) => acc + (o.currency === 'XOF' ? o.amount : o.amount * 655), 0);
    return { id: c.id, title: c.title, count: matching.length, revenueXOF: rev };
  });

  const handleSaveCourseForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    const totalLessons = editingCourse.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    saveCourse({
      ...editingCourse,
      modulesCount: editingCourse.modules.length,
      lessonsCount: totalLessons
    });
    setShowCourseModal(false);
    setEditingCourse(null);
    setEditingLessonId(null);
  };

  const handleAddModuleToCourse = () => {
    if (!editingCourse || !newModTitle.trim()) return;
    const newMod: CourseModule = {
      id: `mod-${Date.now()}`,
      order: editingCourse.modules.length + 1,
      title: newModTitle.trim(),
      description: newModDesc.trim() || 'Module de formation pratique',
      lessons: []
    };
    setEditingCourse({ ...editingCourse, modules: [...editingCourse.modules, newMod] });
    setNewModTitle('');
    setNewModDesc('');
  };

  const handleMoveModule = (index: number, dir: -1 | 1) => {
    if (!editingCourse) return;
    const target = index + dir;
    if (target < 0 || target >= editingCourse.modules.length) return;
    const copy = [...editingCourse.modules];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    setEditingCourse({
      ...editingCourse,
      modules: copy.map((m, idx) => ({ ...m, order: idx + 1 }))
    });
  };

  const handleMoveLesson = (modId: string, index: number, dir: -1 | 1) => {
    if (!editingCourse) return;
    setEditingCourse({
      ...editingCourse,
      modules: editingCourse.modules.map((m) => {
        if (m.id !== modId) return m;
        const target = index + dir;
        if (target < 0 || target >= m.lessons.length) return m;
        const copy = [...m.lessons];
        const [moved] = copy.splice(index, 1);
        copy.splice(target, 0, moved);
        return { ...m, lessons: copy };
      })
    });
  };

  const emptyDraft = {
    title: '',
    duration: '',
    videoUrl: '',
    summary: '',
    pdfName: '',
    pdfUrl: '',
    exTitle: '',
    exInstructions: '',
    exCorrection: ''
  };

  const handleAddLessonToModule = (modId: string) => {
    if (!editingCourse) return;
    const draft = lessonDraftByMod[modId];
    if (!draft || !draft.title.trim()) return;

    const safeSummary = escapeHtmlText(draft.summary.trim() || 'Contenu pédagogique pratique.');
    const newLesson: Lesson = {
      id: `les-${Date.now()}`,
      moduleId: modId,
      title: draft.title.trim(),
      duration: draft.duration.trim() || '20 min',
      type: 'video',
      videoUrl: draft.videoUrl.trim() || undefined,
      summary: draft.summary.trim() || 'Contenu pédagogique pratique.',
      contentHtml: `<p>${safeSummary}</p>`,
      keyTakeaways: [],
      downloads: draft.pdfName.trim()
        ? [
            {
              name: draft.pdfName.trim(),
              type: 'PDF',
              size: 'Support',
              description: 'Document pédagogique de la leçon',
              url: draft.pdfUrl.trim() || undefined
            }
          ]
        : undefined,
      exercise: draft.exTitle.trim()
        ? {
            title: draft.exTitle.trim(),
            instructions: draft.exInstructions.trim() || 'Réalisez cet exercice pratique et soumettez votre rendu.',
            deliverable: 'Rendu textuel ou lien vers votre création',
            criteria: ['Application des consignes de la leçon', 'Qualité et cohérence du résultat'],
            modelCorrection: draft.exCorrection.trim() || 'Correction disponible après soumission.'
          }
        : undefined
    };

    setEditingCourse({
      ...editingCourse,
      modules: editingCourse.modules.map((m) =>
        m.id === modId ? { ...m, lessons: [...m.lessons, newLesson] } : m
      )
    });
    setLessonDraftByMod((prev) => ({
      ...prev,
      [modId]: { ...emptyDraft }
    }));
  };

  const uploadMediaToCloud = async (
    bucket: 'course-videos' | 'course-pdfs' | 'brand-assets',
    file: File,
    folderPrefix: string
  ): Promise<string | null> => {
    setUploadStatus(`Préparation du téléversement de « ${file.name} »...`);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${folderPrefix}/${Date.now()}_${cleanName}`;
      const supabaseToken = await getSupabaseAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      if (supabaseToken) headers['X-Supabase-Token'] = supabaseToken;

      const res = await fetch('/api/media/upload-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ bucket, filePath })
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.signedUrl) {
        setUploadStatus(data.error || 'Supabase Storage non configuré côté serveur (utilisez un lien externe).');
        return null;
      }

      setUploadStatus(`Téléversement cloud en cours (${(file.size / (1024 * 1024)).toFixed(1)} Mo)...`);
      const uploadRes = await fetch(data.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
      if (!uploadRes.ok) {
        setUploadStatus('Échec du transfert vers Supabase Storage.');
        return null;
      }

      setUploadStatus(`✓ Fichier téléversé dans ${bucket} (${data.storageRef}).`);
      return data.storageRef as string;
    } catch {
      setUploadStatus('Erreur réseau pendant le téléversement cloud.');
      return null;
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (infraStatus?.supabase.serverConnected) {
      const cloudUrl = await uploadMediaToCloud('brand-assets', file, 'logos');
      if (cloudUrl) {
        const updated = { ...settingsForm, agencyLogoDataUrl: cloudUrl };
        setSettingsForm(updated);
        updateSiteSettings(updated);
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      const updated = { ...settingsForm, agencyLogoDataUrl: dataUrl };
      setSettingsForm(updated);
      updateSiteSettings(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSiteSettings(settingsForm);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const filteredOrders =
    orderStatusFilter === 'all' ? orders : orders.filter((o) => o.status === orderStatusFilter);

  return (
    <div className="py-10 sm:py-16 bg-[#08080A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Top Director Brand Banner */}
        <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-[#D4AF37]/40 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
          <div className="flex items-center gap-4">
            <img
              src="/src/assets/images/hero_faith_ariola_academy_1794341068588.jpg"
              alt="Faith Ariola"
              className="w-16 h-16 rounded-full object-cover border-2 border-[#D4AF37] shadow-lg shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-[#D4AF37]/15 text-[#F3E5AB] border border-[#D4AF37]/30 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                ADMINISTRATION PRIVÉE · DJIFFA DESIGN AGENCY
              </div>
              <h1 className="font-brand text-2xl sm:text-3xl font-bold text-slate-100">
                Tableau de Bord Directrice — Faith Ariola
              </h1>
              <p className="text-xs text-zinc-400">
                Formations, contenus, apprenants, ventes, accompagnement et identité de marque
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('launch-center')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'launch-center'
                  ? 'bg-[#D4AF37] text-zinc-950'
                  : 'bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#F3E5AB] border border-[#D4AF37]/40'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Centre de lancement</span>
            </button>
            <span
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase ${
                paymentConfig.serverConfigured
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {paymentConfig.serverConfigured
                ? `${paymentConfig.activeProvider.toUpperCase()} (${paymentConfig.isTestMode ? 'Sandbox' : 'Live'})`
                : 'Paiement non configuré (Démo)'}
            </span>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="flex items-center gap-2 p-1.5 bg-zinc-900/80 rounded-xl border border-zinc-800 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Vue d’ensemble', icon: TrendingUp },
            { id: 'launch-center', label: 'Centre de lancement', icon: Rocket },
            { id: 'courses', label: `Formations & Catégories (${courses.length})`, icon: BookOpen },
            { id: 'students', label: `Apprenants (${students.length})`, icon: Users },
            { id: 'orders', label: `Commandes & Promos (${orders.length})`, icon: DollarSign },
            { id: 'coaching', label: `Accompagnement (${coachingRequests.length})`, icon: HelpCircle },
            { id: 'settings', label: 'Logo, Paiements & Site', icon: Key }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                  activeTab === t.id ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB LAUNCH CENTER */}
        {activeTab === 'launch-center' && (
          <LaunchCenter onNavigateAdminTab={(tab) => setActiveTab(tab)} />
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Volume des commandes confirmées</span>
                <div className="font-brand text-2xl font-extrabold text-[#D4AF37] tabular-nums">
                  {formatPrice(totalRevenueXOF, 'XOF')}
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  Inclut les transactions de test marquées Démo
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Statuts des paiements</span>
                <div className="font-brand text-2xl font-extrabold text-emerald-400 tabular-nums">
                  {confirmedOrders.length} confirmés
                </div>
                <span className="text-[10px] text-zinc-400 block">
                  {pendingOrders.length} en attente · {failedOrders.length} échoués/annulés
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Apprenants inscrits</span>
                <div className="font-brand text-2xl font-extrabold text-slate-100 tabular-nums">
                  {students.length}
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  Sur {courses.length} formations actives
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Demandes d’accompagnement</span>
                <div className="font-brand text-2xl font-extrabold text-amber-400 tabular-nums">
                  {coachingRequests.filter((c) => c.status === 'pending').length} à traiter
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  Total : {coachingRequests.length} demandes reçues
                </span>
              </div>
            </div>

            {/* Ventes par formation */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h3 className="font-brand text-lg font-bold text-slate-100">Ventes par Formation</h3>
              <div className="space-y-3">
                {salesByCourse.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="font-medium text-slate-200 truncate">{item.title}</span>
                    <div className="flex items-center gap-6 shrink-0 tabular-nums">
                      <span className="text-zinc-400">{item.count} inscription(s)</span>
                      <span className="font-mono font-bold text-[#D4AF37]">
                        {formatPrice(item.revenueXOF, 'XOF')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COURSES & CATEGORIES */}
        {activeTab === 'courses' && (
          <div className="space-y-10">
            
            {/* Courses List */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-brand text-xl font-bold text-slate-100">
                    Gestion des Formations & Contenus Pédagogiques
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Créez des formations, modifiez les prix et organisez modules, leçons vidéo et supports.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingCourse({
                      id: `course-${Date.now()}`,
                      slug: `formation-${Date.now()}`,
                      title: 'Nouvelle Formation DJIFFA ACADEMY',
                      subtitle: 'Sous-titre de présentation',
                      description: 'Description détaillée du programme...',
                      domain: domains[0]?.id || 'video_ads_ai',
                      level: 'Tous niveaux',
                      duration: '12 heures',
                      modulesCount: 0,
                      lessonsCount: 0,
                      priceXOF: 75000,
                      priceEUR: 115,
                      priceUSD: 125,
                      coverImage: '/src/assets/images/course_method_faith_ariola_1794341070404.jpg',
                      isFeatured: false,
                      isPublished: true,
                      certificateEligible: true,
                      objectives: ['Maîtriser les compétences pratiques du programme'],
                      skillsAcquired: ['Production professionnelle IA'],
                      resourcesIncluded: ['Support PDF inclus'],
                      modules: []
                    });
                    setShowCourseModal(true);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-md self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle formation</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {courses.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={c.coverImage}
                        alt={c.title}
                        className="w-20 h-14 rounded-lg object-cover border border-zinc-800 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-brand font-bold text-sm text-slate-100">{c.title}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              c.isPublished ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {c.isPublished ? 'Publiée' : 'Dépubliée'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {c.modules.length} modules · {c.modules.reduce((s, m) => s + m.lessons.length, 0)} leçons · Niveau : {c.level}
                        </p>
                        <div className="text-xs font-mono font-bold text-[#D4AF37] mt-1 tabular-nums">
                          {c.priceXOF.toLocaleString('fr-FR')} FCFA · {c.priceEUR} € · ${c.priceUSD}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => {
                          setEditingCourse(c);
                          setShowCourseModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Modifier / Programme</span>
                      </button>
                      <button
                        onClick={() => {
                          saveCourse({ ...c, isPublished: !c.isPublished });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 border border-zinc-800 cursor-pointer"
                      >
                        {c.isPublished ? 'Dépublier' : 'Publier'}
                      </button>
                      {confirmDeleteKey === `course-${c.id}` ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              deleteCourse(c.id);
                              setConfirmDeleteKey(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmDeleteKey(null)}
                            className="px-2 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteKey(`course-${c.id}`)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-950/40 cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Domains / Categories Management */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-brand text-lg font-bold text-slate-100">
                  Domaines & Catégories de Formation ({domains.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {domains.map((dom) => (
                  <div
                    key={dom.id}
                    className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#F3E5AB] block">
                        {dom.code}. {dom.title}
                      </span>
                      <span className="text-zinc-400 text-[11px] block mt-0.5">{dom.description}</span>
                    </div>
                    {domains.length > 1 && (
                      confirmDeleteKey === `dom-${dom.id}` ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              deleteDomain(dom.id);
                              setConfirmDeleteKey(null);
                            }}
                            className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmDeleteKey(null)}
                            className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteKey(`dom-${dom.id}`)}
                          className="text-red-400 hover:text-red-300 p-1 cursor-pointer shrink-0"
                          title="Supprimer cette catégorie"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-zinc-800 space-y-3 text-xs">
                <span className="font-semibold text-slate-200 block">Ajouter un nouveau domaine de formation</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newDomainTitle}
                    onChange={(e) => setNewDomainTitle(e.target.value)}
                    placeholder="Titre complet (ex: Design Graphique IA)"
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                  <input
                    type="text"
                    value={newDomainShort}
                    onChange={(e) => setNewDomainShort(e.target.value)}
                    placeholder="Nom court filtre (ex: Design IA)"
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                  <input
                    type="text"
                    value={newDomainDesc}
                    onChange={(e) => setNewDomainDesc(e.target.value)}
                    placeholder="Description courte"
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!newDomainTitle.trim()) return;
                    saveDomain({
                      id: `dom-${Date.now()}`,
                      code: String(domains.length + 1).padStart(2, '0'),
                      title: newDomainTitle.trim(),
                      shortLabel: newDomainShort.trim() || newDomainTitle.trim(),
                      description: newDomainDesc.trim() || 'Nouveau domaine spécialisé DJIFFA ACADEMY.',
                      skills: []
                    });
                    setNewDomainTitle('');
                    setNewDomainShort('');
                    setNewDomainDesc('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer"
                >
                  Ajouter la catégorie
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: STUDENTS MANAGEMENT */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div>
              <h2 className="font-brand text-xl font-bold text-slate-100">Gestion des Apprenants</h2>
              <p className="text-xs text-zinc-400">
                Consultez les apprenants inscrits, leur progression et gérez leurs accès aux formations.
              </p>
            </div>

            <div className="space-y-4">
              {students.map((stu) => (
                <div key={stu.id} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-brand font-bold text-base text-slate-100 block">{stu.name}</span>
                      <span className="text-zinc-400">
                        {stu.email} {stu.phone ? `· ${stu.phone}` : ''} {stu.country ? `· ${stu.country}` : ''}
                      </span>
                    </div>
                    <div className="text-zinc-400 font-mono tabular-nums">
                      {stu.completedLessonIds.length} leçon(s) terminée(s) · {stu.certificates.length} certificat(s)
                    </div>
                  </div>

                  {/* Course access toggles */}
                  <div className="pt-3 border-t border-zinc-900 space-y-2">
                    <span className="text-[11px] text-zinc-400 font-semibold block">
                      Accès aux formations :
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((c) => {
                        const enrolled = stu.enrolledCourseIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() =>
                              enrolled
                                ? revokeCourseAccess(stu.id, c.id)
                                : grantManualCourseAccess(stu.id, c.id)
                            }
                            className={`px-3 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors ${
                              enrolled
                                ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                          >
                            {enrolled ? '✓ ' : '+ '}
                            {c.title.split(':')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ORDERS & PROMO CODES */}
        {activeTab === 'orders' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-brand text-xl font-bold text-slate-100">
                Commandes & Historique des Transactions
              </h2>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-200 cursor-pointer"
              >
                <option value="all">Tous les statuts ({orders.length})</option>
                <option value="confirmed">Paiements confirmés ({confirmedOrders.length})</option>
                <option value="pending">En attente ({pendingOrders.length})</option>
                <option value="failed">Échoués / Annulés ({failedOrders.length})</option>
              </select>
            </div>

            {refundNotice && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-[#D4AF37]/40 text-xs text-[#F3E5AB] flex items-center justify-between">
                <span>{refundNotice}</span>
                <button onClick={() => setRefundNotice(null)} className="text-zinc-400 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="p-4">Référence</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Apprenant</th>
                      <th className="p-4">Formation</th>
                      <th className="p-4">Prestataire</th>
                      <th className="p-4">Montant</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {filteredOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-zinc-900/40">
                        <td className="p-4 font-mono font-bold text-[#F3E5AB]">
                          {ord.reference}
                          {ord.isDemoTransaction && (
                            <span className="block text-[9px] text-amber-400">TEST DÉMO</span>
                          )}
                        </td>
                        <td className="p-4 text-zinc-400 text-[11px]">
                          {new Date(ord.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-slate-200 block">{ord.userName}</span>
                          <span className="text-[10px] text-zinc-500">{ord.userEmail}</span>
                        </td>
                        <td className="p-4 text-zinc-300 max-w-[200px] truncate">{ord.courseTitle}</td>
                        <td className="p-4 text-zinc-400">
                          {ord.paymentMethod.toUpperCase()} ({ord.paymentProvider})
                        </td>
                        <td className="p-4 font-mono font-bold text-[#D4AF37] tabular-nums">
                          {ord.amount.toLocaleString('fr-FR')} {ord.currency}
                        </td>
                        <td className="p-4">
                          <select
                            value={ord.status}
                            onChange={(e) => updateOrderStatus(ord.id, e.target.value as any)}
                            className="bg-zinc-900 border border-zinc-700 text-[11px] rounded px-2 py-1 text-slate-200 cursor-pointer"
                          >
                            <option value="confirmed">Confirmé (Payé)</option>
                            <option value="pending">En attente</option>
                            <option value="processing">En traitement</option>
                            <option value="failed">Échoué</option>
                            <option value="cancelled">Annulé</option>
                            <option value="refunded">Remboursé</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => window.print()}
                              className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Reçu</span>
                            </button>

                            {ord.status === 'confirmed' && (
                              confirmRefundOrderId === ord.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={async () => {
                                      const res = await refundOrderServer(ord.id);
                                      setRefundNotice(res.message || 'Remboursement traité.');
                                      setConfirmRefundOrderId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirmer
                                  </button>
                                  <button
                                    onClick={() => setConfirmRefundOrderId(null)}
                                    className="px-1.5 py-1 rounded bg-zinc-800 text-zinc-300 text-[10px] cursor-pointer"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRefundOrderId(ord.id)}
                                  className="text-[11px] text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  title="Rembourser et révoquer l'accès"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Rembourser</span>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Promo Codes Management */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-brand text-lg font-bold text-slate-100">Codes Promotionnels & Réductions</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {promoCodes.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-[#F3E5AB] block">{p.code}</span>
                      <span className="text-zinc-400">-{p.discountPercent}% · {p.isActive ? 'Actif' : 'Inactif'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => savePromoCode({ ...p, isActive: !p.isActive })}
                        className="px-2 py-1 rounded bg-zinc-800 text-[11px] text-zinc-300 cursor-pointer"
                      >
                        {p.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => deletePromoCode(p.id)}
                        className="text-red-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-800 text-xs">
                <input
                  type="text"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                  placeholder="Nouveau code (ex: PROMO20)"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 uppercase font-mono"
                />
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={newPromoPercent}
                  onChange={(e) => setNewPromoPercent(Number(e.target.value))}
                  className="w-24 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
                <span className="text-zinc-400">% de réduction</span>
                <button
                  onClick={() => {
                    if (!newPromoCode.trim()) return;
                    savePromoCode({
                      id: `promo-${Date.now()}`,
                      code: newPromoCode.trim().toUpperCase(),
                      discountPercent: newPromoPercent,
                      isActive: true
                    });
                    setNewPromoCode('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold cursor-pointer"
                >
                  Créer le code promo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: COACHING & PRICING */}
        {activeTab === 'coaching' && (
          <div className="space-y-8">
            {/* Edit coaching prices */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h2 className="font-brand text-lg font-bold text-slate-100">
                Tarifs des Programmes d’Accompagnement (sans modifier le code)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {coachingPrograms.map((prog) => (
                  <div key={prog.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <span className="font-bold text-[#F3E5AB] block">{prog.title}</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-zinc-400 block mb-1">FCFA</label>
                        <input
                          type="number"
                          value={prog.priceXOF}
                          onChange={(e) =>
                            saveCoachingProgram({ ...prog, priceXOF: Number(e.target.value) })
                          }
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">EUR (€)</label>
                        <input
                          type="number"
                          value={prog.priceEUR}
                          onChange={(e) =>
                            saveCoachingProgram({ ...prog, priceEUR: Number(e.target.value) })
                          }
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">USD ($)</label>
                        <input
                          type="number"
                          value={prog.priceUSD}
                          onChange={(e) =>
                            saveCoachingProgram({ ...prog, priceUSD: Number(e.target.value) })
                          }
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <h2 className="font-brand text-xl font-bold text-slate-100">
              Demandes d’Accompagnement Reçues
            </h2>
            <div className="space-y-4">
              {coachingRequests.map((req) => (
                <div key={req.id} className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
                        {req.type === 'individual' ? 'Accompagnement Individuel VIP' : 'Accompagnement Collectif'}
                      </span>
                      <h3 className="font-brand text-base font-bold text-slate-100">
                        {req.userName} ({req.userEmail} · {req.userPhone})
                      </h3>
                    </div>

                    <select
                      value={req.status}
                      onChange={(e) => updateCoachingStatus(req.id, e.target.value as any)}
                      className="bg-zinc-900 border border-zinc-700 text-xs rounded-lg px-3 py-1.5 text-slate-200 cursor-pointer"
                    >
                      <option value="pending">En attente de validation</option>
                      <option value="validated">Validé & Confirmé</option>
                      <option value="scheduled">Rendez-vous planifié</option>
                      <option value="completed">Session terminée</option>
                      <option value="cancelled">Annulé</option>
                    </select>
                  </div>

                  <p className="text-zinc-300 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <strong>Besoin :</strong> {req.needDescription}
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-900 text-zinc-400">
                    <span>Date souhaitée : <strong>{req.preferredDate}</strong></span>
                    <input
                      type="url"
                      defaultValue={req.meetingLink || ''}
                      placeholder="Lien visio (Google Meet / Zoom)..."
                      onBlur={(e) => {
                        if (e.target.value !== req.meetingLink) {
                          updateCoachingStatus(req.id, req.status, e.target.value);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-slate-100 w-full sm:w-72"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: SITE LOGO, PAYMENTS STATUS, TESTIMONIALS */}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            
            {/* 0. Infrastructure Cloud Supabase & Déploiement */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-[#D4AF37]/40 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-[#D4AF37]" />
                  <div>
                    <h2 className="font-brand text-xl font-bold text-slate-100">
                      Infrastructure Cloud Supabase, Stockage & Déploiement
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      État réel de connexion détecté par le serveur DJIFFA ACADEMY.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={refreshServerPaymentStatus}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Vérifier l’état</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1.5">
                  <span className="text-zinc-400 block">Base PostgreSQL & Auth Supabase</span>
                  <strong className={infraStatus?.supabase.configured ? 'text-emerald-400' : 'text-amber-300'}>
                    {infraStatus?.supabase.configured
                      ? '✓ Connecté (Serveur + Navigateur)'
                      : 'Non configuré (Mode Local actif)'}
                  </strong>
                  <p className="text-[11px] text-zinc-500">
                    Variables requises : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1.5">
                  <span className="text-zinc-400 block">Stockage Vidéos & PDF Privés</span>
                  <strong className={infraStatus?.supabase.serverConnected ? 'text-emerald-400' : 'text-zinc-300'}>
                    {infraStatus?.supabase.serverConnected
                      ? '✓ Buckets actifs (URL signées)'
                      : 'Liens externes actifs / Storage prêt'}
                  </strong>
                  <p className="text-[11px] text-zinc-500">
                    Buckets : brand-assets, course-pdfs, course-videos (+ Bunny/Cloudflare/Vimeo)
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1.5">
                  <span className="text-zinc-400 block">Sécurité Espace Direction</span>
                  <strong className={infraStatus?.adminSecurity.customCodeConfigured ? 'text-emerald-400' : 'text-amber-300'}>
                    {infraStatus?.adminSecurity.customCodeConfigured
                      ? '✓ Code secret personnalisé actif'
                      : 'Mode démo (DJIFFA-ADMIN)'}
                  </strong>
                  <p className="text-[11px] text-zinc-500">
                    Définissez ADMIN_ACCESS_CODE et ADMIN_SESSION_SECRET en production.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const meta = createPreMigrationBackup({
                      domains,
                      courses,
                      promoCodes,
                      coachingPrograms,
                      testimonials,
                      siteSettings,
                      students,
                      orders,
                      coachingRequests
                    });
                    setMigrationFeedback({
                      ok: true,
                      message: `✓ Sauvegarde locale téléchargée (${meta.fileName}). Vous pouvez maintenant vérifier la connexion ou migrer sans écrasement.`
                    });
                  }}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-100 font-semibold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#D4AF37]" />
                  <span>Préparer une sauvegarde (.json)</span>
                </button>

                <button
                  type="button"
                  disabled={migratingCloud || !infraStatus?.supabase.serverConnected}
                  onClick={async () => {
                    if (!loadStoredBackupMeta()) {
                      setMigrationFeedback({
                        ok: false,
                        message: 'Préparez d’abord une sauvegarde JSON locale avant de lancer la migration vers Supabase.'
                      });
                      return;
                    }
                    setMigratingCloud(true);
                    setMigrationFeedback(null);
                    try {
                      const res = await migrateLocalCatalogToCloud();
                      setMigrationFeedback(res);
                    } finally {
                      setMigratingCloud(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{migratingCloud ? 'Migration en cours...' : 'Migrer mes données locales vers Supabase'}</span>
                </button>

                {infraStatus?.supabase.serverConnected && (
                  <button
                    type="button"
                    onClick={refreshSupabaseAdminData}
                    className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Synchroniser apprenants & commandes Supabase</span>
                  </button>
                )}
              </div>

              {migrationFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    migrationFeedback.ok
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      : 'bg-red-950/60 border-red-800 text-red-200'
                  }`}
                >
                  {migrationFeedback.message}
                </div>
              )}
            </div>

            {/* 1. Official Logo Import & Contact Info */}
            <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-6">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="font-brand text-xl font-bold text-slate-100">
                  Logo Officiel DJIFFA DESIGN AGENCY & Coordonnées
                </h2>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-xl bg-zinc-950 border border-[#D4AF37]/40 flex items-center justify-center overflow-hidden shrink-0">
                  {settingsForm.agencyLogoDataUrl ? (
                    <img
                      src={settingsForm.agencyLogoDataUrl}
                      alt="Logo DJIFFA DESIGN AGENCY"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="font-brand text-3xl font-bold text-[#D4AF37]">D</span>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-slate-200 block">
                    Importer le logo officiel de DJIFFA DESIGN AGENCY
                  </span>
                  <p className="text-zinc-400">
                    Formats recommandés : PNG transparent, SVG ou JPG. Il apparaîtra dans la barre supérieure, le pied de page et les certificats.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold cursor-pointer">
                      Choisir un fichier logo
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                    {settingsForm.agencyLogoDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...settingsForm, agencyLogoDataUrl: null };
                          setSettingsForm(updated);
                          updateSiteSettings(updated);
                        }}
                        className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 cursor-pointer"
                      >
                        Réinitialiser
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Email de contact officiel</label>
                  <input
                    type="email"
                    value={settingsForm.contactEmail}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Téléphone / WhatsApp Direction</label>
                  <input
                    type="text"
                    value={settingsForm.contactPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Siège</label>
                  <input
                    type="text"
                    value={settingsForm.headquarters}
                    onChange={(e) => setSettingsForm({ ...settingsForm, headquarters: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              {settingsSaved && (
                <p className="text-xs text-emerald-400 font-medium">✓ Paramètres du site enregistrés.</p>
              )}

              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs cursor-pointer"
              >
                Enregistrer les coordonnées
              </button>
            </form>

            {/* 2. Server Payment Gateway Status (Keys kept strictly server-side) */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-brand text-xl font-bold text-slate-100">
                    Système de Paiement Sécurisé (Côté Serveur)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Par sécurité, les clés secrètes FedaPay / KKiaPay / CinetPay ne sont jamais stockées dans le navigateur. Elles se configurent dans les variables d’environnement du serveur.
                  </p>
                </div>
                <button
                  onClick={refreshServerPaymentStatus}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualiser</span>
                </button>
              </div>

              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  paymentConfig.serverConfigured
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-800 text-[#F3E5AB]'
                }`}
              >
                {paymentConfig.serverConfigured ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[#D4AF37] shrink-0" />
                )}
                <div className="space-y-1">
                  <strong className="block">{paymentConfig.serverMessage}</strong>
                  <span className="text-zinc-400 block">
                    Prestataire sélectionné côté serveur : <strong className="text-white">{paymentConfig.activeProvider.toUpperCase()}</strong> · Mode : <strong className="text-white">{paymentConfig.isTestMode ? 'Sandbox' : 'Live'}</strong>
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300 space-y-2">
                <strong className="text-[#F3E5AB] block">
                  Recommandation économique pour démarrer au Bénin et à l’international : FedaPay
                </strong>
                <p className="text-zinc-400 leading-relaxed">
                  <strong>FedaPay</strong> est adapté au démarrage sans abonnement mensuel fixe (commission uniquement à la transaction) et prend en charge <strong>MTN Mobile Money Bénin, Moov Money Bénin, Visa et Mastercard</strong>.
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-zinc-400">
                  <li>Ouvrez votre compte marchand sur <strong>fedapay.com</strong> (ou <strong>kkiapay.me</strong> / <strong>cinetpay.com</strong>).</li>
                  <li>Ajoutez vos clés dans les variables d’environnement du serveur : <code className="text-zinc-200">PAYMENT_PROVIDER=fedapay</code>, <code className="text-zinc-200">FEDAPAY_PUBLIC_KEY</code>, <code className="text-zinc-200">FEDAPAY_SECRET_KEY</code>, et <code className="text-zinc-200">FEDAPAY_WEBHOOK_SECRET</code>.</li>
                  <li>Configurez l’URL Webhook sur votre compte prestataire vers : <code className="text-zinc-200">{window.location.origin}/api/payments/webhook</code>.</li>
                </ol>
              </div>
            </div>

            {/* 3. Real Testimonials Management */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="font-brand text-xl font-bold text-slate-100">
                  Témoignages Réels d’Apprenants ({testimonials.length})
                </h2>
              </div>
              <p className="text-xs text-zinc-400">
                Conformément à votre charte d’authenticité, aucun témoignage fictif n’est affiché. La section Témoignages apparaîtra sur le site public uniquement lorsque vous publierez ici de vrais retours vérifiés.
              </p>

              {testimonials.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {testimonials.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-[#F3E5AB]">{t.authorName} · {t.authorRole}</strong>
                        <button onClick={() => deleteTestimonial(t.id)} className="text-red-400 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-zinc-300 italic">« {t.quote} »</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-zinc-800">
                <input
                  type="text"
                  value={testAuthor}
                  onChange={(e) => setTestAuthor(e.target.value)}
                  placeholder="Nom de l’apprenant"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
                <input
                  type="text"
                  value={testRole}
                  onChange={(e) => setTestRole(e.target.value)}
                  placeholder="Activité / Ville"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
                <input
                  type="text"
                  value={testCourse}
                  onChange={(e) => setTestCourse(e.target.value)}
                  placeholder="Formation suivie"
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
              </div>
              <textarea
                rows={2}
                value={testQuote}
                onChange={(e) => setTestQuote(e.target.value)}
                placeholder="Témoignage authentique vérifié..."
                className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={() => {
                  if (!testAuthor.trim() || !testQuote.trim()) return;
                  addTestimonial({
                    authorName: testAuthor.trim(),
                    authorRole: testRole.trim() || 'Apprenant DJIFFA ACADEMY',
                    courseTitle: testCourse.trim(),
                    quote: testQuote.trim(),
                    verifiedDate: new Date().toISOString().split('T')[0]
                  });
                  setTestAuthor('');
                  setTestRole('');
                  setTestQuote('');
                }}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer"
              >
                Publier ce témoignage vérifié
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Course + Curriculum Editor Modal */}
      {showCourseModal && editingCourse && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-3xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="font-brand text-lg font-bold text-slate-100">
                Édition de la Formation & du Programme
              </h3>
              <button onClick={() => setShowCourseModal(false)} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourseForm} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Titre de la formation *</label>
                <input
                  type="text"
                  required
                  value={editingCourse.title}
                  onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Sous-titre accrocheur</label>
                <input
                  type="text"
                  value={editingCourse.subtitle}
                  onChange={(e) => setEditingCourse({ ...editingCourse, subtitle: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Domaine / Catégorie</label>
                  <select
                    value={editingCourse.domain}
                    onChange={(e) => setEditingCourse({ ...editingCourse, domain: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  >
                    {domains.map((d) => (
                      <option key={d.id} value={d.id}>{d.shortLabel}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Niveau</label>
                  <select
                    value={editingCourse.level}
                    onChange={(e) => setEditingCourse({ ...editingCourse, level: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  >
                    <option value="Tous niveaux">Tous niveaux</option>
                    <option value="Débutant">Débutant</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Avancé">Avancé</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Durée estimée</label>
                  <input
                    type="text"
                    value={editingCourse.duration}
                    onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Prix FCFA (XOF) *</label>
                  <input
                    type="number"
                    required
                    value={editingCourse.priceXOF}
                    onChange={(e) => setEditingCourse({ ...editingCourse, priceXOF: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Prix EUR (€)</label>
                  <input
                    type="number"
                    value={editingCourse.priceEUR}
                    onChange={(e) => setEditingCourse({ ...editingCourse, priceEUR: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Prix USD ($)</label>
                  <input
                    type="number"
                    value={editingCourse.priceUSD}
                    onChange={(e) => setEditingCourse({ ...editingCourse, priceUSD: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Image de couverture (URL)</label>
                <input
                  type="text"
                  value={editingCourse.coverImage}
                  onChange={(e) => setEditingCourse({ ...editingCourse, coverImage: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Description complète</label>
                <textarea
                  rows={3}
                  value={editingCourse.description}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                />
              </div>

              {/* Modules & Lessons Curriculum Builder */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-4">
                <span className="font-bold text-[#F3E5AB] block">
                  Modules & Leçons ({editingCourse.modules.length} modules)
                </span>

                <div className="space-y-3">
                  {editingCourse.modules.map((mod, modIndex) => {
                    const draft = lessonDraftByMod[mod.id] || { ...emptyDraft };
                    return (
                      <div key={mod.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-slate-200">
                            Module {mod.order} : {mod.title}
                          </strong>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveModule(modIndex, -1)}
                              disabled={modIndex === 0}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Monter le module"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveModule(modIndex, 1)}
                              disabled={modIndex === editingCourse.modules.length - 1}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                              title="Descendre le module"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setEditingCourse({
                                  ...editingCourse,
                                  modules: editingCourse.modules
                                    .filter((m) => m.id !== mod.id)
                                    .map((m, idx) => ({ ...m, order: idx + 1 }))
                                })
                              }
                              className="text-red-400 text-[11px] cursor-pointer ml-1"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-2">
                          {mod.lessons.map((les, lesIndex) => (
                            <div key={les.id} className="p-2 rounded bg-zinc-900/60 border border-zinc-800/70 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                                <span className="truncate">
                                  · {les.title} ({les.duration})
                                  {les.videoUrl ? ' · Vidéo liée' : ''}
                                  {les.downloads && les.downloads.length > 0 ? ` · ${les.downloads.length} PDF` : ''}
                                  {les.exercise ? ' · Exercice' : ''}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLesson(mod.id, lesIndex, -1)}
                                    disabled={lesIndex === 0}
                                    className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                    title="Monter"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLesson(mod.id, lesIndex, 1)}
                                    disabled={lesIndex === mod.lessons.length - 1}
                                    className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                    title="Descendre"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingLessonId(editingLessonId === les.id ? null : les.id)
                                    }
                                    className="text-[#D4AF37] hover:underline cursor-pointer px-1"
                                  >
                                    {editingLessonId === les.id ? 'Fermer' : 'Éditer'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        modules: editingCourse.modules.map((m) =>
                                          m.id === mod.id
                                            ? { ...m, lessons: m.lessons.filter((l) => l.id !== les.id) }
                                            : m
                                        )
                                      })
                                    }
                                    className="text-red-400 cursor-pointer"
                                  >
                                    Retirer
                                  </button>
                                </div>
                              </div>

                              {editingLessonId === les.id && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-[11px]">
                                  <input
                                    type="text"
                                    value={les.title}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        modules: editingCourse.modules.map((m) =>
                                          m.id === mod.id
                                            ? {
                                                ...m,
                                                lessons: m.lessons.map((l) =>
                                                  l.id === les.id ? { ...l, title: e.target.value } : l
                                                )
                                              }
                                            : m
                                        )
                                      })
                                    }
                                    placeholder="Titre leçon"
                                    className="px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-slate-100"
                                  />
                                  <input
                                    type="text"
                                    value={les.duration}
                                    onChange={(e) =>
                                      setEditingCourse({
                                        ...editingCourse,
                                        modules: editingCourse.modules.map((m) =>
                                          m.id === mod.id
                                            ? {
                                                ...m,
                                                lessons: m.lessons.map((l) =>
                                                  l.id === les.id ? { ...l, duration: e.target.value } : l
                                                )
                                              }
                                            : m
                                        )
                                      })
                                    }
                                    placeholder="Durée (ex: 25 min)"
                                    className="px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-slate-100"
                                  />
                                  <div className="sm:col-span-2 flex gap-2 items-center">
                                    <input
                                      type="text"
                                      value={les.videoUrl || ''}
                                      onChange={(e) =>
                                        setEditingCourse({
                                          ...editingCourse,
                                          modules: editingCourse.modules.map((m) =>
                                            m.id === mod.id
                                              ? {
                                                  ...m,
                                                  lessons: m.lessons.map((l) =>
                                                    l.id === les.id ? { ...l, videoUrl: e.target.value || undefined } : l
                                                  )
                                                }
                                              : m
                                          )
                                        })
                                      }
                                      placeholder="URL Vidéo (MP4, Bunny Stream, Vimeo, ou sb://course-videos/...)"
                                      className="flex-1 px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-slate-100"
                                    />
                                    <label className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-zinc-200 font-semibold cursor-pointer shrink-0 flex items-center gap-1">
                                      <UploadCloud className="w-3 h-3" />
                                      <span>Vidéo</span>
                                      <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/quicktime"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const f = e.target.files?.[0];
                                          if (!f) return;
                                          const ref = await uploadMediaToCloud('course-videos', f, editingCourse.id);
                                          if (ref) {
                                            setEditingCourse({
                                              ...editingCourse,
                                              modules: editingCourse.modules.map((m) =>
                                                m.id === mod.id
                                                  ? {
                                                      ...m,
                                                      lessons: m.lessons.map((l) =>
                                                        l.id === les.id ? { ...l, videoUrl: ref } : l
                                                      )
                                                    }
                                                  : m
                                              )
                                            });
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                  <div className="sm:col-span-2 flex gap-2 items-center">
                                    <input
                                      type="text"
                                      value={les.downloads?.[0]?.url || ''}
                                      onChange={(e) => {
                                        const urlVal = e.target.value;
                                        setEditingCourse({
                                          ...editingCourse,
                                          modules: editingCourse.modules.map((m) =>
                                            m.id === mod.id
                                              ? {
                                                  ...m,
                                                  lessons: m.lessons.map((l) =>
                                                    l.id === les.id
                                                      ? {
                                                          ...l,
                                                          downloads: urlVal
                                                            ? [
                                                                {
                                                                  name: l.downloads?.[0]?.name || `Support - ${l.title}`,
                                                                  type: 'PDF',
                                                                  size: 'PDF',
                                                                  description: 'Support de cours PDF',
                                                                  url: urlVal
                                                                }
                                                              ]
                                                            : l.downloads
                                                        }
                                                      : l
                                                  )
                                                }
                                              : m
                                          )
                                        });
                                      }}
                                      placeholder="URL PDF téléchargeable ou sb://course-pdfs/..."
                                      className="flex-1 px-2 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-slate-100"
                                    />
                                    <label className="px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-zinc-200 font-semibold cursor-pointer shrink-0 flex items-center gap-1">
                                      <UploadCloud className="w-3 h-3" />
                                      <span>PDF</span>
                                      <input
                                        type="file"
                                        accept="application/pdf"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const f = e.target.files?.[0];
                                          if (!f) return;
                                          const ref = await uploadMediaToCloud('course-pdfs', f, editingCourse.id);
                                          if (ref) {
                                            setEditingCourse({
                                              ...editingCourse,
                                              modules: editingCourse.modules.map((m) =>
                                                m.id === mod.id
                                                  ? {
                                                      ...m,
                                                      lessons: m.lessons.map((l) =>
                                                        l.id === les.id
                                                          ? {
                                                              ...l,
                                                              downloads: [
                                                                {
                                                                  name: l.downloads?.[0]?.name || f.name,
                                                                  type: 'PDF',
                                                                  size: `${Math.max(1, Math.round(f.size / 1024))} Ko`,
                                                                  description: 'Support de cours PDF',
                                                                  url: ref
                                                                }
                                                              ]
                                                            }
                                                          : l
                                                      )
                                                    }
                                                  : m
                                              )
                                            });
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Quick Add Lesson */}
                        <div className="space-y-2 pt-2 border-t border-zinc-900">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={draft.title}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, title: e.target.value }
                                }))
                              }
                              placeholder="Titre nouvelle leçon *"
                              className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                            <input
                              type="text"
                              value={draft.duration}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, duration: e.target.value }
                                }))
                              }
                              placeholder="Durée (ex: 25 min)"
                              className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                            <input
                              type="text"
                              value={draft.videoUrl}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, videoUrl: e.target.value }
                                }))
                              }
                              placeholder="URL Vidéo MP4 (optionnel)"
                              className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={draft.pdfName}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, pdfName: e.target.value }
                                }))
                              }
                              placeholder="Nom PDF (optionnel)"
                              className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                            <input
                              type="text"
                              value={draft.pdfUrl}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, pdfUrl: e.target.value }
                                }))
                              }
                              placeholder="Lien PDF (optionnel)"
                              className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                            <input
                              type="text"
                              value={draft.exTitle}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, exTitle: e.target.value }
                                }))
                              }
                              placeholder="Exercice pratique (optionnel)"
                              className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={draft.summary}
                              onChange={(e) =>
                                setLessonDraftByMod((prev) => ({
                                  ...prev,
                                  [mod.id]: { ...draft, summary: e.target.value }
                                }))
                              }
                              placeholder="Notes / Résumé de la leçon"
                              className="flex-1 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100 text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddLessonToModule(mod.id)}
                              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-slate-200 font-semibold text-[11px] cursor-pointer shrink-0"
                            >
                              + Ajouter la leçon
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {uploadStatus && (
                  <p className="text-[11px] text-[#F3E5AB] bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
                    {uploadStatus}
                  </p>
                )}

                {/* Add Module */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-800">
                  <input
                    type="text"
                    value={newModTitle}
                    onChange={(e) => setNewModTitle(e.target.value)}
                    placeholder="Titre du nouveau module"
                    className="px-2.5 py-2 rounded bg-zinc-950 border border-zinc-800 text-slate-100"
                  />
                  <input
                    type="text"
                    value={newModDesc}
                    onChange={(e) => setNewModDesc(e.target.value)}
                    placeholder="Description courte du module"
                    className="px-2.5 py-2 rounded bg-zinc-950 border border-zinc-800 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddModuleToCourse}
                    className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-slate-100 font-semibold cursor-pointer"
                  >
                    + Ajouter un module
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCourse.isPublished}
                    onChange={(e) => setEditingCourse({ ...editingCourse, isPublished: e.target.checked })}
                  />
                  <span className="text-slate-200">Formation publiée</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCourse.isFeatured}
                    onChange={(e) => setEditingCourse({ ...editingCourse, isFeatured: e.target.checked })}
                  />
                  <span className="text-slate-200">Mettre en avant sur l’accueil</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold cursor-pointer"
                >
                  Sauvegarder la formation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
