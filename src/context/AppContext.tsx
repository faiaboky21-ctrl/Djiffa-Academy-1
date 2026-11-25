/**
 * DJIFFA ACADEMY - Global Application Context & State Management
 * Hybrid Architecture:
 *  - Works out-of-the-box via localStorage when cloud credentials are absent
 *  - Seamlessly upgrades to Supabase Auth + PostgreSQL + Storage + FedaPay/KKiaPay/CinetPay when configured
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Course,
  User,
  Order,
  CoachingRequest,
  Currency,
  Language,
  PaymentGatewayConfig,
  UserCertificate,
  PaymentMethod,
  DomainCategory,
  PromoCode,
  SiteSettings,
  CoachingProgramConfig,
  Testimonial,
  NotificationItem,
  ContactMessage,
  PaymentEventLog
} from '../types';
import {
  INITIAL_COURSES,
  INITIAL_DOMAINS,
  INITIAL_PROMO_CODES,
  INITIAL_SITE_SETTINGS,
  COACHING_PROGRAMS
} from '../data/coursesData';
import { supabase, isSupabaseConfigured, getSupabaseAccessToken } from '../lib/supabase';
import { migrateCatalogToSupabaseServer, migrateStudentProgressToSupabase } from '../lib/migration';
import { getCoursePricing } from '../lib/pricing';

export type AppView =
  | 'home'
  | 'catalog'
  | 'course-detail'
  | 'player'
  | 'student-space'
  | 'admin-space'
  | 'coaching'
  | 'about'
  | 'contact'
  | 'legal-cgv'
  | 'legal-mentions';

export interface InfrastructureStatus {
  supabase: {
    configured: boolean;
    serverConnected: boolean;
    browserConfigured: boolean;
    storageBuckets: string[];
  };
  payment: PaymentGatewayConfig & {
    provider: 'fedapay' | 'kkiapay' | 'cinetpay';
    mode: 'sandbox' | 'live';
    configured: boolean;
    message: string;
    webhookPath: string;
  };
  adminSecurity: {
    email: string;
    customCodeConfigured: boolean;
    isProductionMode?: boolean;
  };
  environment: string;
}

const ADMIN_SESSION_TOKEN_KEY = 'djiffa_admin_session_token';
const ADMIN_PROFILE_SESSION_KEY = 'djiffa_admin_profile';

interface AppContextType {
  courses: Course[];
  domains: DomainCategory[];
  promoCodes: PromoCode[];
  siteSettings: SiteSettings;
  coachingPrograms: CoachingProgramConfig[];
  testimonials: Testimonial[];
  students: User[];
  notifications: NotificationItem[];
  currentUser: User | null;
  currency: Currency;
  language: Language;
  orders: Order[];
  coachingRequests: CoachingRequest[];
  contactMessages: ContactMessage[];
  paymentEvents: PaymentEventLog[];
  paymentConfig: PaymentGatewayConfig;
  infraStatus: InfrastructureStatus | null;
  adminToken: string | null;
  adminSessionExpiredNotice: string | null;
  supabaseReady: boolean;
  paymentReturnNotice: { type: 'success' | 'pending' | 'error'; message: string } | null;
  activeView: AppView;
  selectedCourseId: string | null;
  activeLessonId: string | null;
  authModalOpen: boolean;
  authModalMode: 'student' | 'admin';

  // Navigation & UI
  navigateTo: (view: AppView, courseId?: string, lessonId?: string) => void;
  setCurrency: (currency: Currency) => void;
  setLanguage: (lang: Language) => void;
  formatPrice: (amountXOF: number, forcedCurrency?: Currency) => string;
  openAuthModal: (mode?: 'student' | 'admin') => void;
  closeAuthModal: () => void;
  dismissPaymentReturnNotice: () => void;
  dismissAdminSessionExpiredNotice: () => void;
  invalidateExpiredAdminSession: (reason?: string) => void;

  // Auth & Profile
  loginAsDemoStudent: () => void;
  loginStudent: (email: string) => { ok: boolean; message?: string };
  registerUser: (name: string, email: string, phone?: string, country?: string) => User;
  signInWithEmailPassword: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signUpWithEmailPassword: (
    name: string,
    email: string,
    password: string,
    phone?: string,
    country?: string
  ) => Promise<{ ok: boolean; needsConfirmation?: boolean; user?: User; message?: string }>;
  loginAdminServer: (email: string, accessCode: string) => Promise<{ ok: boolean; message?: string }>;
  updateUserProfile: (updates: Partial<Pick<User, 'name' | 'phone' | 'country'>>) => void;
  logout: () => void;

  // Course actions
  isEnrolled: (courseId: string) => boolean;
  getCourseProgress: (courseId: string) => { completedCount: number; totalCount: number; percentage: number };
  setLastAccessedLesson: (courseId: string, lessonId: string) => void;
  toggleLessonComplete: (courseId: string, lessonId: string) => void;
  submitExercise: (lessonId: string, submissionText: string, link?: string) => void;
  submitQuizResult: (quizId: string, score: number, total: number) => void;
  claimCertificate: (courseId: string) => UserCertificate | null;

  // Orders & Checkout
  validatePromoCode: (code: string) => PromoCode | null;
  processPurchase: (
    courseId: string,
    paymentMethod: PaymentMethod,
    phoneOrCard: string,
    options?: { promoCode?: string; discountPercent?: number; isDemoMode?: boolean; transactionId?: string; reference?: string }
  ) => Promise<{ success: boolean; isDemoRecorded?: boolean; order: Order; message?: string }>;
  verifyExistingPayment: (
    reference: string,
    transactionId?: string,
    courseId?: string
  ) => Promise<{
    ok: boolean;
    verified: boolean;
    finalFailure?: boolean;
    temporaryError?: boolean;
    status?: Order['status'];
    providerStatus?: string;
    courseId?: string;
    message?: string;
  }>;
  refreshServerPaymentStatus: () => Promise<void>;

  // Coaching & Contact
  submitCoachingRequest: (
    data: Omit<CoachingRequest, 'id' | 'createdAt' | 'status' | 'userId' | 'userName' | 'userEmail'> & {
      userName?: string;
      userEmail?: string;
    }
  ) => CoachingRequest;
  submitContactMessage: (data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) => Promise<ContactMessage>;
  updateContactMessageStatus: (id: string, status: ContactMessage['status'], adminNotes?: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;

  // Cloud Sync & Migration
  syncCurrentStudentToCloud: () => Promise<{ ok: boolean; message: string }>;
  migrateLocalCatalogToCloud: () => Promise<{ ok: boolean; message: string; counts?: Record<string, number> }>;
  refreshSupabaseAdminData: () => Promise<void>;
  refreshAdminTelemetry: () => Promise<void>;

  // Admin Operations
  saveCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;
  saveDomain: (domain: DomainCategory) => void;
  deleteDomain: (domainId: string) => void;
  savePromoCode: (promo: PromoCode) => void;
  deletePromoCode: (promoId: string) => void;
  saveCoachingProgram: (program: CoachingProgramConfig) => void;
  addTestimonial: (testimonial: Omit<Testimonial, 'id'>) => void;
  deleteTestimonial: (id: string) => void;
  updateSiteSettings: (settings: SiteSettings) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  refundOrderServer: (orderId: string) => Promise<{ ok: boolean; message?: string }>;
  updateCoachingStatus: (id: string, status: CoachingRequest['status'], meetingLink?: string, adminNotes?: string) => void;
  updatePaymentConfig: (config: PaymentGatewayConfig) => void;
  grantManualCourseAccess: (userId: string, courseId: string) => void;
  revokeCourseAccess: (userId: string, courseId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_ADMIN: User = {
  id: 'usr-admin-faith',
  name: 'Faith Ariola',
  email: 'faith.ariola@djiffa-agency.com',
  role: 'admin',
  phone: '+229 97 00 00 00',
  country: 'Bénin',
  enrolledCourseIds: [
    'course-faith-ariola-methode',
    'course-mode-virtuelle-ia',
    'course-cinema-storytelling-ia',
    'course-entrepreneuriat-digital-ia'
  ],
  completedLessonIds: ['les-1-1', 'les-1-2', 'les-2-1', 'les-2-2', 'les-3-1', 'les-3-2', 'les-4-1', 'les-4-2', 'les-5-1', 'les-5-2'],
  lastAccessedLessonByCourse: {},
  submittedExercises: {},
  quizScores: {},
  certificates: [
    {
      id: 'cert-faith-master',
      courseId: 'course-faith-ariola-methode',
      courseTitle: 'La Méthode Faith Ariola : De l’idée à la création d’une vidéo publicitaire avec l’IA',
      issuedDate: '2026-03-01',
      studentName: 'Faith Ariola',
      verificationCode: 'DJIFFA-VERIF-2026-MASTER-001',
      directorName: 'Faith Ariola'
    }
  ]
};

const INITIAL_DEMO_STUDENTS: User[] = [
  {
    id: 'usr-student-amara',
    name: 'Amara Diallo (Compte Démo)',
    email: 'amara.diallo@exemple.com',
    role: 'student',
    phone: '+229 95 12 34 56',
    country: 'Bénin',
    enrolledCourseIds: ['course-faith-ariola-methode'],
    completedLessonIds: ['les-1-1', 'les-1-2'],
    lastAccessedLessonByCourse: { 'course-faith-ariola-methode': 'les-2-1' },
    submittedExercises: {
      'les-1-1': {
        submissionText:
          'Concept Démo : "L’Éclat de Dahomey" pour une gamme de joaillerie contemporaine béninoise. Hook : Gros plan sur de la poussière d’or qui s’élève en apesanteur.',
        submittedAt: '2026-11-08T14:30:00Z',
        status: 'submitted'
      }
    },
    quizScores: {
      'les-2-1': { score: 1, total: 1, passed: true, completedAt: '2026-11-09T10:15:00Z' }
    },
    certificates: [],
    createdAt: '2026-11-05T09:00:00Z'
  }
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-demo-1001',
    reference: 'DEMO-2026-98421',
    userId: 'usr-student-amara',
    userName: 'Amara Diallo (Compte Démo)',
    userEmail: 'amara.diallo@exemple.com',
    courseId: 'course-faith-ariola-methode',
    courseTitle: 'La Méthode Faith Ariola : De l’idée à la création d’une vidéo publicitaire avec l’IA',
    amount: 125000,
    currency: 'XOF',
    paymentMethod: 'mtn_momo',
    paymentProvider: 'FedaPay',
    status: 'confirmed',
    isDemoTransaction: true,
    customerPhone: '+229 95 12 34 56',
    createdAt: '2026-11-05T09:12:00Z',
    confirmedAt: '2026-11-05T09:13:30Z'
  }
];

const INITIAL_COACHING: CoachingRequest[] = [
  {
    id: 'coaching-demo-1',
    userId: 'usr-student-amara',
    userName: 'Amara Diallo (Compte Démo)',
    userEmail: 'amara.diallo@exemple.com',
    userPhone: '+229 95 12 34 56',
    type: 'individual',
    programTitle: 'Accompagnement Individuel VIP avec Faith Ariola',
    needDescription:
      'Exemple de demande : Lancement d’une campagne publicitaire pour une marque locale à Cotonou. Besoin de revue sur le découpage et la cohérence des scènes.',
    preferredDate: '2026-11-18',
    status: 'validated',
    meetingLink: 'https://meet.google.com/djiffa-vip-demo',
    createdAt: '2026-11-06T11:20:00Z'
  }
];

const DEFAULT_PAYMENT_CONFIG: PaymentGatewayConfig = {
  activeProvider: 'fedapay',
  isTestMode: true,
  serverConfigured: false,
  serverMessage: 'Vérification du serveur en cours...',
  momoBeninActive: true,
  cardsActive: true
};

const isUuid = (val?: string | null): boolean => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'student' | 'admin'>('student');

  // Admin HMAC token held exclusively in sessionStorage (never written to localStorage)
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [adminSessionExpiredNotice, setAdminSessionExpiredNotice] = useState<string | null>(null);
  const [infraStatus, setInfraStatus] = useState<InfrastructureStatus | null>(null);
  const [paymentReturnNotice, setPaymentReturnNotice] = useState<{
    type: 'success' | 'pending' | 'error';
    message: string;
  } | null>(null);

  const [currency, setCurrencyState] = useState<Currency>(() => {
    return (localStorage.getItem('djiffa_currency') as Currency) || 'XOF';
  });

  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('djiffa_language') as Language) || 'fr';
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem('djiffa_courses');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_COURSES;
  });

  const [domains, setDomains] = useState<DomainCategory[]>(() => {
    const saved = localStorage.getItem('djiffa_domains');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_DOMAINS;
  });

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => {
    const saved = localStorage.getItem('djiffa_promos');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_PROMO_CODES;
  });

  const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
    const saved = localStorage.getItem('djiffa_site_settings');
    if (saved) {
      try {
        return { ...INITIAL_SITE_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SITE_SETTINGS;
  });

  const [coachingPrograms, setCoachingPrograms] = useState<CoachingProgramConfig[]>(() => {
    const saved = localStorage.getItem('djiffa_coaching_programs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return COACHING_PROGRAMS;
  });

  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => {
    const saved = localStorage.getItem('djiffa_testimonials');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [students, setStudents] = useState<User[]>(() => {
    const saved = localStorage.getItem('djiffa_students');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User[];
        return isSupabaseConfigured ? parsed.filter((s) => s.id !== 'usr-student-amara') : parsed;
      } catch (e) { console.error(e); }
    }
    return isSupabaseConfigured ? [] : INITIAL_DEMO_STUDENTS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Purge any legacy admin profile stored in localStorage without a valid sessionStorage token
    const savedLocal = localStorage.getItem('djiffa_user');
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal) as User;
        if (parsed.role === 'admin' || (isSupabaseConfigured && parsed.id === 'usr-student-amara')) {
          localStorage.removeItem('djiffa_user');
        } else {
          return parsed;
        }
      } catch (e) {
        console.error(e);
      }
    }

    try {
      const hasAdminToken = Boolean(sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY));
      const savedAdminProfile = sessionStorage.getItem(ADMIN_PROFILE_SESSION_KEY);
      if (hasAdminToken && savedAdminProfile) {
        const parsedAdmin = JSON.parse(savedAdminProfile) as User;
        if (parsedAdmin.role === 'admin') return parsedAdmin;
      }
      sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_PROFILE_SESSION_KEY);
    } catch {
      // ignore sessionStorage access issues
    }
    return null;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('djiffa_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Order[];
        return isSupabaseConfigured
          ? parsed.filter((o) => o.id !== 'ord-demo-1001' && o.reference !== 'DEMO-2026-98421')
          : parsed;
      } catch (e) { console.error(e); }
    }
    return isSupabaseConfigured ? [] : INITIAL_ORDERS;
  });

  const [coachingRequests, setCoachingRequests] = useState<CoachingRequest[]>(() => {
    const saved = localStorage.getItem('djiffa_coaching');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CoachingRequest[];
        return isSupabaseConfigured ? parsed.filter((r) => r.id !== 'coaching-demo-1') : parsed;
      } catch (e) { console.error(e); }
    }
    return isSupabaseConfigured ? [] : INITIAL_COACHING;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('djiffa_notifications');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [
      {
        id: 'notif-welcome',
        userId: 'all',
        title: 'Bienvenue sur DJIFFA ACADEMY',
        message: 'Découvrez La Méthode Faith Ariola : De l’idée à la création d’une vidéo publicitaire avec l’IA.',
        category: 'course',
        read: false,
        createdAt: new Date().toISOString()
      }
    ];
  });

  const [contactMessages, setContactMessages] = useState<ContactMessage[]>(() => {
    const saved = localStorage.getItem('djiffa_contact_messages');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  });

  const [paymentEvents, setPaymentEvents] = useState<PaymentEventLog[]>([]);

  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewayConfig>(DEFAULT_PAYMENT_CONFIG);

  const pushNotification = useCallback(
    (userId: string | 'all', title: string, message: string, category: NotificationItem['category']) => {
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId,
          title,
          message,
          category,
          read: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    },
    []
  );

  // Helper to sync single admin actions via server when Supabase is configured
  const dispatchAdminSync = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      if (!infraStatus?.supabase.serverConnected) return;
      const supabaseToken = await getSupabaseAccessToken();
      if (!adminToken && !supabaseToken) return;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      if (supabaseToken) headers['X-Supabase-Token'] = supabaseToken;
      try {
        await fetch('/api/supabase/admin-action', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action, payload })
        });
      } catch (err) {
        console.warn('Admin cloud sync warning:', err);
      }
    },
    [adminToken, infraStatus?.supabase.serverConnected]
  );

  // Hydrate public Supabase data (domains, courses, promos, coaching programs, testimonials, site settings)
  const hydratePublicFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const [
        { data: domRows },
        { data: courseRows },
        { data: promoRows },
        { data: coachRows },
        { data: testRows },
        { data: settingsRow }
      ] = await Promise.all([
        supabase.from('domains').select('*').order('sort_order', { ascending: true }),
        supabase.from('courses').select('*'),
        supabase.from('promo_codes').select('*'),
        supabase.from('coaching_programs').select('*'),
        supabase.from('testimonials').select('*'),
        supabase.from('site_settings').select('*').eq('id', 'default').maybeSingle()
      ]);

      if (domRows && domRows.length > 0) {
        setDomains(
          domRows.map((d: any) => ({
            id: d.id,
            code: d.code,
            title: d.title,
            shortLabel: d.short_label,
            description: d.description,
            skills: d.skills || [],
            highlightCourseId: d.highlight_course_id || undefined
          }))
        );
      }

      if (courseRows && courseRows.length > 0) {
        // Also try loading unlocked private contents for enrolled/admin users
        const { data: privRows } = await supabase.from('course_private_contents').select('*');
        const privMap = new Map<string, any[]>();
        (privRows || []).forEach((pr: any) => {
          privMap.set(pr.course_id, pr.modules_payload || []);
        });

        setCourses(
          courseRows.map((c: any) => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            subtitle: c.subtitle,
            description: c.description,
            domain: c.domain_id,
            level: c.level,
            duration: c.duration,
            modulesCount: c.modules_count,
            lessonsCount: c.lessons_count,
            priceXOF: c.price_xof,
            priceEUR: c.price_eur,
            priceUSD: c.price_usd,
            originalPriceXOF: c.original_price_xof || undefined,
            promoActive: Boolean(c.promo_active),
            promoPriceXOF: c.promo_price_xof || undefined,
            promoPriceEUR: c.promo_price_eur || undefined,
            promoPriceUSD: c.promo_price_usd || undefined,
            coverImage: c.cover_image,
            isFeatured: Boolean(c.is_featured),
            isPublished: Boolean(c.is_published),
            certificateEligible: Boolean(c.certificate_eligible),
            objectives: c.objectives || [],
            skillsAcquired: c.skills_acquired || [],
            resourcesIncluded: c.resources_included || [],
            modules: privMap.get(c.id) || c.syllabus_modules || []
          }))
        );
      }

      if (promoRows && promoRows.length > 0) {
        setPromoCodes(
          promoRows.map((p: any) => ({
            id: p.id,
            code: p.code,
            discountPercent: p.discount_percent,
            isActive: Boolean(p.is_active)
          }))
        );
      }

      if (coachRows && coachRows.length > 0) {
        setCoachingPrograms(
          coachRows.map((p: any) => ({
            id: p.id,
            type: p.type,
            title: p.title,
            subtitle: p.subtitle,
            badge: p.badge,
            priceXOF: p.price_xof,
            priceEUR: p.price_eur,
            priceUSD: p.price_usd,
            duration: p.duration,
            features: p.features || [],
            targetAudience: ''
          }))
        );
      }

      if (testRows && testRows.length > 0) {
        setTestimonials(
          testRows.map((t: any) => ({
            id: t.id,
            authorName: t.author_name,
            authorRole: t.author_role,
            courseTitle: t.course_title,
            quote: t.quote,
            verifiedDate: t.verified_date
          }))
        );
      }

      if (settingsRow) {
        setSiteSettings((prev) => ({
          ...INITIAL_SITE_SETTINGS,
          ...prev,
          agencyLogoDataUrl: settingsRow.agency_logo_url ?? prev.agencyLogoDataUrl,
          academyName: settingsRow.academy_name || prev.academyName,
          parentAgencyName: settingsRow.parent_agency_name || prev.parentAgencyName,
          directorName: settingsRow.director_name || prev.directorName,
          academyPresentation: settingsRow.academy_presentation || prev.academyPresentation,
          parentAgencyPresentation: settingsRow.parent_agency_presentation || prev.parentAgencyPresentation,
          directorBio: settingsRow.director_bio || prev.directorBio,
          contactEmail: settingsRow.contact_email || prev.contactEmail,
          contactPhone: settingsRow.contact_phone || prev.contactPhone,
          whatsappNumber: settingsRow.whatsapp_number || prev.whatsappNumber,
          headquarters: settingsRow.headquarters || prev.headquarters,
          supportHours: settingsRow.support_hours || prev.supportHours,
          instagramUrl: settingsRow.instagram_url || prev.instagramUrl,
          linkedinUrl: settingsRow.linkedin_url || prev.linkedinUrl,
          youtubeUrl: settingsRow.youtube_url || prev.youtubeUrl,
          legalNotices: settingsRow.legal_notices || prev.legalNotices,
          termsOfSale: settingsRow.terms_of_sale || prev.termsOfSale
        }));
      }
    } catch (err) {
      console.warn('Supabase public hydration skipped:', err);
    }
  }, []);

  // Hydrate authenticated Supabase student/admin session
  const hydrateSupabaseUser = useCallback(
    async (authUserId: string, fallbackEmail?: string) => {
      if (!supabase) return;
      try {
        const accessToken = await getSupabaseAccessToken();
        const serverEnrollPromise = accessToken
          ? fetch('/api/student/enrollments', {
              headers: { Authorization: `Bearer ${accessToken}` }
            })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null);

        const [
          { data: profile },
          enrollRes,
          { data: progRows },
          { data: certRows },
          ordersRes,
          { data: coachReqRows },
          serverEnrollData
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', authUserId).maybeSingle(),
          supabase.from('enrollments').select('*').eq('user_id', authUserId),
          supabase.from('lesson_progress').select('*').eq('user_id', authUserId),
          supabase.from('certificates').select('*').eq('user_id', authUserId),
          supabase.from('orders').select('*').eq('user_id', authUserId).order('created_at', { ascending: false }),
          supabase.from('coaching_requests').select('*').eq('user_id', authUserId).order('created_at', { ascending: false }),
          serverEnrollPromise
        ]);

        if (enrollRes.error) {
          console.warn('Supabase enrollments read warning:', enrollRes.error.message);
        }
        if (ordersRes.error) {
          console.warn('Supabase orders read warning:', ordersRes.error.message);
        }

        const browserEnrolledIds: string[] =
          !enrollRes.error && Array.isArray(enrollRes.data)
            ? enrollRes.data.map((e: any) => String(e.course_id || '')).filter(Boolean)
            : [];
        const serverEnrolledIds: string[] =
          serverEnrollData?.ok && Array.isArray(serverEnrollData.enrolledCourseIds)
            ? serverEnrollData.enrolledCourseIds.map((id: unknown) => String(id || '')).filter(Boolean)
            : [];

        const enrollmentSourceReadable = !enrollRes.error || Boolean(serverEnrollData?.ok);
        const mergedEnrolledIds = Array.from(new Set([...browserEnrolledIds, ...serverEnrolledIds]));

        const completedLessonIds = Array.from(
          new Set((progRows || []).flatMap((p: any) => p.completed_lesson_ids || []))
        );
        const lastAccessedLessonByCourse: Record<string, string> = {};
        let submittedExercises: User['submittedExercises'] = {};
        let quizScores: User['quizScores'] = {};

        (progRows || []).forEach((p: any) => {
          if (p.last_accessed_lesson_id) {
            lastAccessedLessonByCourse[p.course_id] = p.last_accessed_lesson_id;
          }
          if (p.submitted_exercises) {
            submittedExercises = { ...submittedExercises, ...p.submitted_exercises };
          }
          if (p.quiz_scores) {
            quizScores = { ...quizScores, ...p.quiz_scores };
          }
        });

        const certificates: UserCertificate[] = (certRows || []).map((c: any) => ({
          id: c.id,
          courseId: c.course_id,
          courseTitle: c.course_title,
          issuedDate: c.issued_date,
          studentName: c.student_name,
          verificationCode: c.verification_code,
          directorName: c.director_name
        }));

        setCurrentUser((prev) => {
          const preservedEnrolledIds =
            !enrollmentSourceReadable && prev?.id === authUserId ? prev.enrolledCourseIds : [];
          const finalEnrolledIds = Array.from(new Set([...mergedEnrolledIds, ...preservedEnrolledIds]));
          return {
            id: authUserId,
            email: profile?.email || fallbackEmail || prev?.email || '',
            name: profile?.name || fallbackEmail?.split('@')[0] || prev?.name || 'Apprenant DJIFFA',
            role: profile?.role === 'admin' ? 'admin' : 'student',
            phone: profile?.phone || prev?.phone || undefined,
            country: profile?.country || prev?.country || 'Bénin',
            enrolledCourseIds: finalEnrolledIds,
            completedLessonIds,
            lastAccessedLessonByCourse,
            submittedExercises,
            quizScores,
            certificates,
            createdAt: profile?.created_at || prev?.createdAt
          };
        });

        const rawBrowserOrders = !ordersRes.error && Array.isArray(ordersRes.data) ? ordersRes.data : [];
        const rawServerOrders =
          serverEnrollData?.ok && Array.isArray(serverEnrollData.orders) ? serverEnrollData.orders : [];
        const mergedOrderMap = new Map<string, any>();
        [...rawBrowserOrders, ...rawServerOrders].forEach((o: any) => {
          if (o?.reference && !mergedOrderMap.has(String(o.reference))) {
            mergedOrderMap.set(String(o.reference), o);
          }
        });
        const mergedOrderRows = Array.from(mergedOrderMap.values()).sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

        if (mergedOrderRows.length > 0 || enrollmentSourceReadable) {
          setOrders(
            mergedOrderRows.map((o: any) => ({
              id: o.id,
              reference: o.reference,
              userId: o.user_id || '',
              userName: o.user_name,
              userEmail: o.user_email,
              courseId: o.course_id,
              courseTitle: o.course_title,
              amount: o.amount,
              currency: o.currency,
              paymentMethod: o.payment_method,
              paymentProvider: o.payment_provider,
              providerTransactionId: o.provider_transaction_id || undefined,
              status: o.status,
              isDemoTransaction: Boolean(o.is_demo_transaction),
              promoCodeUsed: o.promo_code_used || undefined,
              customerPhone: o.customer_phone || undefined,
              createdAt: o.created_at,
              confirmedAt: o.confirmed_at || undefined
            }))
          );
        }

        if (Array.isArray(coachReqRows)) {
          setCoachingRequests(
            coachReqRows.map((r: any) => ({
              id: r.id,
              userId: r.user_id,
              userName: r.user_name,
              userEmail: r.user_email,
              userPhone: r.user_phone,
              type: r.type,
              programTitle: r.program_title,
              needDescription: r.need_description,
              preferredDate: r.preferred_date,
              status: r.status,
              meetingLink: r.meeting_link || undefined,
              adminNotes: r.admin_notes || undefined,
              createdAt: r.created_at
            }))
          );
        }

        // Refresh unlocked private course modules
        await hydratePublicFromSupabase();
      } catch (err) {
        console.warn('Supabase user hydration warning:', err);
      }
    },
    [hydratePublicFromSupabase]
  );

  const refreshServerPaymentStatus = useCallback(async () => {
    try {
      const [payRes, infraRes] = await Promise.all([
        fetch('/api/payments/status'),
        fetch('/api/infrastructure/status')
      ]);
      if (payRes.ok) {
        const data = await payRes.json();
        setPaymentConfig((prev) => ({
          ...prev,
          activeProvider: data.provider || prev.activeProvider,
          isTestMode: data.mode !== 'live',
          serverConfigured: Boolean(data.configured),
          serverMessage: data.message || prev.serverMessage
        }));
      }
      if (infraRes.ok) {
        const infraData = (await infraRes.json()) as InfrastructureStatus;
        setInfraStatus(infraData);
      }
    } catch {
      setPaymentConfig((prev) => ({
        ...prev,
        serverConfigured: false,
        serverMessage: 'Paiement non configuré (serveur de paiement hors ligne ou clés absentes).'
      }));
    }
  }, []);

  const refreshSupabaseAdminData = useCallback(async () => {
    if (!infraStatus?.supabase.serverConnected) return;
    const supabaseToken = await getSupabaseAccessToken();
    if (!adminToken && !supabaseToken) return;
    const headers: Record<string, string> = {};
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    if (supabaseToken) headers['X-Supabase-Token'] = supabaseToken;

    try {
      const res = await fetch('/api/supabase/admin-data', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;

      const enrollByUser = new Map<string, string[]>();
      (data.enrollments || []).forEach((e: any) => {
        const arr = enrollByUser.get(e.user_id) || [];
        arr.push(e.course_id);
        enrollByUser.set(e.user_id, arr);
      });

      const certsByUser = new Map<string, UserCertificate[]>();
      (data.certificates || []).forEach((c: any) => {
        const arr = certsByUser.get(c.user_id) || [];
        arr.push({
          id: c.id,
          courseId: c.course_id,
          courseTitle: c.course_title,
          issuedDate: c.issued_date,
          studentName: c.student_name,
          verificationCode: c.verification_code,
          directorName: c.director_name
        });
        certsByUser.set(c.user_id, arr);
      });

      const progByUser = new Map<string, any[]>();
      (data.progress || []).forEach((p: any) => {
        const arr = progByUser.get(p.user_id) || [];
        arr.push(p);
        progByUser.set(p.user_id, arr);
      });

      if (Array.isArray(data.profiles)) {
        const mappedStudents: User[] = data.profiles
          .filter((p: any) => p.role !== 'admin')
          .map((p: any) => {
            const pRows = progByUser.get(p.id) || [];
            const lastMap: Record<string, string> = {};
            let exMap: User['submittedExercises'] = {};
            let qMap: User['quizScores'] = {};
            pRows.forEach((pr: any) => {
              if (pr.last_accessed_lesson_id) lastMap[pr.course_id] = pr.last_accessed_lesson_id;
              if (pr.submitted_exercises) exMap = { ...exMap, ...pr.submitted_exercises };
              if (pr.quiz_scores) qMap = { ...qMap, ...pr.quiz_scores };
            });
            return {
              id: p.id,
              email: p.email,
              name: p.name,
              role: 'student',
              phone: p.phone || undefined,
              country: p.country || 'Bénin',
              enrolledCourseIds: enrollByUser.get(p.id) || [],
              completedLessonIds: Array.from(new Set(pRows.flatMap((pr: any) => pr.completed_lesson_ids || []))),
              lastAccessedLessonByCourse: lastMap,
              submittedExercises: exMap,
              quizScores: qMap,
              certificates: certsByUser.get(p.id) || [],
              createdAt: p.created_at
            };
          });
        setStudents(mappedStudents);
      }

      if (Array.isArray(data.orders)) {
        setOrders(
          data.orders.map((o: any) => ({
            id: o.id,
            reference: o.reference,
            userId: o.user_id || '',
            userName: o.user_name,
            userEmail: o.user_email,
            courseId: o.course_id,
            courseTitle: o.course_title,
            amount: o.amount,
            currency: o.currency,
            paymentMethod: o.payment_method,
            paymentProvider: o.payment_provider,
            providerTransactionId: o.provider_transaction_id || undefined,
            status: o.status,
            isDemoTransaction: Boolean(o.is_demo_transaction),
            promoCodeUsed: o.promo_code_used || undefined,
            customerPhone: o.customer_phone || undefined,
            createdAt: o.created_at,
            confirmedAt: o.confirmed_at || undefined
          }))
        );
      }

      if (Array.isArray(data.coachingRequests)) {
        setCoachingRequests(
          data.coachingRequests.map((r: any) => ({
            id: r.id,
            userId: r.user_id || '',
            userName: r.user_name,
            userEmail: r.user_email,
            userPhone: r.user_phone,
            type: r.type,
            programTitle: r.program_title,
            needDescription: r.need_description,
            preferredDate: r.preferred_date,
            status: r.status,
            meetingLink: r.meeting_link || undefined,
            adminNotes: r.admin_notes || undefined,
            createdAt: r.created_at
          }))
        );
      }
    } catch (err) {
      console.warn('Admin Supabase load warning:', err);
    }
  }, [adminToken, infraStatus?.supabase.serverConnected]);

  const refreshAdminTelemetry = useCallback(async () => {
    const supabaseToken = await getSupabaseAccessToken();
    if (!adminToken && !supabaseToken) return;
    const headers: Record<string, string> = {};
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    if (supabaseToken) headers['X-Supabase-Token'] = supabaseToken;

    try {
      const [eventsRes, msgRes] = await Promise.all([
        fetch('/api/admin/payment-events', { headers }),
        fetch('/api/admin/contact-messages', { headers })
      ]);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        if (eventsData.ok && Array.isArray(eventsData.events)) {
          setPaymentEvents(eventsData.events);
        }
      }

      if (msgRes.ok) {
        const msgData = await msgRes.json();
        if (msgData.ok && Array.isArray(msgData.messages)) {
          const serverMsgs: ContactMessage[] = msgData.messages.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            phone: m.phone || undefined,
            subject: m.subject,
            message: m.message,
            status: m.status || 'new',
            adminNotes: m.adminNotes || m.admin_notes || undefined,
            createdAt: m.createdAt || m.created_at || new Date().toISOString()
          }));
          setContactMessages((prev) => {
            const seen = new Set(serverMsgs.map((m) => m.id));
            const merged = [...serverMsgs, ...prev.filter((p) => !seen.has(p.id))];
            return merged.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          });
        }
      }
    } catch (err) {
      console.warn('Admin telemetry refresh warning:', err);
    }
  }, [adminToken]);

  const verifyExistingPayment = useCallback(
    async (reference: string, transactionId?: string, courseId?: string) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const supabaseToken = await getSupabaseAccessToken();
        if (supabaseToken) {
          headers['Authorization'] = `Bearer ${supabaseToken}`;
        }
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers,
          body: JSON.stringify({ reference, transactionId })
        });
        const data = await res.json();
        const resolvedCourseId: string | undefined = data.courseId || courseId;
        if (res.ok && data.verified) {
          const confirmedTxId = data.transactionId ? String(data.transactionId) : transactionId;
          setOrders((prev) =>
            prev.map((o) =>
              o.reference === reference
                ? {
                    ...o,
                    status: 'confirmed',
                    providerTransactionId: confirmedTxId || o.providerTransactionId,
                    confirmedAt: o.confirmedAt || new Date().toISOString()
                  }
                : o
            )
          );
          if (resolvedCourseId) {
            setCurrentUser((prev) =>
              prev
                ? { ...prev, enrolledCourseIds: Array.from(new Set([...prev.enrolledCourseIds, resolvedCourseId])) }
                : prev
            );
          }
          if (isSupabaseConfigured && supabase) {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session?.user) {
              await hydrateSupabaseUser(sessionData.session.user.id, sessionData.session.user.email);
            } else if (currentUser && isUuid(currentUser.id)) {
              await hydrateSupabaseUser(currentUser.id, currentUser.email);
            }
          }
          pushNotification(
            currentUser?.id || 'all',
            'Paiement Confirmé',
            `Votre transaction (${reference}) a été vérifiée et confirmée par le prestataire.`,
            'purchase'
          );
          return {
            ok: true,
            verified: true,
            status: 'confirmed' as const,
            providerStatus: data.providerStatus,
            courseId: resolvedCourseId,
            message: 'Paiement vérifié et accès activé.'
          };
        }

        const isTemporary = Boolean(data.temporaryError) || res.status >= 500;
        const reportedStatus: Order['status'] =
          !isTemporary && (data.status === 'failed' || data.status === 'cancelled' || data.status === 'refunded')
            ? data.status
            : 'pending';
        const isFinalFailure =
          !isTemporary &&
          (Boolean(data.finalFailure) ||
            reportedStatus === 'failed' ||
            reportedStatus === 'cancelled' ||
            reportedStatus === 'refunded');

        if (isFinalFailure) {
          const syncedTxId = data.transactionId ? String(data.transactionId) : transactionId;
          setOrders((prev) =>
            prev.map((o) =>
              o.reference === reference && o.status !== 'confirmed'
                ? {
                    ...o,
                    status: reportedStatus,
                    providerTransactionId: syncedTxId || o.providerTransactionId
                  }
                : o
            )
          );
          if (isSupabaseConfigured && supabase) {
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session?.user) {
              await hydrateSupabaseUser(sessionData.session.user.id, sessionData.session.user.email);
            } else if (currentUser && isUuid(currentUser.id)) {
              await hydrateSupabaseUser(currentUser.id, currentUser.email);
            }
          }
        }

        return {
          ok: false,
          verified: false,
          finalFailure: isFinalFailure,
          temporaryError: isTemporary,
          status: reportedStatus,
          providerStatus: data.providerStatus,
          courseId: resolvedCourseId,
          message:
            data.error ||
            (reportedStatus === 'failed'
              ? 'La transaction a été refusée par le prestataire.'
              : reportedStatus === 'cancelled'
              ? 'La transaction a été annulée ou a expiré.'
              : `Transaction en statut : ${data.providerStatus || data.status || 'en attente'}.`)
        };
      } catch (err) {
        return {
          ok: false,
          verified: false,
          finalFailure: false,
          temporaryError: true,
          status: 'pending' as const,
          message:
            err instanceof Error
              ? err.message
              : 'Vérification temporairement indisponible. La commande reste en attente.'
        };
      }
    },
    [currentUser, hydrateSupabaseUser, pushNotification]
  );

  // Initial load: server payment/infra status, Supabase hydration, and return-URL payment check
  useEffect(() => {
    refreshServerPaymentStatus();
    if (isSupabaseConfigured && supabase) {
      hydratePublicFromSupabase();
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          hydrateSupabaseUser(data.session.user.id, data.session.user.email);
        }
      });
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          hydrateSupabaseUser(session.user.id, session.user.email);
        }
      });
      return () => {
        listener.subscription.unsubscribe();
      };
    }
  }, [refreshServerPaymentStatus, hydratePublicFromSupabase, hydrateSupabaseUser]);

  // Handle provider redirect return URLs (?payment_ref=...&id=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentRef = params.get('payment_ref');
    if (!paymentRef) return;
    const txId = params.get('id') || params.get('transaction_id') || undefined;

    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      const result = await verifyExistingPayment(paymentRef, txId);
      let hasActiveSession = false;
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          hasActiveSession = true;
          await hydrateSupabaseUser(data.session.user.id, data.session.user.email);
        }
      }
      if (result.verified) {
        if (result.courseId && !isSupabaseConfigured) {
          setCurrentUser((prev) =>
            prev
              ? { ...prev, enrolledCourseIds: Array.from(new Set([...prev.enrolledCourseIds, result.courseId!])) }
              : prev
          );
        }
        setPaymentReturnNotice({
          type: 'success',
          message:
            isSupabaseConfigured && !hasActiveSession
              ? `Paiement confirmé (${paymentRef}). Connectez-vous avec votre email d’achat pour accéder à votre formation dans votre Espace Apprenant.`
              : `Paiement confirmé (${paymentRef}). Votre formation est désormais accessible dans votre Espace Apprenant.`
        });
      } else if (result.finalFailure) {
        setPaymentReturnNotice({
          type: 'error',
          message: `Paiement non validé (${paymentRef}) : ${result.message || 'Transaction refusée ou annulée.'}`
        });
      } else {
        setPaymentReturnNotice({
          type: 'pending',
          message: `Retour prestataire (${paymentRef}) : ${result.message || 'Vérification en attente de confirmation.'}`
        });
      }
    })();
  }, []);

  // Persistence sync (keeps localStorage cache working smoothly alongside cloud)
  useEffect(() => { localStorage.setItem('djiffa_currency', currency); }, [currency]);
  useEffect(() => { localStorage.setItem('djiffa_language', language); }, [language]);
  useEffect(() => { localStorage.setItem('djiffa_courses', JSON.stringify(courses)); }, [courses]);
  useEffect(() => { localStorage.setItem('djiffa_domains', JSON.stringify(domains)); }, [domains]);
  useEffect(() => { localStorage.setItem('djiffa_promos', JSON.stringify(promoCodes)); }, [promoCodes]);
  useEffect(() => { localStorage.setItem('djiffa_site_settings', JSON.stringify(siteSettings)); }, [siteSettings]);
  useEffect(() => { localStorage.setItem('djiffa_coaching_programs', JSON.stringify(coachingPrograms)); }, [coachingPrograms]);
  useEffect(() => { localStorage.setItem('djiffa_testimonials', JSON.stringify(testimonials)); }, [testimonials]);
  useEffect(() => { localStorage.setItem('djiffa_students', JSON.stringify(students)); }, [students]);
  useEffect(() => { localStorage.setItem('djiffa_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('djiffa_coaching', JSON.stringify(coachingRequests)); }, [coachingRequests]);
  useEffect(() => { localStorage.setItem('djiffa_contact_messages', JSON.stringify(contactMessages)); }, [contactMessages]);
  useEffect(() => { localStorage.setItem('djiffa_notifications', JSON.stringify(notifications)); }, [notifications]);
  const clearAdminSessionStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      sessionStorage.removeItem(ADMIN_PROFILE_SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  const invalidateExpiredAdminSession = useCallback(
    (reason?: string) => {
      clearAdminSessionStorage();
      localStorage.removeItem('djiffa_user');
      setAdminToken(null);
      setCurrentUser((prev) => (prev?.role === 'admin' ? null : prev));
      setAdminSessionExpiredNotice(
        reason ||
          'Votre session Direction serveur a expiré ou le serveur a redémarré. Veuillez vous reconnecter à l’espace Direction.'
      );
    },
    [clearAdminSessionStorage]
  );

  const dismissAdminSessionExpiredNotice = useCallback(() => {
    setAdminSessionExpiredNotice(null);
  }, []);

  // Verify restored or active admin session against Express /api/auth/admin-session
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;
    let cancelled = false;

    (async () => {
      const headers: Record<string, string> = {};
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      try {
        const sbToken = await getSupabaseAccessToken();
        if (sbToken) headers['X-Supabase-Token'] = sbToken;
      } catch {
        // ignore
      }

      if (!headers['Authorization'] && !headers['X-Supabase-Token']) {
        if (!cancelled) {
          invalidateExpiredAdminSession(
            'Aucun jeton Direction actif côté serveur. Veuillez vous authentifier à nouveau.'
          );
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/admin-session', { headers });
        if (!res.ok && !cancelled) {
          invalidateExpiredAdminSession(
            'La session serveur Direction a expiré (ou le Preview a redémarré). Reconnectez-vous pour retrouver tous les contrôles serveur.'
          );
        }
      } catch {
        // Ignore transient network errors during startup
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser, adminToken, invalidateExpiredAdminSession]);

  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        localStorage.removeItem('djiffa_user');
        try {
          sessionStorage.setItem(ADMIN_PROFILE_SESSION_KEY, JSON.stringify(currentUser));
        } catch {
          // ignore
        }
      } else {
        localStorage.setItem('djiffa_user', JSON.stringify(currentUser));
        setStudents((prev) => {
          const exists = prev.some((s) => s.id === currentUser.id);
          return exists ? prev.map((s) => (s.id === currentUser.id ? currentUser : s)) : [currentUser, ...prev];
        });
      }
    } else {
      localStorage.removeItem('djiffa_user');
      try {
        sessionStorage.removeItem(ADMIN_PROFILE_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, [currentUser]);

  const navigateTo = (view: AppView, courseId?: string, lessonId?: string) => {
    setActiveView(view);
    if (courseId !== undefined) setSelectedCourseId(courseId);
    if (lessonId !== undefined) setActiveLessonId(lessonId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAuthModal = (mode: 'student' | 'admin' = 'student') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);
  const dismissPaymentReturnNotice = () => setPaymentReturnNotice(null);

  const setCurrency = (c: Currency) => setCurrencyState(c);
  const setLanguage = (lang: Language) => setLanguageState(lang);

  const formatPrice = (amountXOF: number, forcedCurrency?: Currency): string => {
    const cur = forcedCurrency || currency;
    if (cur === 'EUR') {
      const eur = Math.round(amountXOF / 655.957);
      return `${eur.toLocaleString('fr-FR')} €`;
    }
    if (cur === 'USD') {
      const usd = Math.round(amountXOF / 600);
      return `$${usd.toLocaleString('en-US')}`;
    }
    return `${amountXOF.toLocaleString('fr-FR')} FCFA`;
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  // Auth Functions (Local fallback + Real Supabase Auth)
  const loginAsDemoStudent = () => {
    if (isSupabaseConfigured) return;
    const demo = students.find((s) => s.id === 'usr-student-amara') || INITIAL_DEMO_STUDENTS[0];
    setCurrentUser(demo);
    setAuthModalOpen(false);
  };

  const loginStudent = (email: string): { ok: boolean; message?: string } => {
    const clean = email.trim().toLowerCase();
    if (!clean) return { ok: false, message: 'Veuillez saisir votre adresse email.' };
    if (clean === 'faith.ariola@djiffa-agency.com') {
      return { ok: false, message: 'Veuillez utiliser l’espace de connexion Administratrice pour ce compte.' };
    }
    const found = students.find((s) => s.email.toLowerCase() === clean);
    if (found) {
      setCurrentUser(found);
      setAuthModalOpen(false);
      return { ok: true };
    }
    return { ok: false, message: 'Aucun compte apprenant trouvé avec cet email. Créez un compte ci-contre.' };
  };

  const registerUser = (name: string, email: string, phone?: string, country?: string): User => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'faith.ariola@djiffa-agency.com') {
      throw new Error('Cette adresse est réservée à la Direction. Utilisez l’onglet Direction.');
    }
    const existing = students.find((s) => s.email.toLowerCase() === cleanEmail);
    if (existing) {
      setCurrentUser(existing);
      setAuthModalOpen(false);
      return existing;
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim(),
      country: country?.trim() || 'Bénin',
      role: 'student',
      enrolledCourseIds: [],
      completedLessonIds: [],
      lastAccessedLessonByCourse: {},
      submittedExercises: {},
      quizScores: {},
      certificates: [],
      createdAt: new Date().toISOString()
    };
    setStudents((prev) => [newUser, ...prev]);
    setCurrentUser(newUser);
    setAuthModalOpen(false);
    return newUser;
  };

  const signInWithEmailPassword = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; message?: string }> => {
    const clean = email.trim().toLowerCase();
    if (clean === 'faith.ariola@djiffa-agency.com') {
      return { ok: false, message: 'Veuillez utiliser l’onglet Direction pour le compte administratrice.' };
    }
    if (!isSupabaseConfigured || !supabase) {
      return loginStudent(email);
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: clean,
      password
    });
    if (error || !data.user) {
      return { ok: false, message: error?.message || 'Email ou mot de passe incorrect.' };
    }
    await hydrateSupabaseUser(data.user.id, data.user.email);
    setAuthModalOpen(false);
    return { ok: true };
  };

  const signUpWithEmailPassword = async (
    name: string,
    email: string,
    password: string,
    phone?: string,
    country?: string
  ): Promise<{ ok: boolean; needsConfirmation?: boolean; user?: User; message?: string }> => {
    const clean = email.trim().toLowerCase();
    if (clean === 'faith.ariola@djiffa-agency.com') {
      return { ok: false, message: 'Cette adresse est réservée à la Direction. Utilisez l’onglet Direction.' };
    }
    if (!isSupabaseConfigured || !supabase) {
      const localUser = registerUser(name, email, phone, country);
      return { ok: true, user: localUser };
    }

    const { data, error } = await supabase.auth.signUp({
      email: clean,
      password,
      options: {
        data: {
          name: name.trim(),
          phone: phone?.trim() || '',
          country: country?.trim() || 'Bénin'
        }
      }
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    if (data.user && data.session) {
      await hydrateSupabaseUser(data.user.id, data.user.email);
      setAuthModalOpen(false);
      return { ok: true };
    }
    return {
      ok: true,
      needsConfirmation: true,
      message: 'Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.'
    };
  };

  const loginAdminServer = async (email: string, accessCode: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await fetch('/api/auth/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accessCode })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, message: data.error || 'Identifiants administratrice invalides.' };
      }
      const token = data.token || null;
      if (token) {
        try {
          sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
        } catch {
          // ignore
        }
      }
      setAdminSessionExpiredNotice(null);
      setAdminToken(token);
      setCurrentUser({
        ...DEMO_ADMIN,
        email: data.admin?.email || DEMO_ADMIN.email
      });
      setAuthModalOpen(false);
      navigateTo('admin-space');
      return { ok: true };
    } catch {
      return { ok: false, message: 'Impossible de contacter le serveur d’authentification.' };
    }
  };

  const persistProgressToSupabase = async (updatedUser: User, courseId: string) => {
    if (!isSupabaseConfigured || !supabase || !isUuid(updatedUser.id)) return;
    try {
      await supabase.from('lesson_progress').upsert(
        {
          user_id: updatedUser.id,
          course_id: courseId,
          completed_lesson_ids: updatedUser.completedLessonIds,
          last_accessed_lesson_id: updatedUser.lastAccessedLessonByCourse?.[courseId] || null,
          submitted_exercises: updatedUser.submittedExercises,
          quiz_scores: updatedUser.quizScores,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,course_id' }
      );
    } catch (err) {
      console.warn('Cloud progress sync warning:', err);
    }
  };

  const updateUserProfile = (updates: Partial<Pick<User, 'name' | 'phone' | 'country'>>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    if (isSupabaseConfigured && supabase && isUuid(currentUser.id)) {
      supabase
        .from('profiles')
        .update({
          name: updated.name,
          phone: updated.phone || null,
          country: updated.country || 'Bénin',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id)
        .then();
    }
  };

  const logout = () => {
    clearAdminSessionStorage();
    localStorage.removeItem('djiffa_user');
    setAdminSessionExpiredNotice(null);
    setAdminToken(null);
    setCurrentUser(null);
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
    if (activeView === 'admin-space' || activeView === 'student-space' || activeView === 'player') {
      navigateTo('home');
    }
  };

  const isEnrolled = (courseId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.enrolledCourseIds.includes(courseId);
  };

  const getCourseProgress = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) return { completedCount: 0, totalCount: 0, percentage: 0 };

    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const totalCount = allLessonIds.length;
    if (totalCount === 0) return { completedCount: 0, totalCount: 0, percentage: 0 };

    const completedCount = currentUser
      ? allLessonIds.filter((id) => currentUser.completedLessonIds.includes(id)).length
      : 0;

    const percentage = Math.round((completedCount / totalCount) * 100);
    return { completedCount, totalCount, percentage };
  };

  const setLastAccessedLesson = (courseId: string, lessonId: string) => {
    if (!currentUser) return;
    if (currentUser.lastAccessedLessonByCourse?.[courseId] === lessonId) return;
    const updatedUser: User = {
      ...currentUser,
      lastAccessedLessonByCourse: {
        ...(currentUser.lastAccessedLessonByCourse || {}),
        [courseId]: lessonId
      }
    };
    setCurrentUser(updatedUser);
    persistProgressToSupabase(updatedUser, courseId);
  };

  const persistCertificateToSupabase = async (user: User, cert: UserCertificate) => {
    if (!isSupabaseConfigured || !supabase || !isUuid(user.id)) return;
    try {
      await supabase.from('certificates').upsert(
        {
          id: cert.id,
          user_id: user.id,
          course_id: cert.courseId,
          course_title: cert.courseTitle,
          student_name: cert.studentName,
          director_name: cert.directorName,
          verification_code: cert.verificationCode,
          issued_date: cert.issuedDate
        },
        { onConflict: 'user_id,course_id' }
      );
    } catch (err) {
      console.warn('Certificate cloud sync warning:', err);
    }
  };

  const toggleLessonComplete = (courseId: string, lessonId: string) => {
    if (!currentUser) return;
    const isCompleted = currentUser.completedLessonIds.includes(lessonId);
    const updatedCompleted = isCompleted
      ? currentUser.completedLessonIds.filter((id) => id !== lessonId)
      : [...currentUser.completedLessonIds, lessonId];

    const updatedUser: User = {
      ...currentUser,
      completedLessonIds: updatedCompleted
    };

    const course = courses.find((c) => c.id === courseId);
    if (course && course.certificateEligible) {
      const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const allDone = allLessonIds.length > 0 && allLessonIds.every((id) => updatedCompleted.includes(id));
      const alreadyHasCert = updatedUser.certificates.some((cert) => cert.courseId === courseId);

      if (allDone && !alreadyHasCert) {
        const newCert: UserCertificate = {
          id: `cert-${Date.now()}`,
          courseId: course.id,
          courseTitle: course.title,
          issuedDate: new Date().toISOString().split('T')[0],
          studentName: updatedUser.name,
          verificationCode: `DJIFFA-ACADEMY-${Date.now().toString().slice(-6)}`,
          directorName: 'Faith Ariola'
        };
        updatedUser.certificates.push(newCert);
        persistCertificateToSupabase(updatedUser, newCert);
        pushNotification(
          updatedUser.id,
          'Certificat débloqué !',
          `Vous avez complété 100% de « ${course.title} ». Votre certificat est disponible.`,
          'progress'
        );
      }
    }

    setCurrentUser(updatedUser);
    persistProgressToSupabase(updatedUser, courseId);
  };

  const submitExercise = (lessonId: string, submissionText: string, link?: string) => {
    if (!currentUser) return;
    const updatedUser: User = {
      ...currentUser,
      submittedExercises: {
        ...currentUser.submittedExercises,
        [lessonId]: {
          submissionText,
          link,
          submittedAt: new Date().toISOString(),
          status: 'submitted'
        }
      }
    };
    setCurrentUser(updatedUser);
    const matchedCourse = courses.find((c) => c.modules.some((m) => m.lessons.some((l) => l.id === lessonId)));
    if (matchedCourse) {
      persistProgressToSupabase(updatedUser, matchedCourse.id);
    }
  };

  const submitQuizResult = (quizId: string, score: number, total: number) => {
    if (!currentUser) return;
    const passed = total > 0 && score / total >= 0.7;
    const updatedUser: User = {
      ...currentUser,
      quizScores: {
        ...currentUser.quizScores,
        [quizId]: {
          score,
          total,
          passed,
          completedAt: new Date().toISOString()
        }
      }
    };
    setCurrentUser(updatedUser);
    const matchedCourse = courses.find(
      (c) =>
        `final-${c.id}` === quizId ||
        c.modules.some((m) => m.lessons.some((l) => l.id === quizId))
    );
    if (matchedCourse) {
      persistProgressToSupabase(updatedUser, matchedCourse.id);
    }
  };

  const claimCertificate = (courseId: string): UserCertificate | null => {
    if (!currentUser) return null;
    const existing = currentUser.certificates.find((c) => c.courseId === courseId);
    if (existing) return existing;

    const course = courses.find((c) => c.id === courseId);
    if (!course || !course.certificateEligible) return null;

    const progress = getCourseProgress(courseId);
    if ((progress.totalCount === 0 || progress.percentage < 100) && currentUser.role !== 'admin') return null;

    const newCert: UserCertificate = {
      id: `cert-${Date.now()}`,
      courseId: course.id,
      courseTitle: course.title,
      issuedDate: new Date().toISOString().split('T')[0],
      studentName: currentUser.name,
      verificationCode: `DJIFFA-ACADEMY-${Math.floor(100000 + Math.random() * 900000)}`,
      directorName: 'Faith Ariola'
    };

    const updatedUser = {
      ...currentUser,
      certificates: [...currentUser.certificates, newCert]
    };
    setCurrentUser(updatedUser);
    persistCertificateToSupabase(updatedUser, newCert);
    return newCert;
  };

  const validatePromoCode = (code: string): PromoCode | null => {
    const clean = code.trim().toUpperCase();
    return promoCodes.find((p) => p.isActive && p.code.toUpperCase() === clean) || null;
  };

  const processPurchase = async (
    courseId: string,
    paymentMethod: PaymentMethod,
    phoneOrCard: string,
    options?: { promoCode?: string; discountPercent?: number; isDemoMode?: boolean; transactionId?: string; reference?: string }
  ): Promise<{ success: boolean; isDemoRecorded?: boolean; order: Order; message?: string }> => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) throw new Error('Formation introuvable');
    if (!currentUser) throw new Error('Veuillez vous connecter ou créer un compte avant de finaliser l’achat.');

    const discountMultiplier = 1 - ((options?.discountPercent || 0) / 100);
    const pricing = getCoursePricing(course);
    const baseAmount =
      currency === 'EUR' ? pricing.activeEUR : currency === 'USD' ? pricing.activeUSD : pricing.activeXOF;
    const finalAmount = Math.max(0, Math.round(baseAmount * discountMultiplier));

    const isDemo = options?.isDemoMode ?? !paymentConfig.serverConfigured;
    const orderRef =
      options?.reference ||
      `${isDemo ? 'TEST' : 'DJF'}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    let provider: Order['paymentProvider'] = 'FedaPay';
    if (paymentMethod === 'kkiapay' || paymentConfig.activeProvider === 'kkiapay') provider = 'KKiaPay';
    else if (paymentMethod === 'cinetpay' || paymentConfig.activeProvider === 'cinetpay') provider = 'CinetPay';
    else if (paymentMethod.startsWith('card') && !paymentConfig.serverConfigured) provider = 'Stripe/Cartes';

    // Strict Payment Rule: Never unlock a paid course on the basis of a simulated/unverified demo payment
    if (isDemo && finalAmount > 0) {
      const demoOrder: Order = {
        id: `ord-${Date.now()}`,
        reference: orderRef,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        courseId: course.id,
        courseTitle: course.title,
        amount: finalAmount,
        currency,
        paymentMethod,
        paymentProvider: provider,
        status: 'pending',
        isDemoTransaction: true,
        promoCodeUsed: options?.promoCode,
        customerPhone: phoneOrCard,
        createdAt: new Date().toISOString()
      };
      setOrders((prev) => [demoOrder, ...prev]);
      pushNotification(
        currentUser.id,
        'Commande de test enregistrée (Démo)',
        `Référence ${orderRef} enregistrée en mode démonstration. Aucun débit réel ni déblocage automatique sans paiement vérifié.`,
        'purchase'
      );
      return {
        success: false,
        isDemoRecorded: true,
        order: demoOrder,
        message:
          'Commande de test enregistrée (Mode Démonstration). L’accès à cette formation payante reste verrouillé tant qu’un paiement réel n’a pas été vérifié ou validé par la Direction.'
      };
    }

    // Real server-side verification when gateway is configured (for paid courses)
    if (finalAmount > 0 && paymentConfig.serverConfigured) {
      const verifyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const supabaseToken = await getSupabaseAccessToken();
      if (supabaseToken) {
        verifyHeaders['Authorization'] = `Bearer ${supabaseToken}`;
      }
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: verifyHeaders,
        body: JSON.stringify({ reference: orderRef, transactionId: options?.transactionId })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        const isTemporary = Boolean(verifyData.temporaryError) || verifyRes.status >= 500;
        const resolvedStatus: Order['status'] =
          !isTemporary &&
          (verifyData.status === 'failed' || verifyData.status === 'cancelled' || verifyData.status === 'refunded')
            ? verifyData.status
            : 'pending';
        const nonConfirmedOrder: Order = {
          id: `ord-${Date.now()}`,
          reference: orderRef,
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          courseId: course.id,
          courseTitle: course.title,
          amount: finalAmount,
          currency,
          paymentMethod,
          paymentProvider: provider,
          providerTransactionId: options?.transactionId,
          status: resolvedStatus,
          isDemoTransaction: paymentConfig.isTestMode,
          promoCodeUsed: options?.promoCode,
          customerPhone: phoneOrCard,
          createdAt: new Date().toISOString()
        };
        setOrders((prev) => [nonConfirmedOrder, ...prev]);
        return {
          success: false,
          order: nonConfirmedOrder,
          message: verifyData.error || 'Paiement en attente de confirmation réelle auprès du prestataire.'
        };
      }
    }

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      reference: orderRef,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      courseId: course.id,
      courseTitle: course.title,
      amount: finalAmount,
      currency,
      paymentMethod,
      paymentProvider: provider,
      providerTransactionId: options?.transactionId,
      status: 'confirmed',
      isDemoTransaction: false,
      promoCodeUsed: options?.promoCode,
      customerPhone: phoneOrCard,
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString()
    };

    setOrders((prev) => [newOrder, ...prev]);

    const updatedEnrolled = Array.from(new Set([...currentUser.enrolledCourseIds, courseId]));
    setCurrentUser({
      ...currentUser,
      enrolledCourseIds: updatedEnrolled
    });

    if (isSupabaseConfigured && isUuid(currentUser.id)) {
      await hydrateSupabaseUser(currentUser.id, currentUser.email);
    }

    pushNotification(
      currentUser.id,
      'Paiement Confirmé',
      `Votre accès à « ${course.title} » est actif (Réf : ${orderRef}).`,
      'purchase'
    );

    return { success: true, order: newOrder };
  };

  const submitCoachingRequest = (
    data: Omit<CoachingRequest, 'id' | 'createdAt' | 'status' | 'userId' | 'userName' | 'userEmail'> & {
      userName?: string;
      userEmail?: string;
    }
  ): CoachingRequest => {
    const user = currentUser || {
      id: `usr-guest-${Date.now()}`,
      name: data.userName?.trim() || 'Client Accompagnement',
      email: data.userEmail?.trim() || 'client@djiffa.com'
    };

    const newReq: CoachingRequest = {
      userPhone: data.userPhone,
      type: data.type,
      programTitle: data.programTitle,
      needDescription: data.needDescription,
      preferredDate: data.preferredDate,
      id: `req-${Date.now()}`,
      userId: user.id,
      userName: data.userName?.trim() || user.name,
      userEmail: data.userEmail?.trim() || user.email,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setCoachingRequests((prev) => [newReq, ...prev]);

    getSupabaseAccessToken()
      .then((supabaseToken) => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (supabaseToken) headers['Authorization'] = `Bearer ${supabaseToken}`;
        return fetch('/api/public/coaching-request', {
          method: 'POST',
          headers,
          body: JSON.stringify(newReq)
        });
      })
      .then((res) => (res.ok ? res.json() : null))
      .then((serverData) => {
        if (serverData?.ok && serverData.id && serverData.id !== newReq.id) {
          setCoachingRequests((prev) =>
            prev.map((r) => (r.id === newReq.id ? { ...r, id: String(serverData.id) } : r))
          );
        }
      })
      .catch(() => undefined);

    pushNotification(
      user.id,
      'Demande d’accompagnement enregistrée',
      `Votre demande pour « ${data.programTitle} » est en attente de validation par Faith Ariola.`,
      'coaching'
    );
    return newReq;
  };

  const submitContactMessage = async (data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<ContactMessage> => {
    const tempId = `msg-${Date.now()}`;
    const item: ContactMessage = {
      id: tempId,
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone?.trim() || undefined,
      subject: data.subject.trim(),
      message: data.message.trim(),
      status: 'new',
      createdAt: new Date().toISOString()
    };

    setContactMessages((prev) => [item, ...prev]);

    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload?.ok && payload.item?.id && payload.item.id !== tempId) {
          const syncedItem: ContactMessage = { ...item, id: String(payload.item.id), createdAt: payload.item.createdAt || item.createdAt };
          setContactMessages((prev) => prev.map((m) => (m.id === tempId ? syncedItem : m)));
          return syncedItem;
        }
      }
    } catch {
      // local state already preserved
    }

    return item;
  };

  const updateContactMessageStatus = (id: string, status: ContactMessage['status'], adminNotes?: string) => {
    setContactMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status, adminNotes: adminNotes !== undefined ? adminNotes : m.adminNotes } : m
      )
    );
    getSupabaseAccessToken()
      .then((supabaseToken) => {
        if (!adminToken && !supabaseToken) return;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
        if (supabaseToken) headers['X-Supabase-Token'] = supabaseToken;
        return fetch(`/api/admin/contact-messages/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status, adminNotes })
        });
      })
      .catch(() => undefined);
  };

  // Cloud Migration & Student Sync
  const syncCurrentStudentToCloud = async () => {
    if (!currentUser) {
      return { ok: false, message: 'Connectez-vous à votre compte avant de synchroniser.' };
    }
    return migrateStudentProgressToSupabase(currentUser);
  };

  const migrateLocalCatalogToCloud = async () => {
    return migrateCatalogToSupabaseServer(
      { domains, courses, promoCodes, coachingPrograms, testimonials, siteSettings },
      adminToken
    );
  };

  // Admin Operations (also sync seamlessly to Supabase when active)
  const syncCatalogBundle = (overrides?: Partial<{
    courses: Course[];
    domains: DomainCategory[];
    promoCodes: PromoCode[];
    coachingPrograms: CoachingProgramConfig[];
    testimonials: Testimonial[];
    siteSettings: SiteSettings;
  }>) => {
    if (!infraStatus?.supabase.serverConnected) return;
    migrateCatalogToSupabaseServer(
      {
        domains: overrides?.domains ?? domains,
        courses: overrides?.courses ?? courses,
        promoCodes: overrides?.promoCodes ?? promoCodes,
        coachingPrograms: overrides?.coachingPrograms ?? coachingPrograms,
        testimonials: overrides?.testimonials ?? testimonials,
        siteSettings: overrides?.siteSettings ?? siteSettings
      },
      adminToken
    ).catch((err) => console.warn('Cloud catalog auto-sync warning:', err));
  };

  const saveCourse = (updatedCourse: Course) => {
    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedCourse.id);
      let next: Course[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = updatedCourse;
      } else {
        pushNotification('all', 'Nouvelle formation disponible', updatedCourse.title, 'course');
        next = [...prev, updatedCourse];
      }
      syncCatalogBundle({ courses: next });
      return next;
    });
  };

  const deleteCourse = (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    dispatchAdminSync('delete_course', { courseId });
  };

  const saveDomain = (domain: DomainCategory) => {
    setDomains((prev) => {
      const idx = prev.findIndex((d) => d.id === domain.id);
      const next = idx >= 0 ? prev.map((d) => (d.id === domain.id ? domain : d)) : [...prev, domain];
      syncCatalogBundle({ domains: next });
      return next;
    });
  };

  const deleteDomain = (domainId: string) => {
    setDomains((prev) => prev.filter((d) => d.id !== domainId));
    dispatchAdminSync('delete_domain', { domainId });
  };

  const savePromoCode = (promo: PromoCode) => {
    setPromoCodes((prev) => {
      const idx = prev.findIndex((p) => p.id === promo.id);
      const next = idx >= 0 ? prev.map((p) => (p.id === promo.id ? promo : p)) : [...prev, promo];
      syncCatalogBundle({ promoCodes: next });
      return next;
    });
  };

  const deletePromoCode = (promoId: string) => {
    setPromoCodes((prev) => prev.filter((p) => p.id !== promoId));
    dispatchAdminSync('delete_promo', { promoId });
  };

  const saveCoachingProgram = (program: CoachingProgramConfig) => {
    setCoachingPrograms((prev) => {
      const next = prev.map((p) => (p.id === program.id ? program : p));
      syncCatalogBundle({ coachingPrograms: next });
      return next;
    });
  };

  const addTestimonial = (testimonial: Omit<Testimonial, 'id'>) => {
    setTestimonials((prev) => {
      const next = [{ ...testimonial, id: `test-${Date.now()}` }, ...prev];
      syncCatalogBundle({ testimonials: next });
      return next;
    });
  };

  const deleteTestimonial = (id: string) => {
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
    dispatchAdminSync('delete_testimonial', { id });
  };

  const updateSiteSettings = (settings: SiteSettings) => {
    setSiteSettings(settings);
    syncCatalogBundle({ siteSettings: settings });
  };

  const applyOrderAccessChange = (targetOrder: Order, status: Order['status'], updatedOrders: Order[]) => {
    const matchesStudent = (s: User) =>
      s.id === targetOrder.userId || s.email.toLowerCase() === targetOrder.userEmail.toLowerCase();

    if (status === 'confirmed') {
      setStudents((prev) =>
        prev.map((s) =>
          matchesStudent(s)
            ? { ...s, enrolledCourseIds: Array.from(new Set([...s.enrolledCourseIds, targetOrder.courseId])) }
            : s
        )
      );
      if (currentUser && matchesStudent(currentUser)) {
        setCurrentUser({
          ...currentUser,
          enrolledCourseIds: Array.from(new Set([...currentUser.enrolledCourseIds, targetOrder.courseId]))
        });
      }
      pushNotification(
        targetOrder.userId,
        'Accès formation activé',
        `Votre commande ${targetOrder.reference} a été confirmée. Vous pouvez accéder à « ${targetOrder.courseTitle} ».`,
        'purchase'
      );
    } else if (status === 'refunded' || status === 'cancelled' || status === 'failed') {
      const hasOtherConfirmed = updatedOrders.some(
        (o) =>
          o.id !== targetOrder.id &&
          o.status === 'confirmed' &&
          o.courseId === targetOrder.courseId &&
          (o.userId === targetOrder.userId || o.userEmail.toLowerCase() === targetOrder.userEmail.toLowerCase())
      );
      if (!hasOtherConfirmed) {
        setStudents((prev) =>
          prev.map((s) =>
            matchesStudent(s)
              ? { ...s, enrolledCourseIds: s.enrolledCourseIds.filter((id) => id !== targetOrder.courseId) }
              : s
          )
        );
        if (currentUser && matchesStudent(currentUser)) {
          setCurrentUser({
            ...currentUser,
            enrolledCourseIds: currentUser.enrolledCourseIds.filter((id) => id !== targetOrder.courseId)
          });
        }
      }
    }
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const updatedOrders = orders.map((o) =>
      o.id === orderId
        ? { ...o, status, confirmedAt: status === 'confirmed' && !o.confirmedAt ? new Date().toISOString() : o.confirmedAt }
        : o
    );
    setOrders(updatedOrders);
    if (!targetOrder) return;

    applyOrderAccessChange(targetOrder, status, updatedOrders);
    dispatchAdminSync('update_order_status', { reference: targetOrder.reference, status });
  };

  const refundOrderServer = async (orderId: string): Promise<{ ok: boolean; message?: string }> => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return { ok: false, message: 'Commande introuvable.' };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
    const supToken = await getSupabaseAccessToken();
    if (supToken) headers['X-Supabase-Token'] = supToken;

    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reference: targetOrder.reference,
          providerTransactionId: targetOrder.providerTransactionId
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { ok: false, message: data.error || 'Échec du remboursement serveur.' };
      }

      const updatedOrders = orders.map((o) => (o.id === orderId ? { ...o, status: 'refunded' as const } : o));
      setOrders(updatedOrders);
      applyOrderAccessChange(targetOrder, 'refunded', updatedOrders);
      return { ok: true, message: 'Commande remboursée et accès révoqué.' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur réseau lors du remboursement.'
      };
    }
  };

  const updateCoachingStatus = (
    id: string,
    status: CoachingRequest['status'],
    meetingLink?: string,
    adminNotes?: string
  ) => {
    const target = coachingRequests.find((r) => r.id === id);
    setCoachingRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              meetingLink: meetingLink !== undefined ? meetingLink : r.meetingLink,
              adminNotes: adminNotes !== undefined ? adminNotes : r.adminNotes
            }
          : r
      )
    );
    dispatchAdminSync('update_coaching_status', {
      id,
      status,
      meetingLink: meetingLink !== undefined ? meetingLink : target?.meetingLink,
      adminNotes: adminNotes !== undefined ? adminNotes : target?.adminNotes
    });
  };

  const updatePaymentConfig = (config: PaymentGatewayConfig) => {
    setPaymentConfig(config);
  };

  const grantManualCourseAccess = (userId: string, courseId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === userId ? { ...s, enrolledCourseIds: Array.from(new Set([...s.enrolledCourseIds, courseId])) } : s
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({
        ...currentUser,
        enrolledCourseIds: Array.from(new Set([...currentUser.enrolledCourseIds, courseId]))
      });
    }
    dispatchAdminSync('grant_access', { userId, courseId });
  };

  const revokeCourseAccess = (userId: string, courseId: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === userId ? { ...s, enrolledCourseIds: s.enrolledCourseIds.filter((id) => id !== courseId) } : s
      )
    );
    if (currentUser && currentUser.id === userId) {
      setCurrentUser({
        ...currentUser,
        enrolledCourseIds: currentUser.enrolledCourseIds.filter((id) => id !== courseId)
      });
    }
    dispatchAdminSync('revoke_access', { userId, courseId });
  };

  return (
    <AppContext.Provider
      value={{
        courses,
        domains,
        promoCodes,
        siteSettings,
        coachingPrograms,
        testimonials,
        students,
        notifications,
        currentUser,
        currency,
        language,
        orders,
        coachingRequests,
        contactMessages,
        paymentEvents,
        paymentConfig,
        infraStatus,
        adminToken,
        adminSessionExpiredNotice,
        supabaseReady: isSupabaseConfigured,
        paymentReturnNotice,
        activeView,
        selectedCourseId,
        activeLessonId,
        authModalOpen,
        authModalMode,
        navigateTo,
        setCurrency,
        setLanguage,
        formatPrice,
        openAuthModal,
        closeAuthModal,
        dismissPaymentReturnNotice,
        dismissAdminSessionExpiredNotice,
        invalidateExpiredAdminSession,
        loginAsDemoStudent,
        loginStudent,
        registerUser,
        signInWithEmailPassword,
        signUpWithEmailPassword,
        loginAdminServer,
        updateUserProfile,
        logout,
        isEnrolled,
        getCourseProgress,
        setLastAccessedLesson,
        toggleLessonComplete,
        submitExercise,
        submitQuizResult,
        claimCertificate,
        validatePromoCode,
        processPurchase,
        verifyExistingPayment,
        refreshServerPaymentStatus,
        submitCoachingRequest,
        submitContactMessage,
        updateContactMessageStatus,
        markNotificationRead,
        syncCurrentStudentToCloud,
        migrateLocalCatalogToCloud,
        refreshSupabaseAdminData,
        refreshAdminTelemetry,
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
        updatePaymentConfig,
        grantManualCourseAccess,
        revokeCourseAccess
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
