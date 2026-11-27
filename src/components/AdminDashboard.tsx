/**
 * DJIFFA ACADEMY - Secure Administrative Dashboard (Espace Direction)
 * Reserved for Director Faith Ariola (verified via /api/auth/admin-verify)
 * Manages overview KPIs (real vs demo separation), courses, promo pricing, categories, students,
 * orders, promo codes, coaching, contact messages, payments/webhooks, brand/site identity, legal texts, testimonials & Launch Center
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Course, CourseModule, Lesson, ContactMessage, QuizQuestion } from '../types';
import { getCoursePricing } from '../lib/pricing';
import { BRAND_IMAGES, resolveAssetImageUrl } from '../lib/assets';
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
  Rocket,
  Mail,
  CreditCard,
  Copy,
  Check,
  Search,
  Sparkles,
  ExternalLink,
  Bell,
  Award,
  Download,
  Loader2
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'courses'
  | 'students'
  | 'orders'
  | 'coaching'
  | 'messages'
  | 'payments'
  | 'identity'
  | 'launch-center';

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
    coachingRequestsError,
    contactMessages,
    paymentEvents,
    paymentEventsError,
    paymentEventsAuthBlocked,
    paymentEventsNotice,
    paymentConfig,
    infraStatus,
    adminToken,
    adminDataLoading,
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
    updateContactMessageStatus,
    grantManualCourseAccess,
    revokeCourseAccess,
    downloadCertificatePdf,
    refreshServerPaymentStatus,
    migrateLocalCatalogToCloud,
    refreshSupabaseAdminData,
    refreshAdminTelemetry,
    currentUser,
    adminSessionExpiredNotice,
    dismissAdminSessionExpiredNotice,
    openAuthModal
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [downloadingAdminCertId, setDownloadingAdminCertId] = useState<string | null>(null);
  const [adminCertError, setAdminCertError] = useState<string | null>(null);

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
  const [showFinalQuizEditor, setShowFinalQuizEditor] = useState(false);
  const lastAutoTelemetryKeyRef = useRef<string | null>(null);
  const lastAutoAdminDataKeyRef = useRef<string | null>(null);

  // New Domain form
  const [newDomainTitle, setNewDomainTitle] = useState('');
  const [newDomainShort, setNewDomainShort] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');

  // Students search
  const [studentSearch, setStudentSearch] = useState('');

  // Orders filter & Promo form
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoPercent, setNewPromoPercent] = useState(15);

  // Contact messages filter & drafts
  const [messageFilter, setMessageFilter] = useState<'all' | ContactMessage['status']>('all');
  const [msgNoteDrafts, setMsgNoteDrafts] = useState<Record<string, string>>({});

  // Coaching note drafts & feedback
  const [coachNoteDrafts, setCoachNoteDrafts] = useState<Record<string, string>>({});
  const [coachingActionFeedback, setCoachingActionFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Webhook URL copy feedback
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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

  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      lastAutoTelemetryKeyRef.current = null;
      lastAutoAdminDataKeyRef.current = null;
      return;
    }

    const telemetryKey = `${currentUser.id}|${adminToken || ''}`;
    if (lastAutoTelemetryKeyRef.current !== telemetryKey) {
      lastAutoTelemetryKeyRef.current = telemetryKey;
      refreshAdminTelemetry();
    }

    if (infraStatus?.supabase.serverConnected) {
      const adminDataKey = `${currentUser.id}|${adminToken || ''}|connected`;
      if (lastAutoAdminDataKeyRef.current !== adminDataKey) {
        lastAutoAdminDataKeyRef.current = adminDataKey;
        refreshSupabaseAdminData();
      }
    }
  }, [
    currentUser?.id,
    currentUser?.role,
    adminToken,
    infraStatus?.supabase.serverConnected,
    refreshAdminTelemetry,
    refreshSupabaseAdminData
  ]);

  useEffect(() => {
    if (activeTab === 'coaching' && currentUser?.role === 'admin' && infraStatus?.supabase.serverConnected) {
      refreshSupabaseAdminData();
    }
  }, [activeTab, currentUser?.role, infraStatus?.supabase.serverConnected, refreshSupabaseAdminData]);

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
          Aucun visiteur ni compte apprenant ordinaire ne peut accéder à cet espace. Veuillez vous authentifier avec les identifiants de Direction de {siteSettings.directorName}.
        </p>
        <button
          onClick={() => {
            dismissAdminSessionExpiredNotice();
            openAuthModal('admin');
          }}
          className="px-6 py-3 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider cursor-pointer min-h-[44px]"
        >
          Connexion Administratrice
        </button>
      </div>
    );
  }

  // Strict separation: Real confirmed orders vs Demo/Test transactions
  const realOrders = orders.filter((o) => !o.isDemoTransaction);
  const demoOrders = orders.filter((o) => o.isDemoTransaction);
  const confirmedRealOrders = realOrders.filter((o) => o.status === 'confirmed');
  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'processing');
  const failedOrders = orders.filter((o) => o.status === 'failed' || o.status === 'cancelled' || o.status === 'refunded');

  const realRevenueXOF = confirmedRealOrders.reduce(
    (acc, curr) => acc + (curr.currency === 'XOF' ? curr.amount : curr.amount * 655),
    0
  );

  // Real sales breakdown by course (excludes demo tests)
  const salesByCourse = courses.map((c) => {
    const matching = confirmedRealOrders.filter((o) => o.courseId === c.id);
    const rev = matching.reduce((acc, o) => acc + (o.currency === 'XOF' ? o.amount : o.amount * 655), 0);
    return { id: c.id, title: c.title, count: matching.length, revenueXOF: rev };
  });

  const unreadMessagesCount = contactMessages.filter((m) => m.status === 'new').length;
  const pendingCoachingCount = coachingRequests.filter((c) => c.status === 'pending').length;

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.country && s.country.toLowerCase().includes(q))
    );
  });

  const deliveredCertificates = students
    .flatMap((stu) =>
      (stu.certificates || []).map((cert) => ({
        ...cert,
        studentEmail: stu.email
      }))
    )
    .filter((cert) => {
      if (!studentSearch.trim()) return true;
      const q = studentSearch.toLowerCase();
      return (
        cert.studentName.toLowerCase().includes(q) ||
        cert.studentEmail.toLowerCase().includes(q) ||
        cert.courseTitle.toLowerCase().includes(q) ||
        cert.verificationCode.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => String(b.issuedDate || '').localeCompare(String(a.issuedDate || '')));

  const filteredOrders = orders.filter((o) => {
    if (orderStatusFilter === 'all') return true;
    if (orderStatusFilter === 'real') return !o.isDemoTransaction;
    if (orderStatusFilter === 'demo') return o.isDemoTransaction;
    return o.status === orderStatusFilter;
  });

  const filteredMessages = contactMessages.filter((m) =>
    messageFilter === 'all' ? true : m.status === messageFilter
  );

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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCourse) return;

    if (infraStatus?.supabase.serverConnected) {
      const cloudUrl = await uploadMediaToCloud('brand-assets', file, 'covers');
      if (cloudUrl) {
        setEditingCourse({ ...editingCourse, coverImage: cloudUrl });
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditingCourse({ ...editingCourse, coverImage: reader.result });
      }
    };
    reader.readAsDataURL(file);
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

  const webhookUrl = `${window.location.origin}/api/payments/webhook`;

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const navItems: Array<{ id: AdminTab; label: string; badge?: number; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Vue d’ensemble', icon: TrendingUp },
    { id: 'courses', label: `Formations (${courses.length})`, icon: BookOpen },
    { id: 'students', label: `Apprenants (${students.length})`, icon: Users },
    { id: 'orders', label: `Commandes (${orders.length})`, icon: DollarSign },
    { id: 'coaching', label: 'Accompagnement', badge: pendingCoachingCount || undefined, icon: HelpCircle },
    { id: 'messages', label: 'Messages', badge: unreadMessagesCount || undefined, icon: Mail },
    { id: 'payments', label: 'Paiements & Flux', icon: CreditCard },
    { id: 'identity', label: 'Identité & Site', icon: ImageIcon },
    { id: 'launch-center', label: 'Centre de lancement', icon: Rocket }
  ];

  return (
    <div className="py-6 sm:py-12 bg-[#08080A] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Top Director Brand Banner */}
        <div className="p-5 sm:p-8 rounded-2xl bg-zinc-950 border border-[#D4AF37]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-2xl">
          <div className="flex items-center gap-4">
            <img
              src={BRAND_IMAGES.faithPortrait}
              alt={siteSettings.directorName}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-[#D4AF37] shadow-lg shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF37] mb-1">
                ADMINISTRATION PRIVÉE · {siteSettings.parentAgencyName}
              </div>
              <h1 className="font-brand text-xl sm:text-3xl font-bold text-slate-100 truncate">
                Espace Direction — {siteSettings.directorName}
              </h1>
              <p className="text-xs text-zinc-400">
                {siteSettings.academyName} · Gestion complète des formations, tarifs, ventes, apprenants et identité
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {infraStatus?.supabase.serverConnected && (
              <button
                type="button"
                disabled={adminDataLoading}
                onClick={() => {
                  refreshSupabaseAdminData();
                  refreshAdminTelemetry();
                }}
                title="Actualiser les données Supabase (apprenants, commandes, accompagnement)"
                className="px-3.5 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer min-h-[44px] bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminDataLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
                <span>{adminDataLoading ? 'Actualisation...' : 'Actualiser'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('launch-center')}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                activeTab === 'launch-center'
                  ? 'bg-[#D4AF37] text-zinc-950'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-[#F3E5AB] border border-[#D4AF37]/40'
              }`}
            >
              <Rocket className="w-4 h-4" />
              <span>Centre de lancement</span>
            </button>
            <span
              className={`px-3 py-2 rounded-lg text-[11px] font-bold uppercase ${
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

        {/* Mobile Quick Selector (Android-friendly) */}
        <div className="md:hidden">
          <label className="text-[11px] text-zinc-400 font-semibold block mb-1.5 uppercase tracking-wider">
            Section Espace Direction
          </label>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as AdminTab)}
            className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-[#D4AF37]/40 text-sm font-semibold text-slate-100 min-h-[46px]"
          >
            {navItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} {item.badge ? `(${item.badge} à traiter)` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Desktop & Tablet Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1.5 p-1.5 bg-zinc-900/90 rounded-xl border border-zinc-800 overflow-x-auto no-scrollbar">
          {navItems.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 min-h-[40px] ${
                  activeTab === t.id ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {t.badge && t.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      activeTab === t.id ? 'bg-zinc-950 text-[#D4AF37]' : 'bg-[#D4AF37]/20 text-[#F3E5AB]'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Chiffre d’affaires réel vérifié</span>
                <div className="font-brand text-2xl font-extrabold text-[#D4AF37] tabular-nums">
                  {formatPrice(realRevenueXOF, 'XOF')}
                </div>
                <span className="text-[11px] text-zinc-400 block">
                  {confirmedRealOrders.length} vente(s) réelle(s) confirmée(s) ·{' '}
                  <span className="text-amber-400">{demoOrders.length} test(s) Démo exclu(s)</span>
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Statuts des paiements</span>
                <div className="font-brand text-2xl font-extrabold text-emerald-400 tabular-nums">
                  {confirmedRealOrders.length} payés
                </div>
                <span className="text-[11px] text-zinc-400 block">
                  {pendingOrders.length} en attente · {failedOrders.length} échoués/remboursés
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Apprenants inscrits</span>
                <div className="font-brand text-2xl font-extrabold text-slate-100 tabular-nums">
                  {students.length}
                </div>
                <span className="text-[11px] text-zinc-400 block">
                  {courses.filter((c) => c.isPublished).length} publiée(s) sur {courses.length} formations
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-xs text-zinc-400">Suivi Direction</span>
                <div className="font-brand text-2xl font-extrabold text-amber-400 tabular-nums">
                  {pendingCoachingCount + unreadMessagesCount} à traiter
                </div>
                <span className="text-[11px] text-zinc-400 block">
                  {pendingCoachingCount} coaching(s) · {unreadMessagesCount} message(s) non lu(s)
                </span>
              </div>
            </div>

            {/* Action Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <button
                onClick={() => setActiveTab('messages')}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-[#D4AF37]/50 text-left flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-100 block">Messages Contact</span>
                  <span className="text-zinc-400">{unreadMessagesCount} nouveau(x) message(s)</span>
                </div>
                <Mail className="w-5 h-5 text-[#D4AF37]" />
              </button>

              <button
                onClick={() => setActiveTab('coaching')}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-[#D4AF37]/50 text-left flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-100 block">Accompagnement VIP & Cohorte</span>
                  <span className="text-zinc-400">{pendingCoachingCount} demande(s) en attente</span>
                </div>
                <HelpCircle className="w-5 h-5 text-[#D4AF37]" />
              </button>

              <button
                onClick={() => setActiveTab('payments')}
                className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-[#D4AF37]/50 text-left flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-100 block">Passerelle & Webhooks</span>
                  <span className="text-zinc-400">
                    {paymentConfig.serverConfigured ? 'Serveur prêt' : 'Mode Démo actif'} · {paymentEvents.length} événement(s)
                  </span>
                </div>
                <CreditCard className="w-5 h-5 text-[#D4AF37]" />
              </button>
            </div>

            {/* Real Sales Breakdown by Course */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-brand text-lg font-bold text-slate-100">
                  Ventes Réelles par Formation
                </h3>
                <span className="text-[11px] text-zinc-400">
                  Calculé exclusivement sur les paiements réels confirmés
                </span>
              </div>
              <div className="space-y-3">
                {salesByCourse.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4 text-xs"
                  >
                    <span className="font-medium text-slate-200 truncate">{item.title}</span>
                    <div className="flex items-center gap-6 shrink-0 tabular-nums">
                      <span className="text-zinc-400">{item.count} vente(s)</span>
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

        {/* TAB 2: COURSES, PRICING, PROMOTIONS & CATEGORIES */}
        {activeTab === 'courses' && (
          <div className="space-y-10">
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-brand text-xl font-bold text-slate-100">
                    Gestion des Formations, Tarifs & Promotions
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Modifiez les prix normaux ou activez une promotion sans toucher au code, et structurez modules, vidéos et supports.
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
                      promoActive: false,
                      coverImage: BRAND_IMAGES.courseMethod,
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
                  className="px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-md self-start min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle formation</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {courses.map((c) => {
                  const pricing = getCoursePricing(c);
                  return (
                    <div
                      key={c.id}
                      className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-start sm:items-center gap-4">
                        <img
                          src={resolveAssetImageUrl(c.coverImage)}
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
                            {c.isFeatured && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#D4AF37]/15 text-[#F3E5AB]">
                                Accueil
                              </span>
                            )}
                            {pricing.isPromo && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/60">
                                Promo {pricing.discountPercent ? `-${pricing.discountPercent}%` : 'Active'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {c.modules.length} modules · {c.modules.reduce((s, m) => s + m.lessons.length, 0)} leçons · Niveau : {c.level}
                            {c.finalQuiz && c.finalQuiz.length > 0 ? ` · Examen final (${c.finalQuiz.length} Q)` : ''}
                          </p>
                          <div className="text-xs font-mono font-bold text-[#D4AF37] mt-1 tabular-nums flex flex-wrap items-center gap-2">
                            <span>
                              {pricing.activeXOF.toLocaleString('fr-FR')} FCFA · {pricing.activeEUR} € · ${pricing.activeUSD}
                            </span>
                            {pricing.crossedOutXOF && (
                              <span className="text-[11px] text-zinc-500 line-through">
                                {pricing.crossedOutXOF.toLocaleString('fr-FR')} FCFA
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                        <button
                          onClick={() => {
                            setEditingCourse(c);
                            setShowFinalQuizEditor(false);
                            setShowCourseModal(true);
                          }}
                          className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700 flex items-center gap-1 cursor-pointer min-h-[40px]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifier / Tarifs / Programme</span>
                        </button>
                        <button
                          onClick={() => saveCourse({ ...c, isPublished: !c.isPublished })}
                          className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 border border-zinc-800 cursor-pointer min-h-[40px]"
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
                              className="px-2.5 py-2 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setConfirmDeleteKey(null)}
                              className="px-2.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-[11px] cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteKey(`course-${c.id}`)}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-950/40 cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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
                        {dom.code}. {dom.title} ({dom.shortLabel})
                      </span>
                      <span className="text-zinc-400 text-[11px] block mt-0.5">{dom.description}</span>
                    </div>
                    {domains.length > 1 &&
                      (confirmDeleteKey === `dom-${dom.id}` ? (
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
                          className="text-red-400 hover:text-red-300 p-1.5 cursor-pointer shrink-0"
                          title="Supprimer cette catégorie"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
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
                    className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                  <input
                    type="text"
                    value={newDomainShort}
                    onChange={(e) => setNewDomainShort(e.target.value)}
                    placeholder="Nom court filtre (ex: Design IA)"
                    className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                  <input
                    type="text"
                    value={newDomainDesc}
                    onChange={(e) => setNewDomainDesc(e.target.value)}
                    placeholder="Description courte"
                    className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
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
                  className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer min-h-[40px]"
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-brand text-xl font-bold text-slate-100">Gestion des Apprenants</h2>
                <p className="text-xs text-zinc-400">
                  Consultez les comptes apprenants, progression, devoirs, certificats et attribuez ou révoquez manuellement des accès.
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Rechercher nom, email, pays..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400">
                  Aucun apprenant ne correspond à votre recherche.
                </div>
              ) : (
                filteredStudents.map((stu) => (
                  <div key={stu.id} className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-brand font-bold text-base text-slate-100 block">{stu.name}</span>
                        <span className="text-zinc-400">
                          {stu.email} {stu.phone ? `· ${stu.phone}` : ''} {stu.country ? `· ${stu.country}` : ''}
                        </span>
                      </div>
                      <div className="text-zinc-400 font-mono tabular-nums text-[11px]">
                        {stu.completedLessonIds.length} leçon(s) · {Object.keys(stu.submittedExercises || {}).length} devoir(s) · {Object.keys(stu.quizScores || {}).length} quiz · {stu.certificates.length} certificat(s)
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-900 space-y-2">
                      <span className="text-[11px] text-zinc-400 font-semibold block">
                        Accès manuels aux formations :
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {courses.map((c) => {
                          const enrolled = stu.enrolledCourseIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() =>
                                enrolled ? revokeCourseAccess(stu.id, c.id) : grantManualCourseAccess(stu.id, c.id)
                              }
                              className={`px-3 py-2 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors min-h-[38px] ${
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
                ))
              )}
            </div>

            {/* Issued Certificates Registry (Admin Read + PDF Export) */}
            <div className="pt-6 border-t border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#D4AF37]" />
                    <span>Certificats Officiels Délivrés ({deliveredCertificates.length})</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Registre vérifié des certificats attribués aux apprenants ayant complété leur cursus.
                  </p>
                </div>
              </div>

              {adminCertError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-700/70 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{adminCertError}</span>
                </div>
              )}

              {deliveredCertificates.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 text-center">
                  Aucun certificat officiel délivré pour le moment.
                </div>
              ) : (
                <div className="rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                        <tr>
                          <th className="p-3.5">Apprenant</th>
                          <th className="p-3.5">Formation</th>
                          <th className="p-3.5">Code unique</th>
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5 text-right">PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900">
                        {deliveredCertificates.map((cert) => (
                          <tr key={cert.id} className="hover:bg-zinc-900/40">
                            <td className="p-3.5">
                              <span className="font-semibold text-slate-100 block">{cert.studentName}</span>
                              <span className="text-[11px] text-zinc-500">{cert.studentEmail}</span>
                            </td>
                            <td className="p-3.5 text-zinc-200">{cert.courseTitle}</td>
                            <td className="p-3.5 font-mono text-[#D4AF37] font-semibold">
                              {cert.verificationCode}
                            </td>
                            <td className="p-3.5 text-zinc-400 whitespace-nowrap">{cert.issuedDate}</td>
                            <td className="p-3.5 text-right">
                              <button
                                type="button"
                                disabled={downloadingAdminCertId === cert.id}
                                onClick={async () => {
                                  setDownloadingAdminCertId(cert.id);
                                  setAdminCertError(null);
                                  const res = await downloadCertificatePdf(cert.id, cert.verificationCode);
                                  setDownloadingAdminCertId(null);
                                  if (!res.ok) {
                                    setAdminCertError(res.error || 'Erreur lors du téléchargement PDF.');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-[#D4AF37] hover:text-zinc-950 border border-[#D4AF37]/40 text-[#F3E5AB] font-semibold text-[11px] transition-colors cursor-pointer disabled:opacity-60"
                              >
                                {downloadingAdminCertId === cert.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>PDF</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ORDERS & PROMO CODES */}
        {activeTab === 'orders' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-brand text-xl font-bold text-slate-100">
                  Commandes, Ventes Réelles & Codes Promo
                </h2>
                <p className="text-xs text-zinc-400">
                  Les commandes marquées TEST DÉMO sont isolées des ventes réelles vérifiées.
                </p>
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-200 cursor-pointer"
              >
                <option value="all">Toutes les commandes ({orders.length})</option>
                <option value="real">Ventes réelles uniquement ({realOrders.length})</option>
                <option value="demo">Tests Démo uniquement ({demoOrders.length})</option>
                <option value="confirmed">Confirmées ({orders.filter((o) => o.status === 'confirmed').length})</option>
                <option value="pending">En attente ({pendingOrders.length})</option>
                <option value="failed">Échouées / Annulées ({failedOrders.length})</option>
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
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-500">
                          Aucune commande pour ce filtre.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-zinc-900/40">
                          <td className="p-4 font-mono font-bold text-[#F3E5AB]">
                            {ord.reference}
                            {ord.isDemoTransaction ? (
                              <span className="block text-[9px] text-amber-400 font-semibold">TEST DÉMO (NON PAYÉE)</span>
                            ) : (
                              <span className="block text-[9px] text-emerald-400 font-semibold">VENTE RÉELLE</span>
                            )}
                          </td>
                          <td className="p-4 text-zinc-400 text-[11px] whitespace-nowrap">
                            {new Date(ord.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-slate-200 block">{ord.userName}</span>
                            <span className="text-[10px] text-zinc-500">{ord.userEmail}</span>
                          </td>
                          <td className="p-4 text-zinc-300 max-w-[200px] truncate">{ord.courseTitle}</td>
                          <td className="p-4 text-zinc-400 whitespace-nowrap">
                            {ord.paymentMethod.toUpperCase()} ({ord.paymentProvider})
                          </td>
                          <td className="p-4 font-mono font-bold text-[#D4AF37] tabular-nums whitespace-nowrap">
                            {ord.amount.toLocaleString('fr-FR')} {ord.currency}
                          </td>
                          <td className="p-4">
                            <select
                              value={ord.status}
                              onChange={(e) => updateOrderStatus(ord.id, e.target.value as any)}
                              className="bg-zinc-900 border border-zinc-700 text-[11px] rounded px-2 py-1.5 text-slate-200 cursor-pointer"
                            >
                              <option value="confirmed">Confirmé (Activer accès)</option>
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

                              {ord.status === 'confirmed' &&
                                (confirmRefundOrderId === ord.id ? (
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
                                ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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
                        className="px-2.5 py-1.5 rounded bg-zinc-800 text-[11px] text-zinc-300 cursor-pointer"
                      >
                        {p.isActive ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        onClick={() => deletePromoCode(p.id)}
                        className="text-red-400 p-1.5 cursor-pointer"
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
                  className="px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 uppercase font-mono"
                />
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={newPromoPercent}
                  onChange={(e) => setNewPromoPercent(Number(e.target.value))}
                  className="w-24 px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
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
                  className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold cursor-pointer min-h-[40px]"
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
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h2 className="font-brand text-lg font-bold text-slate-100">
                Formules & Tarifs d’Accompagnement (1-sur-1 & Bootcamps)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {coachingPrograms.map((prog) => (
                  <div key={prog.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <input
                      type="text"
                      value={prog.title}
                      onChange={(e) => saveCoachingProgram({ ...prog, title: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 font-bold text-[#F3E5AB]"
                    />
                    <input
                      type="text"
                      value={prog.duration}
                      onChange={(e) => saveCoachingProgram({ ...prog, duration: e.target.value })}
                      placeholder="Durée de la formule"
                      className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-300"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-zinc-400 block mb-1">FCFA</label>
                        <input
                          type="number"
                          value={prog.priceXOF}
                          onChange={(e) => saveCoachingProgram({ ...prog, priceXOF: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">EUR (€)</label>
                        <input
                          type="number"
                          value={prog.priceEUR}
                          onChange={(e) => saveCoachingProgram({ ...prog, priceEUR: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">USD ($)</label>
                        <input
                          type="number"
                          value={prog.priceUSD}
                          onChange={(e) => saveCoachingProgram({ ...prog, priceUSD: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-brand text-xl font-bold text-slate-100">
                Demandes d’Accompagnement Reçues ({coachingRequests.length})
              </h2>
              <button
                type="button"
                onClick={() => refreshSupabaseAdminData()}
                disabled={adminDataLoading}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer self-start sm:self-auto disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminDataLoading ? 'animate-spin' : ''}`} />
                <span>{adminDataLoading ? 'Actualisation...' : 'Actualiser'}</span>
              </button>
            </div>

            {coachingRequestsError && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-700/70 text-xs text-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>Erreur lecture Supabase (coaching_requests) : {coachingRequestsError}</span>
              </div>
            )}

            {coachingActionFeedback && (
              <div
                className={`p-3 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                  coachingActionFeedback.ok
                    ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                    : 'bg-red-950/60 border-red-700/60 text-red-200'
                }`}
              >
                <span>{coachingActionFeedback.message}</span>
                <button
                  type="button"
                  onClick={() => setCoachingActionFeedback(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-4">
              {coachingRequests.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400">
                  Aucune demande d’accompagnement reçue pour le moment.
                </div>
              ) : (
                coachingRequests.map((req) => (
                  <div key={req.id} className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-[#D4AF37] font-semibold block">
                          {req.type === 'individual' ? 'Accompagnement Individuel VIP' : 'Accompagnement Collectif'} · {req.programTitle}
                        </span>
                        <h3 className="font-brand text-base font-bold text-slate-100">
                          {req.userName} ({req.userEmail} · {req.userPhone})
                        </h3>
                        <span className="text-[11px] text-zinc-500 block mt-0.5">
                          Reçue le {new Date(req.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>

                      <select
                        value={req.status}
                        onChange={async (e) => {
                          const res = await updateCoachingStatus(req.id, e.target.value as any);
                          setCoachingActionFeedback(
                            res.ok
                              ? { ok: true, message: 'Statut mis à jour et synchronisé.' }
                              : { ok: false, message: res.error || 'Échec mise à jour du statut.' }
                          );
                        }}
                        className="bg-zinc-900 border border-zinc-700 text-xs rounded-lg px-3 py-2 text-slate-200 cursor-pointer"
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-zinc-900">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">
                          Date souhaitée : <strong className="text-slate-200">{req.preferredDate}</strong> · Lien visio
                        </label>
                        <input
                          type="url"
                          defaultValue={req.meetingLink || ''}
                          placeholder="Lien Google Meet / Zoom..."
                          onBlur={async (e) => {
                            if (e.target.value !== (req.meetingLink || '')) {
                              const res = await updateCoachingStatus(req.id, req.status, e.target.value);
                              if (!res.ok) {
                                setCoachingActionFeedback({
                                  ok: false,
                                  message: res.error || 'Échec sauvegarde du lien visio.'
                                });
                              }
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Notes internes Direction</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={coachNoteDrafts[req.id] ?? req.adminNotes ?? ''}
                            onChange={(e) =>
                              setCoachNoteDrafts((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            placeholder="Observations privées Faith Ariola..."
                            className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await updateCoachingStatus(
                                req.id,
                                req.status,
                                req.meetingLink,
                                coachNoteDrafts[req.id] ?? req.adminNotes ?? ''
                              );
                              setCoachingActionFeedback(
                                res.ok
                                  ? { ok: true, message: 'Notes enregistrées dans Supabase.' }
                                  : { ok: false, message: res.error || 'Échec sauvegarde des notes.' }
                              );
                            }}
                            className="px-3 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-[11px] cursor-pointer shrink-0"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 6: CONTACT MESSAGES */}
        {activeTab === 'messages' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-brand text-xl font-bold text-slate-100">
                  Messages & Demandes de Contact ({contactMessages.length})
                </h2>
                <p className="text-xs text-zinc-400">
                  Consultez les messages envoyés depuis la page Contact, annotez-les et répondez directement.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={messageFilter}
                  onChange={(e) => setMessageFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-200 cursor-pointer"
                >
                  <option value="all">Tous ({contactMessages.length})</option>
                  <option value="new">Non lus ({unreadMessagesCount})</option>
                  <option value="read">Lus</option>
                  <option value="replied">Répondus</option>
                  <option value="archived">Archivés</option>
                </select>
                <button
                  type="button"
                  onClick={refreshAdminTelemetry}
                  className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Actualiser</span>
                </button>
              </div>
            </div>

            {filteredMessages.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <Mail className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">Aucun message reçu pour ce filtre.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-5 rounded-2xl bg-zinc-950 border space-y-4 text-xs ${
                      msg.status === 'new' ? 'border-[#D4AF37]/60' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-brand text-base font-bold text-slate-100">{msg.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              msg.status === 'new'
                                ? 'bg-[#D4AF37]/20 text-[#F3E5AB] border border-[#D4AF37]/50'
                                : msg.status === 'replied'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                                : 'bg-zinc-900 text-zinc-400 border border-zinc-700'
                            }`}
                          >
                            {msg.status === 'new'
                              ? 'Nouveau'
                              : msg.status === 'read'
                              ? 'Lu'
                              : msg.status === 'replied'
                              ? 'Répondu'
                              : 'Archivé'}
                          </span>
                        </div>
                        <span className="text-zinc-400 block mt-0.5">
                          {msg.email} {msg.phone ? `· ${msg.phone}` : ''} ·{' '}
                          {new Date(msg.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>

                      <select
                        value={msg.status}
                        onChange={(e) =>
                          updateContactMessageStatus(msg.id, e.target.value as ContactMessage['status'])
                        }
                        className="bg-zinc-900 border border-zinc-700 text-xs rounded-lg px-3 py-2 text-slate-200 cursor-pointer"
                      >
                        <option value="new">Nouveau</option>
                        <option value="read">Marquer comme lu</option>
                        <option value="replied">Répondu</option>
                        <option value="archived">Archivé</option>
                      </select>
                    </div>

                    <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1.5">
                      <span className="text-[11px] font-semibold text-[#D4AF37] block">
                        Objet : {msg.subject}
                      </span>
                      <p className="text-zinc-200 whitespace-pre-line leading-relaxed">{msg.message}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: ${msg.subject} — ${siteSettings.academyName}`)}`}
                          onClick={() => updateContactMessageStatus(msg.id, 'replied')}
                          className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-[11px] inline-flex items-center gap-1.5"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Répondre par Email</span>
                        </a>
                        {msg.phone && (
                          <a
                            href={`https://wa.me/${msg.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 font-semibold text-[11px] inline-flex items-center gap-1.5"
                          >
                            <span>WhatsApp</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex gap-2 flex-1 sm:max-w-sm">
                        <input
                          type="text"
                          value={msgNoteDrafts[msg.id] ?? msg.adminNotes ?? ''}
                          onChange={(e) =>
                            setMsgNoteDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))
                          }
                          placeholder="Note interne Direction..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateContactMessageStatus(
                              msg.id,
                              msg.status,
                              msgNoteDrafts[msg.id] ?? msg.adminNotes ?? ''
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold cursor-pointer"
                        >
                          Sauver
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 7: PAYMENTS & LIVE NOTIFICATIONS / WEBHOOKS */}
        {activeTab === 'payments' && (
          <div className="space-y-8">
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-brand text-xl font-bold text-slate-100">
                    Passerelles de Paiement & Webhooks (Côté Serveur)
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Mobile Money et cartes bancaires via FedaPay (selon les moyens activés et vérifiés sur le compte). Les clés secrètes restent strictement sur le serveur.
                  </p>
                </div>
                <button
                  onClick={() => {
                    refreshServerPaymentStatus();
                    refreshAdminTelemetry();
                  }}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer self-start"
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
                    Prestataire sélectionné : <strong className="text-white">{paymentConfig.activeProvider.toUpperCase()}</strong> · Mode : <strong className="text-white">{paymentConfig.isTestMode ? 'Sandbox / Test' : 'Production Live'}</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { name: 'MTN Mobile Money', desc: 'Bénin & Afrique de l’Ouest' },
                  { name: 'Moov Money', desc: 'Bénin & UEMOA' },
                  { name: 'Carte Visa', desc: 'Paiement international' },
                  { name: 'Mastercard', desc: 'Paiement international' }
                ].map((m) => (
                  <div key={m.name} className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-1">
                    <span className="font-bold text-slate-100 block">{m.name}</span>
                    <span className="text-[11px] text-zinc-400 block">{m.desc}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3 text-xs">
                <span className="font-semibold text-[#F3E5AB] block">
                  URL Webhook à renseigner chez votre prestataire ({paymentConfig.activeProvider.toUpperCase()})
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-[11px] break-all">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={copyWebhookUrl}
                    className="px-3.5 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copié' : 'Copier l’URL'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Variables serveur requises sur Render : <code className="text-zinc-200">PAYMENT_PROVIDER</code>, <code className="text-zinc-200">PAYMENT_MODE</code> (<code className="text-zinc-200">sandbox</code> ou <code className="text-zinc-200">live</code>) et les clés FedaPay (<code className="text-zinc-200">FEDAPAY_PUBLIC_KEY</code>, <code className="text-zinc-200">FEDAPAY_SECRET_KEY</code>, <code className="text-zinc-200">FEDAPAY_WEBHOOK_SECRET</code>).
                </p>
              </div>
            </div>

            {/* Live Server Payment Events & Notifications */}
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#D4AF37]" />
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    Journal des Événements Paiements & Webhooks ({paymentEvents.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={refreshAdminTelemetry}
                  className="text-xs text-[#D4AF37] hover:underline cursor-pointer"
                >
                  Actualiser le flux
                </button>
              </div>

              {paymentEventsError && (
                <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{paymentEventsError}</span>
                  </div>
                  {paymentEventsAuthBlocked && (
                    <button
                      type="button"
                      onClick={() => openAuthModal('admin')}
                      className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Se reconnecter à la Direction
                    </button>
                  )}
                </div>
              )}

              {!paymentEventsError && paymentEventsNotice && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-[#D4AF37]/40 text-[11px] text-[#F3E5AB]">
                  {paymentEventsNotice}
                </div>
              )}

              {!paymentEventsError && paymentEvents.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  Aucun événement de paiement ou webhook enregistré pour le moment.
                </p>
              ) : paymentEvents.length > 0 ? (
                <div className="space-y-2.5">
                  {paymentEvents.map((evt) => {
                    const isLiveMode = evt.mode === 'live';
                    return (
                      <div
                        key={evt.id}
                        className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[#F3E5AB]">{evt.reference || 'N/A'}</span>
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              {evt.provider} · {evt.event}
                            </span>
                            <span
                              className={`text-[10px] uppercase px-2 py-0.5 rounded border font-bold ${
                                isLiveMode
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : 'bg-amber-950/70 text-[#F3E5AB] border-[#D4AF37]/40'
                              }`}
                            >
                              {isLiveMode ? 'Live' : 'Sandbox'}
                            </span>
                            <span className="text-[10px] uppercase text-[#D4AF37] font-semibold">
                              {evt.status}
                            </span>
                          </div>
                          <p className="text-zinc-300">{evt.detail}</p>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                          {new Date(evt.receivedAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TAB 8: SITE IDENTITY, LOGO, LEGAL TEXTS & VERIFIED TESTIMONIALS */}
        {activeTab === 'identity' && (
          <div className="space-y-8">
            <form onSubmit={handleSaveSettings} className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-6">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="font-brand text-xl font-bold text-slate-100">
                  Identité de Marque, Logo, Coordonnées & Textes Légaux
                </h2>
              </div>

              {/* Official Logo */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-xl bg-zinc-950 border border-[#D4AF37]/40 flex items-center justify-center overflow-hidden shrink-0">
                  {settingsForm.agencyLogoDataUrl ? (
                    <img
                      src={settingsForm.agencyLogoDataUrl}
                      alt={settingsForm.parentAgencyName}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="font-brand text-3xl font-bold text-[#D4AF37]">D</span>
                  )}
                </div>
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-slate-200 block">
                    Logo officiel de l’Académie / Maison mère
                  </span>
                  <p className="text-zinc-400">
                    Formats recommandés : PNG transparent, SVG ou JPG. Affiché dans la barre supérieure, le pied de page et les certificats.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label className="px-4 py-2 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold cursor-pointer">
                      Importer un logo
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

              {/* Brand & Director Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Nom de l’académie</label>
                  <input
                    type="text"
                    value={settingsForm.academyName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, academyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Maison mère</label>
                  <input
                    type="text"
                    value={settingsForm.parentAgencyName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, parentAgencyName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Fondatrice & Directrice</label>
                  <input
                    type="text"
                    value={settingsForm.directorName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, directorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              {/* Presentations & Bio */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Présentation de l’académie (Accueil & Pied de page)</label>
                  <textarea
                    rows={2}
                    value={settingsForm.academyPresentation}
                    onChange={(e) => setSettingsForm({ ...settingsForm, academyPresentation: e.target.value })}
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Présentation de la maison mère (À propos)</label>
                  <textarea
                    rows={2}
                    value={settingsForm.parentAgencyPresentation}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, parentAgencyPresentation: e.target.value })
                    }
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Biographie de la Directrice</label>
                  <textarea
                    rows={2}
                    value={settingsForm.directorBio}
                    onChange={(e) => setSettingsForm({ ...settingsForm, directorBio: e.target.value })}
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
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
                  <label className="text-zinc-400 block mb-1">Téléphone Direction</label>
                  <input
                    type="text"
                    value={settingsForm.contactPhone}
                    onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Numéro WhatsApp</label>
                  <input
                    type="text"
                    value={settingsForm.whatsappNumber}
                    onChange={(e) => setSettingsForm({ ...settingsForm, whatsappNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Adresse / Siège</label>
                  <input
                    type="text"
                    value={settingsForm.headquarters}
                    onChange={(e) => setSettingsForm({ ...settingsForm, headquarters: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-zinc-400 block mb-1">Horaires de permanence</label>
                  <input
                    type="text"
                    value={settingsForm.supportHours}
                    onChange={(e) => setSettingsForm({ ...settingsForm, supportHours: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Lien Instagram (optionnel)</label>
                  <input
                    type="url"
                    value={settingsForm.instagramUrl || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Lien LinkedIn (optionnel)</label>
                  <input
                    type="url"
                    value={settingsForm.linkedinUrl || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Lien YouTube (optionnel)</label>
                  <input
                    type="url"
                    value={settingsForm.youtubeUrl || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, youtubeUrl: e.target.value })}
                    placeholder="https://youtube.com/..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              {/* Legal Texts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1">Mentions Légales</label>
                  <textarea
                    rows={5}
                    value={settingsForm.legalNotices}
                    onChange={(e) => setSettingsForm({ ...settingsForm, legalNotices: e.target.value })}
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Conditions Générales de Vente (CGV)</label>
                  <textarea
                    rows={5}
                    value={settingsForm.termsOfSale}
                    onChange={(e) => setSettingsForm({ ...settingsForm, termsOfSale: e.target.value })}
                    className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
              </div>

              {settingsSaved && (
                <p className="text-xs text-emerald-400 font-medium">
                  ✓ Identité, coordonnées et textes légaux enregistrés et synchronisés sur le site.
                </p>
              )}

              <button
                type="submit"
                className="px-6 py-3 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs cursor-pointer min-h-[44px]"
              >
                Enregistrer toute l’identité et les textes légaux
              </button>
            </form>

            {/* Verified Testimonials Manager */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex items-center gap-2">
                <MessageSquareQuote className="w-5 h-5 text-[#D4AF37]" />
                <h2 className="font-brand text-xl font-bold text-slate-100">
                  Témoignages Réels d’Apprenants ({testimonials.length})
                </h2>
              </div>
              <p className="text-xs text-zinc-400">
                Aucun témoignage fictif n’est affiché. Seuls les avis réels publiés ici apparaissent sur la page d’accueil.
              </p>

              {testimonials.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {testimonials.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-[#F3E5AB]">{t.authorName} · {t.authorRole}</strong>
                        <button onClick={() => deleteTestimonial(t.id)} className="text-red-400 cursor-pointer p-1">
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
                className="px-4 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer"
              >
                Publier ce témoignage vérifié
              </button>
            </div>
          </div>
        )}

        {/* TAB 9: LAUNCH CENTER & SUPABASE BACKUP/SYNC */}
        {activeTab === 'launch-center' && (
          <div className="space-y-8">
            <LaunchCenter
              onNavigateAdminTab={(tab) => setActiveTab(tab === 'settings' ? 'payments' : tab)}
            />

            {/* Cloud Backup & Non-Destructive Sync Tools */}
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
              <div className="flex items-center gap-2.5">
                <Database className="w-5 h-5 text-[#D4AF37]" />
                <div>
                  <h2 className="font-brand text-xl font-bold text-slate-100">
                    Sauvegarde Locale (.json) & Synchronisation Supabase
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Exportez votre catalogue complet avant toute opération cloud et synchronisez sans écrasement.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                      message: `✓ Sauvegarde locale téléchargée (${meta.fileName}).`
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
                  <span>{migratingCloud ? 'Synchronisation...' : 'Synchroniser le catalogue vers Supabase'}</span>
                </button>

                {infraStatus?.supabase.serverConnected && (
                  <button
                    type="button"
                    disabled={adminDataLoading}
                    onClick={refreshSupabaseAdminData}
                    className="px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${adminDataLoading ? 'animate-spin text-[#D4AF37]' : ''}`} />
                    <span>{adminDataLoading ? 'Actualisation...' : 'Actualiser apprenants & commandes cloud'}</span>
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
          </div>
        )}

      </div>

      {/* Course + Pricing + Promo + Curriculum Editor Modal */}
      {showCourseModal && editingCourse && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-3xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-5 sm:p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h3 className="font-brand text-lg font-bold text-slate-100">
                Édition Formation, Tarifs & Programme
              </h3>
              <button onClick={() => setShowCourseModal(false)} className="p-1.5 text-zinc-400 hover:text-white cursor-pointer">
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

              {/* Base Prices */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <span className="font-bold text-[#F3E5AB] block">Tarifs Normaux</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Prix FCFA (XOF) *</label>
                    <input
                      type="number"
                      required
                      value={editingCourse.priceXOF}
                      onChange={(e) => setEditingCourse({ ...editingCourse, priceXOF: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Prix EUR (€)</label>
                    <input
                      type="number"
                      value={editingCourse.priceEUR}
                      onChange={(e) => setEditingCourse({ ...editingCourse, priceEUR: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Prix USD ($)</label>
                    <input
                      type="number"
                      value={editingCourse.priceUSD}
                      onChange={(e) => setEditingCourse({ ...editingCourse, priceUSD: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-slate-100"
                    />
                  </div>
                </div>

                {/* Promotion Toggle & Promo Prices */}
                <div className="pt-3 border-t border-zinc-800 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCourse.promoActive)}
                      onChange={(e) =>
                        setEditingCourse({
                          ...editingCourse,
                          promoActive: e.target.checked,
                          promoPriceXOF:
                            e.target.checked && !editingCourse.promoPriceXOF
                              ? Math.round(editingCourse.priceXOF * 0.8)
                              : editingCourse.promoPriceXOF
                        })
                      }
                    />
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span className="font-semibold text-slate-100">Activer la promotion sur cette formation</span>
                  </label>

                  {editingCourse.promoActive && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-zinc-400 block mb-1">Prix Promo FCFA *</label>
                        <input
                          type="number"
                          value={editingCourse.promoPriceXOF ?? ''}
                          onChange={(e) =>
                            setEditingCourse({
                              ...editingCourse,
                              promoPriceXOF: e.target.value ? Number(e.target.value) : undefined
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-[#D4AF37]/50 text-[#F3E5AB]"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">Prix Promo EUR (€)</label>
                        <input
                          type="number"
                          value={editingCourse.promoPriceEUR ?? ''}
                          onChange={(e) =>
                            setEditingCourse({
                              ...editingCourse,
                              promoPriceEUR: e.target.value ? Number(e.target.value) : undefined
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-[#D4AF37]/50 text-[#F3E5AB]"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 block mb-1">Prix Promo USD ($)</label>
                        <input
                          type="number"
                          value={editingCourse.promoPriceUSD ?? ''}
                          onChange={(e) =>
                            setEditingCourse({
                              ...editingCourse,
                              promoPriceUSD: e.target.value ? Number(e.target.value) : undefined
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-[#D4AF37]/50 text-[#F3E5AB]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cover Image URL + Upload */}
              <div>
                <label className="text-zinc-400 block mb-1">Image de couverture (URL ou téléversement)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingCourse.coverImage}
                    onChange={(e) => setEditingCourse({ ...editingCourse, coverImage: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                  <label className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-zinc-200 font-semibold cursor-pointer flex items-center gap-1.5 shrink-0">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Image</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Objectifs (1 par ligne)</label>
                  <textarea
                    rows={3}
                    value={editingCourse.objectives.join('\n')}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        objectives: e.target.value.split('\n').filter((l) => l.trim().length > 0)
                      })
                    }
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Compétences acquises (1 par ligne)</label>
                  <textarea
                    rows={3}
                    value={editingCourse.skillsAcquired.join('\n')}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        skillsAcquired: e.target.value.split('\n').filter((l) => l.trim().length > 0)
                      })
                    }
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Ressources incluses (1 par ligne)</label>
                  <textarea
                    rows={3}
                    value={editingCourse.resourcesIncluded.join('\n')}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        resourcesIncluded: e.target.value.split('\n').filter((l) => l.trim().length > 0)
                      })
                    }
                    className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100"
                  />
                </div>
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
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveModule(modIndex, 1)}
                              disabled={modIndex === editingCourse.modules.length - 1}
                              className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
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
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveLesson(mod.id, lesIndex, 1)}
                                    disabled={lesIndex === mod.lessons.length - 1}
                                    className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingLessonId(editingLessonId === les.id ? null : les.id)}
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
                                                    l.id === les.id
                                                      ? { ...l, videoUrl: e.target.value || undefined }
                                                      : l
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

              {/* Final Exam / Quiz Editor (persisted safely in course_private_contents.final_quiz) */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-[#F3E5AB] block">
                      Examen final / Quiz certifiant ({editingCourse.finalQuiz?.length || 0} question(s))
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Sauvegardé dans le coffre privé Supabase (accessible uniquement aux apprenants inscrits).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFinalQuizEditor((v) => !v)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-slate-200 font-semibold text-[11px] cursor-pointer"
                  >
                    {showFinalQuizEditor ? 'Masquer l’examen final' : 'Gérer l’examen final'}
                  </button>
                </div>

                {showFinalQuizEditor && (
                  <div className="space-y-3 pt-2 border-t border-zinc-800">
                    {(editingCourse.finalQuiz || []).length === 0 ? (
                      <p className="text-[11px] text-zinc-400">
                        Aucune question définie pour l’examen final de cette formation.
                      </p>
                    ) : (
                      (editingCourse.finalQuiz || []).map((q, qIdx) => (
                        <div key={q.id} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#D4AF37]">Question {qIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const remaining = (editingCourse.finalQuiz || []).filter((item) => item.id !== q.id);
                                setEditingCourse({
                                  ...editingCourse,
                                  finalQuiz: remaining.length > 0 ? remaining : undefined
                                });
                              }}
                              className="text-red-400 hover:underline cursor-pointer"
                            >
                              Supprimer
                            </button>
                          </div>
                          <input
                            type="text"
                            value={q.question}
                            onChange={(e) =>
                              setEditingCourse({
                                ...editingCourse,
                                finalQuiz: (editingCourse.finalQuiz || []).map((item) =>
                                  item.id === q.id ? { ...item, question: e.target.value } : item
                                )
                              })
                            }
                            placeholder="Intitulé de la question"
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-slate-100"
                          />
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-1.5">
                                <input
                                  type="radio"
                                  name={`fq-correct-${q.id}`}
                                  checked={q.correctIndex === optIdx}
                                  onChange={() =>
                                    setEditingCourse({
                                      ...editingCourse,
                                      finalQuiz: (editingCourse.finalQuiz || []).map((item) =>
                                        item.id === q.id ? { ...item, correctIndex: optIdx } : item
                                      )
                                    })
                                  }
                                  title="Bonne réponse"
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) =>
                                    setEditingCourse({
                                      ...editingCourse,
                                      finalQuiz: (editingCourse.finalQuiz || []).map((item) =>
                                        item.id === q.id
                                          ? {
                                              ...item,
                                              options: item.options.map((o, i) => (i === optIdx ? e.target.value : o))
                                            }
                                          : item
                                      )
                                    })
                                  }
                                  placeholder={`Choix ${optIdx + 1}`}
                                  className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-slate-100"
                                />
                              </div>
                            ))}
                          </div>
                          <input
                            type="text"
                            value={q.explanation}
                            onChange={(e) =>
                              setEditingCourse({
                                ...editingCourse,
                                finalQuiz: (editingCourse.finalQuiz || []).map((item) =>
                                  item.id === q.id ? { ...item, explanation: e.target.value } : item
                                )
                              })
                            }
                            placeholder="Explication pédagogique affichée après correction"
                            className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300"
                          />
                        </div>
                      ))
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const newQ: QuizQuestion = {
                          id: `fq-${Date.now()}`,
                          question: 'Nouvelle question de validation finale',
                          options: ['Réponse A', 'Réponse B', 'Réponse C', 'Réponse D'],
                          correctIndex: 0,
                          explanation: 'Explication pédagogique DJIFFA ACADEMY.'
                        };
                        setEditingCourse({
                          ...editingCourse,
                          finalQuiz: [...(editingCourse.finalQuiz || []), newQ]
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-slate-100 font-semibold text-[11px] cursor-pointer"
                    >
                      + Ajouter une question à l’examen final
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
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

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingCourse.certificateEligible}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, certificateEligible: e.target.checked })
                    }
                  />
                  <span className="text-slate-200">Délivre un certificat</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-zinc-900 text-zinc-300 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold cursor-pointer"
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
