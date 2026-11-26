/**
 * DJIFFA ACADEMY - Centre de configuration et de lancement
 * Espace exclusivement réservé à la Direction (Faith Ariola)
 * Centralise : Supabase, GitHub, Render, Paiements, Vidéos/Ressources, Sécurité et Mise en ligne
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getSupabaseAccessToken } from '../lib/supabase';
import {
  createPreMigrationBackup,
  loadStoredBackupMeta,
  BackupMeta
} from '../lib/migration';
import {
  Rocket,
  Database,
  GitBranch,
  Server,
  CreditCard,
  Video,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Wrench,
  RefreshCw,
  Copy,
  Check,
  UploadCloud,
  Download,
  Lock,
  ExternalLink,
  ArrowRight,
  FileText,
  Sparkles
} from 'lucide-react';

export type LaunchStepStatus =
  | 'completed'
  | 'prepared'
  | 'missing_connection'
  | 'external_action'
  | 'error';

interface LaunchAuditResponse {
  ok: boolean;
  auditedAt: string;
  supabase: {
    viteUrlSet: boolean;
    viteAnonKeySet: boolean;
    serverUrlSet: boolean;
    serviceRoleKeySet: boolean;
    browserReady: boolean;
    serverReady: boolean;
    fullyConfigured: boolean;
    schemaFileReady: boolean;
    bucketsExpected: string[];
  };
  github: {
    gitInitialized: boolean;
    branch: string | null;
    headCommitShort: string | null;
    remoteOriginConfigured: boolean;
    remoteOriginUrl: string | null;
    officialRepoUrl?: string;
    source?: 'render' | 'local-git' | 'ai-studio' | 'none';
    gitignoreProtectsEnv: boolean;
    readmeReady: boolean;
    deploymentGuideReady: boolean;
  };
  render: {
    renderYamlReady: boolean;
    distBuilt: boolean;
    buildScriptReady: boolean;
    startScriptReady: boolean;
    appUrlConfigured: boolean;
    isProductionMode: boolean;
  };
  payments: {
    activeProvider: 'fedapay' | 'kkiapay' | 'cinetpay';
    mode: 'sandbox' | 'live';
    activeConfigured: boolean;
    webhookPath: string;
    providers: {
      fedapay: {
        publicKeySet: boolean;
        secretKeySet: boolean;
        webhookSecretSet: boolean;
        configured: boolean;
        keyEnvironment?: 'sandbox' | 'live' | 'mixed' | 'unknown' | 'unset';
        keyModeAligned?: boolean;
      };
      kkiapay: {
        publicKeySet: boolean;
        privateKeySet: boolean;
        secretSet: boolean;
        configured: boolean;
      };
      cinetpay: {
        apiKeySet: boolean;
        siteIdSet: boolean;
        secretKeySet: boolean;
        configured: boolean;
      };
    };
  };
  security: {
    adminEmail: string;
    customAdminCodeSet: boolean;
    sessionSecretEnvSet: boolean;
    serviceRoleServerOnly: boolean;
    paymentSecretsServerOnly: boolean;
    gitignoreProtectsEnv: boolean;
    envExampleReady: boolean;
    isProductionMode: boolean;
  };
}

interface SupabaseVerifyResult {
  ok: boolean;
  status: LaunchStepStatus;
  httpStatus?: number;
  httpStatusText?: string;
  errorCode?: string;
  message: string;
  tableCounts: { domains: number; courses: number; profiles: number; orders: number } | null;
  tables?: Array<{ name: string; ok: boolean; count: number }>;
  bucketsFound: string[];
  missingBuckets: string[];
  buckets?: Array<{ name: string; ok: boolean; isPublic: boolean }>;
}

interface PaymentVerifyResult {
  ok: boolean;
  provider: 'fedapay' | 'kkiapay' | 'cinetpay';
  status: LaunchStepStatus;
  message: string;
}

interface LaunchCenterProps {
  onNavigateAdminTab: (
    tab: 'overview' | 'launch-center' | 'courses' | 'students' | 'orders' | 'coaching' | 'settings'
  ) => void;
}

const STATUS_META: Record<
  LaunchStepStatus,
  { label: string; badgeClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  completed: {
    label: 'Terminé',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
    Icon: CheckCircle2
  },
  prepared: {
    label: 'Configuration préparée',
    badgeClass: 'bg-sky-950/80 text-sky-300 border-sky-700/80',
    Icon: Wrench
  },
  missing_connection: {
    label: 'Connexion manquante',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
    Icon: AlertTriangle
  },
  external_action: {
    label: 'Action externe nécessaire',
    badgeClass: 'bg-[#D4AF37]/15 text-[#F3E5AB] border-[#D4AF37]/60',
    Icon: Clock
  },
  error: {
    label: 'Erreur',
    badgeClass: 'bg-red-950/80 text-red-300 border-red-700/80',
    Icon: XCircle
  }
};

const StatusBadge: React.FC<{ status: LaunchStepStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-bold tracking-wide shrink-0 ${meta.badgeClass}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{meta.label}</span>
    </span>
  );
};

export const LaunchCenter: React.FC<LaunchCenterProps> = ({ onNavigateAdminTab }) => {
  const {
    currentUser,
    adminToken,
    adminSessionExpiredNotice,
    courses,
    domains,
    promoCodes,
    coachingPrograms,
    testimonials,
    siteSettings,
    students,
    orders,
    coachingRequests,
    migrateLocalCatalogToCloud,
    refreshSupabaseAdminData,
    refreshServerPaymentStatus,
    invalidateExpiredAdminSession,
    openAuthModal
  } = useApp();

  const [audit, setAudit] = useState<LaunchAuditResponse | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditAuthBlocked, setAuditAuthBlocked] = useState<number | null>(null);

  const [supaCheck, setSupaCheck] = useState<SupabaseVerifyResult | null>(null);
  const [supaTesting, setSupaTesting] = useState(false);
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(() => loadStoredBackupMeta());
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState<{ ok: boolean; message: string } | null>(null);

  const [paymentChecks, setPaymentChecks] = useState<
    Partial<Record<'fedapay' | 'kkiapay' | 'cinetpay', PaymentVerifyResult>>
  >({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [verifyingAll, setVerifyingAll] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handlePrepareBackup = useCallback(() => {
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
    setBackupMeta(meta);
    return meta;
  }, [domains, courses, promoCodes, coachingPrograms, testimonials, siteSettings, students, orders, coachingRequests]);

  const buildAuthHeaders = useCallback(async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    try {
      const sbToken = await getSupabaseAccessToken();
      if (sbToken) headers['X-Supabase-Token'] = sbToken;
    } catch {
      // Ignore browser Supabase token read failures so admin token verification still proceeds
    }
    return headers;
  }, [adminToken]);

  const parseJsonSafe = async (res: Response): Promise<{ parsed: any; rawText: string }> => {
    const rawText = await res.text();
    try {
      return { parsed: rawText ? JSON.parse(rawText) : {}, rawText };
    } catch {
      return { parsed: null, rawText };
    }
  };

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch('/api/launch-center/audit', { headers });
      const { parsed } = await parseJsonSafe(res);
      if (res.status === 401 || res.status === 403) {
        setAudit(null);
        setAuditAuthBlocked(res.status);
        setAuditError(
          `Session Direction expirée ou non autorisée côté serveur (HTTP ${res.status}). Veuillez renouveler votre connexion Direction pour charger l’audit réel.`
        );
        return;
      }
      if (!parsed) {
        setAuditAuthBlocked(null);
        setAuditError(`Réponse non valide du serveur (HTTP ${res.status}). Actualisez la page si le serveur vient de redémarrer.`);
        return;
      }
      if (!res.ok || !parsed.ok) {
        setAuditAuthBlocked(null);
        setAuditError(parsed.error || `Impossible de charger l’audit serveur (HTTP ${res.status}).`);
        return;
      }
      setAuditAuthBlocked(null);
      setAudit(parsed as LaunchAuditResponse);
    } catch {
      setAuditError('Serveur Express inaccessible depuis cette fenêtre. Rechargez l’aperçu puis reconnectez-vous à la Direction.');
    } finally {
      setAuditLoading(false);
    }
  }, [buildAuthHeaders]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchAudit();
    }
  }, [currentUser?.role, fetchAudit]);

  const handleVerifySupabase = useCallback(async () => {
    setSupaTesting(true);
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch('/api/launch-center/verify-supabase', { method: 'POST', headers });
      const { parsed } = await parseJsonSafe(res);
      if (res.status === 401 || res.status === 403) {
        setAuditAuthBlocked(res.status);
        setSupaCheck({
          ok: false,
          status: 'external_action',
          message: `Session Direction expirée ou non autorisée côté serveur (HTTP ${res.status}). Cliquez sur « Se reconnecter à la Direction » pour renouveler votre session.`,
          tableCounts: null,
          bucketsFound: [],
          missingBuckets: ['brand-assets', 'course-pdfs', 'course-videos']
        });
        return;
      }
      if (!parsed) {
        setSupaCheck({
          ok: false,
          status: 'error',
          message: `Réponse inattendue de /api/launch-center/verify-supabase (HTTP ${res.status}). Si vous venez d’enregistrer les Secrets, actualisez l’aperçu puis reconnectez-vous.`,
          tableCounts: null,
          bucketsFound: [],
          missingBuckets: ['brand-assets', 'course-pdfs', 'course-videos']
        });
        return;
      }
      const rawMessage = typeof parsed.message === 'string' ? parsed.message.trim() : '';
      const rawError = typeof parsed.error === 'string' ? parsed.error.trim() : '';
      if (!res.ok && rawError) {
        setSupaCheck({
          ok: false,
          status: 'error',
          httpStatus: res.status,
          httpStatusText: res.statusText || undefined,
          message: `${rawError} (HTTP ${res.status})`,
          tableCounts: null,
          bucketsFound: [],
          missingBuckets: ['brand-assets', 'course-pdfs', 'course-videos']
        });
        return;
      }
      const safeMessage =
        rawMessage && !/^Erreur Supabase\s*:?\s*$/i.test(rawMessage)
          ? rawMessage
          : rawError ||
            `Erreur lors de la vérification Supabase (HTTP ${parsed.httpStatus || res.status || '?'}${
              parsed.httpStatusText || res.statusText ? ` ${parsed.httpStatusText || res.statusText}` : ''
            }).`;
      setSupaCheck({
        ...(parsed as SupabaseVerifyResult),
        message: safeMessage
      });
    } catch (err) {
      let healthNote = '';
      try {
        const h = await fetch('/api/health');
        healthNote = h.ok
          ? 'Le serveur Express répond sur /api/health, mais la requête POST a été interrompue (proxy/session).'
          : `Le serveur répond HTTP ${h.status} sur /api/health.`;
      } catch {
        healthNote = 'Le serveur Express ne répond pas dans cet onglet (aperçu arrêté ou redémarré après ajout des Secrets).';
      }
      const detail = err instanceof Error && err.message ? ` [${err.message}]` : '';
      setSupaCheck({
        ok: false,
        status: 'error',
        message: `Impossible de contacter la route de vérification Supabase. ${healthNote}${detail}`,
        tableCounts: null,
        bucketsFound: [],
        missingBuckets: ['brand-assets', 'course-pdfs', 'course-videos']
      });
    } finally {
      setSupaTesting(false);
    }
  }, [buildAuthHeaders]);

  const handleVerifyPayment = useCallback(
    async (provider: 'fedapay' | 'kkiapay' | 'cinetpay') => {
      setTestingProvider(provider);
      try {
        const headers = await buildAuthHeaders();
        const res = await fetch('/api/launch-center/verify-payment', {
          method: 'POST',
          headers,
          body: JSON.stringify({ provider })
        });
        const { parsed } = await parseJsonSafe(res);
        if (res.status === 401 || res.status === 403) {
          setAuditAuthBlocked(res.status);
          setPaymentChecks((prev) => ({
            ...prev,
            [provider]: {
              ok: false,
              provider,
              status: 'external_action',
              message: `Session Direction expirée ou non autorisée (HTTP ${res.status}). Renouvelez votre connexion Direction.`
            }
          }));
          return;
        }
        if (!parsed) {
          setPaymentChecks((prev) => ({
            ...prev,
            [provider]: {
              ok: false,
              provider,
              status: 'error',
              message: `Réponse inattendue du serveur (HTTP ${res.status}). Actualisez l’aperçu.`
            }
          }));
          return;
        }
        if (!res.ok && parsed.error) {
          setPaymentChecks((prev) => ({
            ...prev,
            [provider]: { ok: false, provider, status: 'error', message: parsed.error }
          }));
          return;
        }
        setPaymentChecks((prev) => ({ ...prev, [provider]: parsed as PaymentVerifyResult }));
      } catch {
        setPaymentChecks((prev) => ({
          ...prev,
          [provider]: {
            ok: false,
            provider,
            status: 'error',
            message: 'Erreur réseau pendant le test API.'
          }
        }));
      } finally {
        setTestingProvider(null);
      }
    },
    [buildAuthHeaders]
  );

  const handleVerifyAll = async () => {
    setVerifyingAll(true);
    try {
      await fetchAudit();
      await refreshServerPaymentStatus();
      await handleVerifySupabase();
      const activeProv = audit?.payments.activeProvider || 'fedapay';
      await handleVerifyPayment(activeProv);
    } finally {
      setVerifyingAll(false);
    }
  };

  const copyText = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
  };

  // Strict security gate
  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-8 rounded-2xl bg-zinc-950 border border-red-900/60 text-center space-y-4">
        <Lock className="w-8 h-8 text-red-400 mx-auto" />
        <h3 className="font-brand text-lg font-bold text-slate-100">Accès Direction requis</h3>
        {adminSessionExpiredNotice && (
          <p className="text-xs text-[#F3E5AB] max-w-md mx-auto leading-relaxed">
            {adminSessionExpiredNotice}
          </p>
        )}
        <p className="text-xs text-zinc-400">
          Le Centre de configuration et de lancement est strictement réservé à Faith Ariola.
        </p>
        <button
          type="button"
          onClick={() => openAuthModal('admin')}
          className="px-5 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          Se reconnecter à la Direction
        </button>
      </div>
    );
  }

  const handleRenewAdminAuth = () => {
    invalidateExpiredAdminSession(
      'Session Direction à renouveler pour réexécuter l’audit serveur.'
    );
    openAuthModal('admin');
  };

  // Real catalog media statistics
  const allLessons = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons));
  const lessonsWithVideo = allLessons.filter((l) => Boolean(l.videoUrl && l.videoUrl.trim())).length;
  const lessonsWithPdf = allLessons.filter((l) => Boolean(l.downloads && l.downloads.length > 0)).length;
  const lessonsWithExerciseOrQuiz = allLessons.filter(
    (l) => Boolean(l.exercise) || Boolean(l.quiz && l.quiz.length > 0)
  ).length;
  const publishedCoursesCount = courses.filter((c) => c.isPublished).length;

  // Derive honest status for each of the 7 pillars
  const supabaseStatus: LaunchStepStatus = (() => {
    if (supaCheck) return supaCheck.status;
    if (auditAuthBlocked) return 'external_action';
    if (!audit) return 'prepared';
    if (!audit.supabase.fullyConfigured) {
      return audit.supabase.schemaFileReady ? 'missing_connection' : 'error';
    }
    return 'prepared';
  })();

  const officialGithubUrl =
    audit?.github.officialRepoUrl || 'https://github.com/faiaboky21-ctrl/Djiffa-Academy-1';

  const githubStatus: LaunchStepStatus = (() => {
    if (auditAuthBlocked) return 'external_action';
    if (!audit) return 'prepared';
    if (!audit.github.gitignoreProtectsEnv) return 'error';
    if (audit.github.remoteOriginConfigured) return 'completed';
    if (audit.github.source === 'render') return 'prepared';
    if (audit.github.source === 'ai-studio') return 'prepared';
    if (!audit.github.gitInitialized) return 'error';
    return 'external_action';
  })();

  const renderStatus: LaunchStepStatus = (() => {
    if (auditAuthBlocked) return 'external_action';
    if (!audit) return 'prepared';
    if (!audit.render.renderYamlReady || !audit.render.startScriptReady) return 'error';
    if (audit.render.isProductionMode && audit.render.appUrlConfigured) return 'completed';
    return audit.render.distBuilt ? 'prepared' : 'external_action';
  })();

  const activeProviderKey = audit?.payments.activeProvider || 'fedapay';
  const activePaymentProbe = paymentChecks[activeProviderKey];
  const paymentStatus: LaunchStepStatus = (() => {
    if (activePaymentProbe) return activePaymentProbe.status;
    if (auditAuthBlocked) return 'external_action';
    if (!audit) return 'prepared';
    if (audit.payments.activeConfigured) return 'prepared';
    return 'missing_connection';
  })();

  const videoStatus: LaunchStepStatus = (() => {
    if (supaCheck?.status === 'completed' && lessonsWithVideo > 0) return 'completed';
    if (lessonsWithVideo === allLessons.length && allLessons.length > 0) return 'completed';
    if (lessonsWithVideo > 0) return 'prepared';
    return 'external_action';
  })();

  const securityStatus: LaunchStepStatus = (() => {
    if (auditAuthBlocked) return 'external_action';
    if (!audit) return 'prepared';
    if (
      !audit.security.serviceRoleServerOnly ||
      !audit.security.paymentSecretsServerOnly ||
      !audit.security.gitignoreProtectsEnv
    ) {
      return 'error';
    }
    if (audit.security.customAdminCodeSet && audit.security.sessionSecretEnvSet) return 'completed';
    return 'external_action';
  })();

  // Ordered Launch Checklist (Mise en ligne)
  const launchChecklist: Array<{
    id: string;
    step: number;
    title: string;
    detail: string;
    status: LaunchStepStatus;
    actionLabel?: string;
    onAction?: () => void;
  }> = [
    {
      id: 'step-supabase-keys',
      step: 1,
      title: 'Connecter Supabase (Variables & Projet)',
      detail: !audit
        ? auditAuthBlocked
          ? 'Session Direction expirée : reconnectez-vous pour vérifier les variables Supabase côté serveur.'
          : 'Contrôle des variables Supabase en attente de réponse serveur...'
        : audit.supabase.fullyConfigured
        ? 'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY détectées.'
        : 'Ajoutez vos clés Supabase dans vos variables d’environnement serveur & client.',
      status: !audit
        ? auditAuthBlocked
          ? 'external_action'
          : 'prepared'
        : audit.supabase.fullyConfigured
        ? 'completed'
        : 'missing_connection',
      actionLabel: auditAuthBlocked ? 'Se reconnecter' : 'Tester Supabase',
      onAction: auditAuthBlocked ? handleRenewAdminAuth : handleVerifySupabase
    },
    {
      id: 'step-supabase-sql',
      step: 2,
      title: 'Exécuter supabase/schema.sql & vérifier les tables',
      detail: supaCheck?.tableCounts
        ? `${supaCheck.tableCounts.domains} domaines, ${supaCheck.tableCounts.courses} formations, ${supaCheck.tableCounts.profiles} profils en base.`
        : !audit && auditAuthBlocked
        ? 'Session Direction expirée : reconnectez-vous pour contrôler les tables et buckets Supabase.'
        : 'Le fichier supabase/schema.sql (11 tables + RLS) est prêt à être exécuté dans Supabase SQL Editor.',
      status:
        supaCheck?.status === 'completed' || (supaCheck?.tableCounts && supaCheck.missingBuckets.length === 0)
          ? 'completed'
          : supaCheck?.status === 'error'
          ? 'error'
          : auditAuthBlocked
          ? 'external_action'
          : audit?.supabase.fullyConfigured
          ? 'external_action'
          : 'prepared',
      actionLabel: auditAuthBlocked ? 'Se reconnecter' : 'Vérifier les tables',
      onAction: auditAuthBlocked ? handleRenewAdminAuth : handleVerifySupabase
    },
    {
      id: 'step-supabase-migrate',
      step: 3,
      title: 'Sauvegarder puis migrer le catalogue vers Supabase',
      detail: backupMeta
        ? `Sauvegarde locale prête (${backupMeta.fileName}). ${courses.length} formation(s) prête(s) pour migration non destructive.`
        : `Préparez d’abord une sauvegarde JSON locale avant de migrer vos ${courses.length} formation(s) et ${domains.length} domaines.`,
      status:
        supaCheck?.tableCounts && supaCheck.tableCounts.courses > 0
          ? 'completed'
          : supaCheck?.ok && backupMeta
          ? 'prepared'
          : !audit
          ? auditAuthBlocked
            ? 'external_action'
            : 'prepared'
          : audit.supabase.serverReady
          ? 'external_action'
          : 'missing_connection',
      actionLabel: !backupMeta ? 'Sauvegarder (.json)' : migrating ? 'Migration...' : 'Migrer maintenant',
      onAction: async () => {
        if (!backupMeta) {
          handlePrepareBackup();
          return;
        }
        if (auditAuthBlocked) {
          handleRenewAdminAuth();
          return;
        }
        if (!supaCheck?.ok) {
          await handleVerifySupabase();
          return;
        }
        setMigrating(true);
        setMigrateMsg(null);
        try {
          const r = await migrateLocalCatalogToCloud();
          setMigrateMsg(r);
          await handleVerifySupabase();
        } finally {
          setMigrating(false);
        }
      }
    },
    {
      id: 'step-security-code',
      step: 4,
      title: 'Sécuriser la Direction (ADMIN_ACCESS_CODE & ADMIN_SESSION_SECRET)',
      detail: !audit
        ? auditAuthBlocked
          ? 'Session Direction expirée : reconnectez-vous pour contrôler ADMIN_ACCESS_CODE, ADMIN_SESSION_SECRET et HMAC-SHA256.'
          : 'Vérification du code Direction et de la signature HMAC en attente...'
        : audit.security.customAdminCodeSet && audit.security.sessionSecretEnvSet
        ? 'Code Direction personnalisé et clé permanente ADMIN_SESSION_SECRET actifs (jetons HMAC-SHA256).'
        : audit.security.customAdminCodeSet
        ? 'ADMIN_ACCESS_CODE actif, mais ADMIN_SESSION_SECRET manque sur Render : la session Direction expirera après redémarrage.'
        : 'Actuellement en mode démo (DJIFFA-ADMIN). Définissez ADMIN_ACCESS_CODE et ADMIN_SESSION_SECRET sur Render avant ouverture publique.',
      status: securityStatus
    },
    {
      id: 'step-payment',
      step: 5,
      title: `Activer la passerelle de paiement (${activeProviderKey.toUpperCase()})`,
      detail: activePaymentProbe
        ? activePaymentProbe.message
        : !audit
        ? auditAuthBlocked
          ? 'Session Direction expirée : reconnectez-vous pour contrôler les clés FedaPay côté serveur.'
          : 'Vérification de la passerelle FedaPay en attente...'
        : audit.payments.activeConfigured
        ? `Clés ${activeProviderKey.toUpperCase()} détectées (${audit.payments.mode}). Lancez un test API pour confirmer.`
        : 'Clés FedaPay manquantes. L’application reste en mode démonstration sécurisé.',
      status: paymentStatus,
      actionLabel: auditAuthBlocked ? 'Se reconnecter' : `Tester ${activeProviderKey.toUpperCase()}`,
      onAction: auditAuthBlocked ? handleRenewAdminAuth : () => handleVerifyPayment(activeProviderKey)
    },
    {
      id: 'step-media-videos',
      step: 6,
      title: 'Lier vos vraies vidéos & PDF dans les leçons',
      detail: `${lessonsWithVideo}/${allLessons.length} leçon(s) ont une vidéo liée · ${lessonsWithPdf}/${allLessons.length} PDF · ${publishedCoursesCount} formation(s) publiée(s).`,
      status: videoStatus,
      actionLabel: 'Gérer les formations',
      onAction: () => onNavigateAdminTab('courses')
    },
    {
      id: 'step-brand-logo',
      step: 7,
      title: 'Importer le logo officiel DJIFFA DESIGN AGENCY',
      detail: siteSettings.agencyLogoDataUrl
        ? 'Logo officiel enregistré et visible dans la navigation et les certificats.'
        : 'Monogramme « D » or actif par défaut. Importez votre logo officiel depuis Logo, Paiements & Site.',
      status: siteSettings.agencyLogoDataUrl ? 'completed' : 'external_action',
      actionLabel: 'Configurer le logo',
      onAction: () => onNavigateAdminTab('settings')
    },
    {
      id: 'step-github-push',
      step: 8,
      title: 'Dépôt GitHub officiel (faiaboky21-ctrl/Djiffa-Academy-1)',
      detail: !audit
        ? auditAuthBlocked
          ? 'Audit Git en attente de reconnexion Direction (session expirée).'
          : 'Lecture de l’état GitHub et du déploiement en attente...'
        : audit.github.remoteOriginConfigured
        ? `Dépôt distant connecté (${audit.github.remoteOriginUrl || officialGithubUrl})${
            audit.github.branch ? ` · branche ${audit.github.branch}` : ''
          }${audit.github.headCommitShort ? ` · commit ${audit.github.headCommitShort}` : ''}.`
        : audit.github.source === 'render'
        ? `Déploiement Render actif${
            audit.github.branch ? ` (branche ${audit.github.branch}` : ''
          }${
            audit.github.headCommitShort
              ? `${audit.github.branch ? ' · ' : ' ('}commit ${audit.github.headCommitShort}`
              : ''
          }${audit.github.branch || audit.github.headCommitShort ? ')' : ''}. Dépôt de référence : ${officialGithubUrl}.`
        : audit.github.source === 'ai-studio'
        ? `Aperçu Google AI Studio (sans .git local). La synchronisation vers ${officialGithubUrl} est gérée depuis l’interface Google AI Studio.`
        : audit.github.gitInitialized
        ? `Dépôt Git local initialisé${
            audit.github.branch ? ` (${audit.github.branch}` : ''
          }${audit.github.headCommitShort ? ` · commit ${audit.github.headCommitShort}` : ''}${
            audit.github.branch ? ')' : ''
          }. Reste à lier le dépôt ${officialGithubUrl}.`
        : `Aucun dépôt Git local détecté. Dépôt de référence : ${officialGithubUrl}.`,
      status: githubStatus
    },
    {
      id: 'step-render-deploy',
      step: 9,
      title: 'Déployer en ligne sur Render & domaine personnalisé',
      detail: !audit
        ? auditAuthBlocked
          ? 'Audit Render en attente de reconnexion Direction (session expirée).'
          : 'Lecture de l’état Render (render.yaml, dist/, npm start) en attente...'
        : audit.render.isProductionMode && audit.render.appUrlConfigured
        ? 'Application active en mode production avec APP_URL configuré.'
        : 'render.yaml, npm run build (dist/) et npm start (Express + Vite) prêts pour le déploiement sur Render.',
      status: renderStatus
    }
  ];

  const completedSteps = launchChecklist.filter((s) => s.status === 'completed').length;
  const preparedSteps = launchChecklist.filter((s) => s.status === 'prepared').length;
  const missingSteps = launchChecklist.filter((s) => s.status === 'missing_connection').length;
  const externalSteps = launchChecklist.filter((s) => s.status === 'external_action').length;
  const errorSteps = launchChecklist.filter((s) => s.status === 'error').length;
  const progressPercent = Math.round((completedSteps / launchChecklist.length) * 100);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://votre-domaine-djiffa.onrender.com';
  const webhookUrl = `${originUrl}${audit?.payments.webhookPath || '/api/payments/webhook'}`;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="p-5 sm:p-8 rounded-2xl bg-zinc-950 border border-[#D4AF37]/40 space-y-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#F3E5AB] text-[11px] font-bold uppercase tracking-wider">
              <Rocket className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Direction · Faith Ariola</span>
            </div>
            <h2 className="font-brand text-xl sm:text-3xl font-bold text-slate-100 leading-tight">
              Centre de configuration et de lancement de DJIFFA ACADEMY
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl leading-relaxed">
              Pilotez la mise en ligne réelle depuis un seul écran compatible Android, tablette et ordinateur : vérifiez vos connexions serveur sans exposer aucune clé secrète, migrez vos données et suivez votre progression réelle.
            </p>
          </div>

          <button
            type="button"
            disabled={verifyingAll || auditLoading}
            onClick={handleVerifyAll}
            className="w-full lg:w-auto px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 shadow-lg"
          >
            <RefreshCw className={`w-4 h-4 ${verifyingAll || auditLoading ? 'animate-spin' : ''}`} />
            <span>{verifyingAll ? 'Vérification en cours...' : 'Tout vérifier maintenant'}</span>
          </button>
        </div>

        {auditAuthBlocked !== null && (
          <div className="p-4 sm:p-5 rounded-xl bg-amber-950/50 border border-[#D4AF37]/60 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <strong className="text-[#F3E5AB] block text-sm">
                  Session Direction à renouveler (HTTP {auditAuthBlocked})
                </strong>
                <p className="text-zinc-200 leading-relaxed">
                  Votre jeton d’autorisation Direction côté serveur a expiré ou n’est plus reconnu (par exemple après un redémarrage du serveur). Aucun des statuts ci-dessous ne signifie que vos fichiers ou variables sont absents tant que l’audit serveur n’a pas pu répondre.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 pl-8">
              <button
                type="button"
                onClick={handleRenewAdminAuth}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Se reconnecter à la Direction</span>
              </button>
              <button
                type="button"
                disabled={auditLoading}
                onClick={fetchAudit}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-100 font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? 'animate-spin' : ''}`} />
                <span>Réessayer l’audit</span>
              </button>
            </div>
          </div>
        )}

        {auditError && auditAuthBlocked === null && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{auditError}</span>
          </div>
        )}

        {/* Global Real Progress Bar */}
        <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold block">
                Progression réelle de mise en ligne
              </span>
              <strong className="text-base sm:text-lg text-slate-100">
                {audit
                  ? `${completedSteps} sur ${launchChecklist.length} étapes terminées (${progressPercent}%)`
                  : auditAuthBlocked !== null
                  ? 'Audit serveur en attente de reconnexion Direction'
                  : 'Chargement de l’audit serveur en cours...'}
              </strong>
            </div>
            {audit?.auditedAt ? (
              <span className="text-[11px] text-zinc-500">
                Dernier audit serveur : {new Date(audit.auditedAt).toLocaleTimeString('fr-FR')}
              </span>
            ) : (
              <span className="text-[11px] text-[#F3E5AB]">
                {auditAuthBlocked !== null ? 'Session Direction requise pour l’audit' : 'Connexion serveur...'}
              </span>
            )}
          </div>

          <div className="w-full h-3 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#D4AF37] to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-emerald-950/35 border border-emerald-800/50 text-emerald-300 flex items-center justify-between">
              <span>Terminé</span>
              <strong className="text-sm">{completedSteps}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-sky-950/35 border border-sky-800/50 text-sky-300 flex items-center justify-between">
              <span>Préparé</span>
              <strong className="text-sm">{preparedSteps}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-950/35 border border-amber-800/50 text-amber-300 flex items-center justify-between">
              <span>Connexion manquante</span>
              <strong className="text-sm">{missingSteps}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#F3E5AB] flex items-center justify-between">
              <span>Action externe</span>
              <strong className="text-sm">{externalSteps}</strong>
            </div>
            <div className="p-2.5 rounded-lg bg-red-950/35 border border-red-800/50 text-red-300 flex items-center justify-between col-span-2 sm:col-span-1">
              <span>Erreurs</span>
              <strong className="text-sm">{errorSteps}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Pillar Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. SUPABASE */}
        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    1. Supabase (Base PostgreSQL, Auth & Storage)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Schéma 11 tables + RLS dans <code className="text-zinc-200">supabase/schema.sql</code>
                  </p>
                </div>
              </div>
              <StatusBadge status={supabaseStatus} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Client Navigateur (Vite)</span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.supabase.browserReady
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Vérification...'
                    : audit.supabase.browserReady
                    ? '✓ URL + Anon Key'
                    : 'Clés absentes'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Serveur Express (Admin)</span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.supabase.serverReady
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Vérification...'
                    : audit.supabase.serverReady
                    ? '✓ Service Role actif'
                    : 'Clé serveur absente'}
                </strong>
              </div>
            </div>

            {/* Variables d'environnement requises */}
            <div className="p-3 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-2 text-[11px]">
              <strong className="text-[#F3E5AB] block">Variables d’environnement Supabase requises :</strong>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  { name: 'VITE_SUPABASE_URL', ok: audit?.supabase.viteUrlSet, scope: 'Public (Navigateur)' },
                  { name: 'VITE_SUPABASE_ANON_KEY', ok: audit?.supabase.viteAnonKeySet, scope: 'Public (Navigateur)' },
                  { name: 'SUPABASE_URL', ok: audit?.supabase.serverUrlSet, scope: 'Serveur' },
                  { name: 'SUPABASE_SERVICE_ROLE_KEY', ok: audit?.supabase.serviceRoleKeySet, scope: 'Secret Serveur' }
                ].map((v) => (
                  <div
                    key={v.name}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <code className="text-zinc-200 block truncate">{v.name}</code>
                      <span className="text-[10px] text-zinc-500">{v.scope}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        !audit
                          ? 'bg-zinc-900 text-zinc-300 border border-zinc-700'
                          : v.ok
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {!audit ? (auditAuthBlocked !== null ? 'AUTH REQUISE' : 'EN ATTENTE') : v.ok ? 'OK' : 'MANQUANTE'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {supaCheck && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                  supaCheck.status === 'completed'
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                    : supaCheck.status === 'error'
                    ? 'bg-red-950/40 border-red-800 text-red-200'
                    : 'bg-amber-950/40 border-amber-800 text-[#F3E5AB]'
                }`}
              >
                <p className="font-semibold">
                  {supaCheck.message?.trim() || 'Erreur Supabase inconnue (aucun détail renvoyé par le serveur).'}
                </p>
                {!supaCheck.ok && (supaCheck.httpStatus || supaCheck.errorCode) && (
                  <p className="text-[11px] opacity-85 font-mono">
                    {[
                      supaCheck.httpStatus ? `Statut HTTP : ${supaCheck.httpStatus}` : '',
                      supaCheck.httpStatusText || '',
                      supaCheck.errorCode ? `Code : ${supaCheck.errorCode}` : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {supaCheck.tables && supaCheck.tables.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                    {supaCheck.tables.map((t) => (
                      <div key={t.name} className="px-2 py-1 rounded bg-zinc-950/80 border border-zinc-800 text-zinc-200">
                        <span className="text-zinc-400">{t.name}</span>:{' '}
                        <strong className={t.ok ? 'text-emerald-300' : 'text-red-300'}>{t.count}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {supaCheck.buckets && supaCheck.buckets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {supaCheck.buckets.map((b) => (
                      <span
                        key={b.name}
                        className={`px-2 py-0.5 rounded border ${
                          b.ok
                            ? 'bg-emerald-950/70 border-emerald-700 text-emerald-200'
                            : 'bg-amber-950/70 border-amber-700 text-amber-200'
                        }`}
                      >
                        {b.ok ? '✓' : '✗'} {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Préparation sauvegarde obligatoire avant migration */}
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-[11px] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-slate-200 font-semibold block">
                  Sauvegarde préalable de sécurité {backupMeta ? '✓ Prête' : '(requise avant migration)'}
                </span>
                <span className="text-zinc-400">
                  {backupMeta
                    ? `${backupMeta.fileName} (${backupMeta.counts.courses} formations, ${backupMeta.counts.students} apprenants)`
                    : 'Télécharge une copie complète JSON de toutes vos données locales sans rien écraser.'}
                </span>
              </div>
              <button
                type="button"
                onClick={handlePrepareBackup}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-slate-100 font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{backupMeta ? 'Actualiser la sauvegarde' : 'Télécharger sauvegarde (.json)'}</span>
              </button>
            </div>

            {migrateMsg && (
              <div
                className={`p-3 rounded-xl border text-xs ${
                  migrateMsg.ok
                    ? 'bg-emerald-950/40 border-emerald-700 text-emerald-200'
                    : 'bg-red-950/40 border-red-800 text-red-200'
                }`}
              >
                {migrateMsg.message}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-2 border-t border-zinc-900">
            <button
              type="button"
              disabled={supaTesting}
              onClick={handleVerifySupabase}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${supaTesting ? 'animate-spin' : ''}`} />
              <span>{supaTesting ? 'Test en cours...' : 'Vérifier la connexion Supabase'}</span>
            </button>

            <button
              type="button"
              disabled={migrating || !supaCheck?.ok || !backupMeta}
              title={
                !supaCheck?.ok
                  ? 'Vérifiez d’abord la connexion Supabase'
                  : !backupMeta
                  ? 'Téléchargez d’abord la sauvegarde JSON de sécurité'
                  : 'Migrer sans écrasement vers Supabase'
              }
              onClick={async () => {
                setMigrating(true);
                setMigrateMsg(null);
                try {
                  const res = await migrateLocalCatalogToCloud();
                  setMigrateMsg(res);
                  await handleVerifySupabase();
                } finally {
                  setMigrating(false);
                }
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{migrating ? 'Migration...' : 'Migrer les données vers Supabase'}</span>
            </button>

            {audit?.supabase.serverReady && (
              <button
                type="button"
                onClick={refreshSupabaseAdminData}
                className="w-full sm:w-auto px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Synchroniser</span>
              </button>
            )}
          </div>
        </section>

        {/* 2. GITHUB */}
        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center text-slate-200 shrink-0">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    2. GitHub (Sauvegarde & Code source)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Dépôt propre sans fichiers secrets (<code className="text-zinc-200">.gitignore</code> actif)
                  </p>
                </div>
              </div>
              <StatusBadge status={githubStatus} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">
                  {audit?.github.source === 'render'
                    ? 'Build / Déploiement'
                    : audit?.github.source === 'ai-studio'
                    ? 'Environnement actif'
                    : 'Dépôt Git local'}
                </span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.github.gitInitialized
                      ? 'text-emerald-400'
                      : audit.github.source === 'ai-studio'
                      ? 'text-sky-300'
                      : 'text-red-400'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Audit en cours...'
                    : audit.github.gitInitialized
                    ? [
                        '✓',
                        audit.github.branch ? `Branche ${audit.github.branch}` : 'Dépôt détecté',
                        audit.github.headCommitShort ? `(${audit.github.headCommitShort})` : ''
                      ]
                        .filter(Boolean)
                        .join(' ')
                    : audit.github.source === 'ai-studio'
                    ? 'Aperçu Google AI Studio'
                    : 'Non initialisé'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Dépôt GitHub (référence)</span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.github.remoteOriginConfigured
                      ? 'text-emerald-400'
                      : audit.github.source === 'ai-studio' || audit.github.source === 'render'
                      ? 'text-sky-300'
                      : 'text-[#F3E5AB]'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Audit en cours...'
                    : audit.github.remoteOriginConfigured
                    ? '✓ Connecté'
                    : audit.github.source === 'render'
                    ? 'Source Render active'
                    : audit.github.source === 'ai-studio'
                    ? 'Sync via AI Studio UI'
                    : 'À lier manuellement'}
                </strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-[#F3E5AB]">Dépôt GitHub officiel conservé :</strong>
                <button
                  type="button"
                  onClick={() => copyText('git-cmd', audit?.github.remoteOriginUrl || officialGithubUrl)}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedId === 'git-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === 'git-cmd' ? 'Copié' : 'Copier URL'}</span>
                </button>
              </div>
              <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 font-mono break-all">
                {audit?.github.remoteOriginUrl || officialGithubUrl}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {audit?.github.source === 'ai-studio'
                  ? 'Dans l’aperçu Google AI Studio, aucun dossier .git local n’est monté ; la sauvegarde s’effectue via l’icône GitHub de Google AI Studio vers ce dépôt existant.'
                  : audit?.github.source === 'render'
                  ? audit.github.remoteOriginConfigured
                    ? 'Dépôt détecté automatiquement depuis les métadonnées Render.'
                    : 'Instance Render active. Si les métadonnées Git Render ne sont pas exposées dans le conteneur, vérifiez la liaison dans le tableau de bord Render.'
                  : 'Documentation complète dans README.md et DEPLOYMENT.md.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-900 text-[11px] text-zinc-400">
            <span>
              Protection .env :{' '}
              {!audit
                ? auditAuthBlocked !== null
                  ? 'Session Direction requise'
                  : 'Vérification...'
                : audit.github.gitignoreProtectsEnv
                ? '✓ Ignoré par Git'
                : '⚠ À vérifier'}
            </span>
            <a
              href={audit?.github.remoteOriginUrl || officialGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline font-semibold"
            >
              <span>Ouvrir le dépôt GitHub officiel</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* 3. RENDER */}
        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-950/60 border border-sky-700/50 flex items-center justify-center text-sky-400 shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    3. Render (Hébergement Web & Déploiement)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Blueprint automatisé <code className="text-zinc-200">render.yaml</code> · Node Express + React
                  </p>
                </div>
              </div>
              <StatusBadge status={renderStatus} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Blueprint render.yaml</span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.render.renderYamlReady
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Audit en cours...'
                    : audit.render.renderYamlReady
                    ? '✓ Prêt'
                    : 'Absent'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Build de production (dist/)</span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.render.distBuilt
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Audit en cours...'
                    : audit.render.distBuilt
                    ? '✓ Compilé'
                    : 'À générer'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 col-span-2 sm:col-span-1">
                <span className="text-zinc-400 block text-[11px]">Commande Start</span>
                <strong
                  className={
                    !audit
                      ? 'text-zinc-300'
                      : audit.render.startScriptReady
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }
                >
                  {!audit
                    ? auditAuthBlocked !== null
                      ? 'Session Direction requise'
                      : 'Audit en cours...'
                    : audit.render.startScriptReady
                    ? '✓ npm start'
                    : 'Incomplète'}
                </strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs space-y-2 text-zinc-300">
              <strong className="text-[#F3E5AB] block">Étapes de mise en ligne sur Render.com :</strong>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-zinc-400">
                <li>Dans Render, choisissez <strong>New + → Blueprint</strong> et connectez votre dépôt GitHub.</li>
                <li>Render détectera automatiquement <code className="text-zinc-200">render.yaml</code> (<code className="text-zinc-200">npm run build</code> puis <code className="text-zinc-200">npm start</code>).</li>
                <li>Renseignez vos variables secrètes dans <strong>Environment</strong> (<code className="text-zinc-200">APP_URL</code>, <code className="text-zinc-200">ADMIN_ACCESS_CODE</code>, clés Supabase & FedaPay).</li>
                <li>Dans <strong>Settings → Custom Domains</strong>, ajoutez votre nom de domaine (ex: <code className="text-zinc-200">academy.djiffadesign.com</code>).</li>
              </ol>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-900 text-[11px]">
            <span className="text-zinc-400">
              APP_URL :{' '}
              {!audit
                ? auditAuthBlocked !== null
                  ? 'Session Direction requise'
                  : 'Vérification...'
                : audit.render.appUrlConfigured
                ? '✓ Configurée'
                : '⚠ À définir en production'}
            </span>
            <a
              href="https://dashboard.render.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#D4AF37] hover:underline font-semibold"
            >
              <span>Ouvrir Render Dashboard</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>

        {/* 4. PAIEMENTS */}
        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    4. Paiements (FedaPay)
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Passerelle active : <strong className="text-white uppercase">{activeProviderKey}</strong> · Mode{' '}
                    <strong className="text-[#F3E5AB] uppercase">{audit?.payments.mode || 'sandbox'}</strong>
                  </p>
                </div>
              </div>
              <StatusBadge status={paymentStatus} />
            </div>

            {/* FedaPay provider status & probe */}
            <div className="space-y-2.5">
              {(
                [
                  {
                    id: 'fedapay' as const,
                    label: 'FedaPay (Passerelle officielle Bénin & UEMOA)',
                    desc: 'Mobile Money & Visa/Mastercard selon les moyens activés · sans abonnement mensuel',
                    configured: audit?.payments.providers.fedapay.configured
                  }
                ] as const
              ).map((prov) => {
                const probe = paymentChecks[prov.id];
                const isActive = activeProviderKey === prov.id;
                const provStatus: LaunchStepStatus = probe
                  ? probe.status
                  : !audit
                  ? auditAuthBlocked !== null
                    ? 'external_action'
                    : 'prepared'
                  : prov.configured
                  ? 'prepared'
                  : 'missing_connection';

                return (
                  <div
                    key={prov.id}
                    className={`p-3 rounded-xl border text-xs space-y-2 ${
                      isActive ? 'bg-zinc-900 border-[#D4AF37]/50' : 'bg-zinc-900/50 border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-slate-100">{prov.label}</strong>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#F3E5AB] text-[10px] font-bold">
                              ACTIF
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400">{prov.desc}</p>
                        {prov.id === 'fedapay' && audit?.payments.providers.fedapay.configured && (
                          <p
                            className={`text-[10px] mt-1 font-medium ${
                              audit.payments.providers.fedapay.keyModeAligned === false
                                ? 'text-red-300'
                                : 'text-zinc-300'
                            }`}
                          >
                            {audit.payments.providers.fedapay.keyModeAligned === false
                              ? `Alerte : clés détectées (${audit.payments.providers.fedapay.keyEnvironment?.toUpperCase()}) incompatibles avec PAYMENT_MODE=${audit.payments.mode}.`
                              : `Type de clés détecté : ${
                                  audit.payments.providers.fedapay.keyEnvironment === 'sandbox'
                                    ? 'Sandbox (Test)'
                                    : audit.payments.providers.fedapay.keyEnvironment === 'live'
                                    ? 'Live (Production)'
                                    : 'Personnalisé'
                                }.`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={provStatus} />
                        <button
                          type="button"
                          disabled={testingProvider === prov.id}
                          onClick={() => handleVerifyPayment(prov.id)}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-[#D4AF37] hover:text-zinc-950 text-slate-200 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {testingProvider === prov.id ? 'Test...' : 'Tester'}
                        </button>
                      </div>
                    </div>
                    {probe && (
                      <p
                        className={`text-[11px] ${
                          probe.status === 'completed'
                            ? 'text-emerald-300'
                            : probe.status === 'error'
                            ? 'text-red-300'
                            : 'text-amber-300'
                        }`}
                      >
                        {probe.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Webhook copy box */}
            <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <div className="min-w-0">
                <span className="text-zinc-400 block">URL Webhook sécurisée à configurer chez le prestataire :</span>
                <code className="text-[#F3E5AB] break-all">{webhookUrl}</code>
              </div>
              <button
                type="button"
                onClick={() => copyText('webhook-url', webhookUrl)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {copiedId === 'webhook-url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'webhook-url' ? 'Copié' : 'Copier l’URL'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* 5. VIDÉOS & RESSOURCES */}
        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-700/50 flex items-center justify-center text-purple-300 shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    5. Vidéos & Ressources pédagogiques
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Buckets privés <code className="text-zinc-200">course-videos</code>, <code className="text-zinc-200">course-pdfs</code> & lecteurs externes
                  </p>
                </div>
              </div>
              <StatusBadge status={videoStatus} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Vidéos liées</span>
                <strong className="text-lg text-[#F3E5AB]">
                  {lessonsWithVideo}/{allLessons.length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">PDF liés</span>
                <strong className="text-lg text-slate-100">
                  {lessonsWithPdf}/{allLessons.length}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span className="text-zinc-400 block text-[11px]">Exercices / Quiz</span>
                <strong className="text-lg text-emerald-400">
                  {lessonsWithExerciseOrQuiz}/{allLessons.length}
                </strong>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs space-y-1.5 text-zinc-300">
              <strong className="text-slate-100 block">Architecture média hybride prête :</strong>
              <ul className="list-disc pl-4 space-y-1 text-[11px] text-zinc-400">
                <li>
                  <strong>Téléversement privé Supabase Storage :</strong> URL signées temporaires via <code className="text-zinc-200">/api/media/signed-url</code> uniquement pour les apprenants inscrits.
                </li>
                <li>
                  <strong>Hébergement vidéo haute performance :</strong> support natif de Bunny Stream, Cloudflare Stream, Vimeo privé ou MP4 direct dans l’éditeur de leçon.
                </li>
                <li>
                  <strong>Buckets Storage détectés :</strong>{' '}
                  {supaCheck
                    ? supaCheck.bucketsFound.length > 0
                      ? supaCheck.bucketsFound.join(', ')
                      : 'Aucun vérifié / manquant'
                    : 'Cliquez sur « Vérifier la connexion Supabase » pour contrôler les buckets.'}
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-900">
            <button
              type="button"
              onClick={() => onNavigateAdminTab('courses')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-slate-100 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Ajouter / Téléverser mes vidéos et PDF dans Formations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* 6. SÉCURITÉ */}
        <section className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-[#D4AF37] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    6. Sécurité & Protection des accès
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Email Direction autorisé : <code className="text-zinc-200">{audit?.security.adminEmail || 'faith.ariola@djiffa-agency.com'}</code>
                  </p>
                </div>
              </div>
              <StatusBadge status={securityStatus} />
            </div>

            <div className="space-y-2 text-xs">
              {[
                {
                  label: 'Clé SUPABASE_SERVICE_ROLE_KEY strictement isolée côté serveur',
                  ok: audit ? audit.security.serviceRoleServerOnly : null
                },
                {
                  label: 'Clés secrètes paiements absentes du bundle navigateur (VITE_*)',
                  ok: audit ? audit.security.paymentSecretsServerOnly : null
                },
                {
                  label: 'Jetons de session Direction signés par HMAC-SHA256',
                  ok: Boolean(adminToken) && auditAuthBlocked === null
                },
                {
                  label: 'Code d’accès Direction personnalisé (ADMIN_ACCESS_CODE)',
                  ok: audit ? audit.security.customAdminCodeSet : null,
                  warnText: 'Mode démo actif — définissez ADMIN_ACCESS_CODE avant ouverture publique'
                },
                {
                  label: 'Secret permanent de session Direction (ADMIN_SESSION_SECRET)',
                  ok: audit ? audit.security.sessionSecretEnvSet : null,
                  warnText: 'Clé temporaire en mémoire — définissez ADMIN_SESSION_SECRET sur Render pour conserver la session entre redémarrages'
                },
                {
                  label: 'Fichier .gitignore bloque l’envoi de .env sur GitHub',
                  ok: audit ? audit.security.gitignoreProtectsEnv : null
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-slate-200 block">{item.label}</span>
                    {item.ok === false && item.warnText && (
                      <span className="text-[11px] text-[#F3E5AB]">{item.warnText}</span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      item.ok === null
                        ? 'bg-zinc-900 text-zinc-300 border border-zinc-700'
                        : item.ok
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {item.ok === null
                      ? auditAuthBlocked !== null
                        ? 'AUTH REQUISE'
                        : 'EN ATTENTE'
                      : item.ok
                      ? 'OK'
                      : 'À DÉFINIR'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
            <span>
              Aucune valeur secrète n’est jamais affichée ni transmise au navigateur : cet écran interroge uniquement l’état de présence et de validité côté serveur.
            </span>
          </div>
        </section>
      </div>

      {/* 7. MISE EN LIGNE (Full Step-by-Step Checklist) */}
      <section className="p-5 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="font-brand text-xl font-bold text-slate-100">
              7. Plan de Mise en ligne étape par étape ({progressPercent}%)
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Suivez l’ordre ci-dessous pour passer de la configuration préparée à l’ouverture officielle aux apprenants.
            </p>
          </div>
          <span className="text-xs font-bold text-[#F3E5AB]">
            {completedSteps}/{launchChecklist.length} validées
          </span>
        </div>

        <div className="space-y-3">
          {launchChecklist.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    item.status === 'completed'
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-800 text-[#F3E5AB] border border-zinc-700'
                  }`}
                >
                  {item.status === 'completed' ? '✓' : item.step}
                </div>
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">{item.detail}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0 md:justify-end">
                <StatusBadge status={item.status} />
                {item.actionLabel && item.onAction && (
                  <button
                    type="button"
                    onClick={item.onAction}
                    className="px-3.5 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 text-xs font-bold cursor-pointer"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
