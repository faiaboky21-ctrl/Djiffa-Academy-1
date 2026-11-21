/**
 * DJIFFA ACADEMY - Global Application Context & State Management
 * Persistent storage via localStorage + real backend verification hooks (/api/payments/*, /api/auth/*)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
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
  NotificationItem
} from '../types';
import {
  INITIAL_COURSES,
  INITIAL_DOMAINS,
  INITIAL_PROMO_CODES,
  INITIAL_SITE_SETTINGS,
  COACHING_PROGRAMS
} from '../data/coursesData';

export type AppView =
  | 'home'
  | 'catalog'
  | 'course-detail'
  | 'player'
  | 'student-space'
  | 'admin-space'
  | 'coaching'
  | 'about'
  | 'contact';

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
  paymentConfig: PaymentGatewayConfig;
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

  // Auth & Profile
  loginAsDemoStudent: () => void;
  loginStudent: (email: string) => { ok: boolean; message?: string };
  registerUser: (name: string, email: string, phone?: string, country?: string) => User;
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
    options?: { promoCode?: string; discountPercent?: number; isDemoMode?: boolean; transactionId?: string }
  ) => Promise<{ success: boolean; order: Order; message?: string }>;
  refreshServerPaymentStatus: () => Promise<void>;

  // Coaching
  submitCoachingRequest: (
    data: Omit<CoachingRequest, 'id' | 'createdAt' | 'status' | 'userId' | 'userName' | 'userEmail'> & {
      userName?: string;
      userEmail?: string;
    }
  ) => CoachingRequest;

  // Notifications
  markNotificationRead: (id: string) => void;

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
  updateCoachingStatus: (id: string, status: CoachingRequest['status'], meetingLink?: string) => void;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'student' | 'admin'>('student');

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
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
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

  // Strictly empty by default: only real testimonials added by Faith Ariola are displayed
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
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_DEMO_STUDENTS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('djiffa_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return null;
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('djiffa_orders');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_ORDERS;
  });

  const [coachingRequests, setCoachingRequests] = useState<CoachingRequest[]>(() => {
    const saved = localStorage.getItem('djiffa_coaching');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return INITIAL_COACHING;
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

  const [paymentConfig, setPaymentConfig] = useState<PaymentGatewayConfig>(DEFAULT_PAYMENT_CONFIG);

  const refreshServerPaymentStatus = async () => {
    try {
      const res = await fetch('/api/payments/status');
      if (res.ok) {
        const data = await res.json();
        setPaymentConfig((prev) => ({
          ...prev,
          activeProvider: data.provider || prev.activeProvider,
          isTestMode: data.mode !== 'live',
          serverConfigured: Boolean(data.configured),
          serverMessage: data.message || prev.serverMessage
        }));
      }
    } catch {
      setPaymentConfig((prev) => ({
        ...prev,
        serverConfigured: false,
        serverMessage: 'Paiement non configuré (serveur de paiement hors ligne ou clés absentes).'
      }));
    }
  };

  useEffect(() => {
    refreshServerPaymentStatus();
  }, []);

  // Persistence sync
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
  useEffect(() => { localStorage.setItem('djiffa_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('djiffa_user', JSON.stringify(currentUser));
      if (currentUser.role === 'student') {
        setStudents((prev) => {
          const exists = prev.some((s) => s.id === currentUser.id);
          return exists ? prev.map((s) => (s.id === currentUser.id ? currentUser : s)) : [currentUser, ...prev];
        });
      }
    } else {
      localStorage.removeItem('djiffa_user');
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

  const pushNotification = (userId: string | 'all', title: string, message: string, category: NotificationItem['category']) => {
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
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  // Auth Functions
  const loginAsDemoStudent = () => {
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
    const existing = students.find((s) => s.email.toLowerCase() === email.trim().toLowerCase());
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

  const updateUserProfile = (updates: Partial<Pick<User, 'name' | 'phone' | 'country'>>) => {
    if (!currentUser) return;
    setCurrentUser({
      ...currentUser,
      ...updates
    });
  };

  const logout = () => {
    setCurrentUser(null);
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
    setCurrentUser({
      ...currentUser,
      lastAccessedLessonByCourse: {
        ...(currentUser.lastAccessedLessonByCourse || {}),
        [courseId]: lessonId
      }
    });
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
        pushNotification(
          updatedUser.id,
          'Certificat débloqué !',
          `Vous avez complété 100% de « ${course.title} ». Votre certificat est disponible.`,
          'progress'
        );
      }
    }

    setCurrentUser(updatedUser);
  };

  const submitExercise = (lessonId: string, submissionText: string, link?: string) => {
    if (!currentUser) return;
    setCurrentUser({
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
    });
  };

  const submitQuizResult = (quizId: string, score: number, total: number) => {
    if (!currentUser) return;
    const passed = total > 0 && score / total >= 0.7;
    setCurrentUser({
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
    });
  };

  const claimCertificate = (courseId: string): UserCertificate | null => {
    if (!currentUser) return null;
    const existing = currentUser.certificates.find((c) => c.courseId === courseId);
    if (existing) return existing;

    const progress = getCourseProgress(courseId);
    if (progress.percentage < 100 && currentUser.role !== 'admin') return null;

    const course = courses.find((c) => c.id === courseId);
    if (!course) return null;

    const newCert: UserCertificate = {
      id: `cert-${Date.now()}`,
      courseId: course.id,
      courseTitle: course.title,
      issuedDate: new Date().toISOString().split('T')[0],
      studentName: currentUser.name,
      verificationCode: `DJIFFA-ACADEMY-${Math.floor(100000 + Math.random() * 900000)}`,
      directorName: 'Faith Ariola'
    };

    setCurrentUser({
      ...currentUser,
      certificates: [...currentUser.certificates, newCert]
    });
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
    options?: { promoCode?: string; discountPercent?: number; isDemoMode?: boolean; transactionId?: string }
  ): Promise<{ success: boolean; order: Order; message?: string }> => {
    const course = courses.find((c) => c.id === courseId);
    if (!course) throw new Error('Formation introuvable');
    if (!currentUser) throw new Error('Veuillez vous connecter ou créer un compte avant de finaliser l’achat.');

    const discountMultiplier = 1 - ((options?.discountPercent || 0) / 100);
    const baseAmount =
      currency === 'EUR' ? course.priceEUR : currency === 'USD' ? course.priceUSD : course.priceXOF;
    const finalAmount = Math.max(0, Math.round(baseAmount * discountMultiplier));

    const isDemo = options?.isDemoMode ?? !paymentConfig.serverConfigured;
    const orderRef = `${isDemo ? 'TEST' : 'DJF'}-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    let provider: Order['paymentProvider'] = 'FedaPay';
    if (paymentMethod === 'kkiapay' || paymentConfig.activeProvider === 'kkiapay') provider = 'KKiaPay';
    else if (paymentMethod === 'cinetpay' || paymentConfig.activeProvider === 'cinetpay') provider = 'CinetPay';
    else if (paymentMethod.startsWith('card') && !paymentConfig.serverConfigured) provider = 'Stripe/Cartes';

    // If real server payment is configured, attempt server-side session creation / verification
    if (!isDemo && paymentConfig.serverConfigured) {
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: orderRef, transactionId: options?.transactionId })
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        const failedOrder: Order = {
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
          isDemoTransaction: false,
          promoCodeUsed: options?.promoCode,
          customerPhone: phoneOrCard,
          createdAt: new Date().toISOString()
        };
        setOrders((prev) => [failedOrder, ...prev]);
        return {
          success: false,
          order: failedOrder,
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
      status: 'confirmed',
      isDemoTransaction: isDemo,
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

    pushNotification(
      currentUser.id,
      isDemo ? 'Accès Démo Débloqué' : 'Paiement Confirmé',
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
    pushNotification(
      user.id,
      'Demande d’accompagnement enregistrée',
      `Votre demande pour « ${data.programTitle} » est en attente de validation par Faith Ariola.`,
      'coaching'
    );
    return newReq;
  };

  // Admin Operations
  const saveCourse = (updatedCourse: Course) => {
    setCourses((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedCourse.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updatedCourse;
        return copy;
      }
      pushNotification('all', 'Nouvelle formation disponible', updatedCourse.title, 'course');
      return [...prev, updatedCourse];
    });
  };

  const deleteCourse = (courseId: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  const saveDomain = (domain: DomainCategory) => {
    setDomains((prev) => {
      const idx = prev.findIndex((d) => d.id === domain.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = domain;
        return copy;
      }
      return [...prev, domain];
    });
  };

  const deleteDomain = (domainId: string) => {
    setDomains((prev) => prev.filter((d) => d.id !== domainId));
  };

  const savePromoCode = (promo: PromoCode) => {
    setPromoCodes((prev) => {
      const idx = prev.findIndex((p) => p.id === promo.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = promo;
        return copy;
      }
      return [...prev, promo];
    });
  };

  const deletePromoCode = (promoId: string) => {
    setPromoCodes((prev) => prev.filter((p) => p.id !== promoId));
  };

  const saveCoachingProgram = (program: CoachingProgramConfig) => {
    setCoachingPrograms((prev) => prev.map((p) => (p.id === program.id ? program : p)));
  };

  const addTestimonial = (testimonial: Omit<Testimonial, 'id'>) => {
    setTestimonials((prev) => [{ ...testimonial, id: `test-${Date.now()}` }, ...prev]);
  };

  const deleteTestimonial = (id: string) => {
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
  };

  const updateSiteSettings = (settings: SiteSettings) => {
    setSiteSettings(settings);
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  };

  const updateCoachingStatus = (id: string, status: CoachingRequest['status'], meetingLink?: string) => {
    setCoachingRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, meetingLink: meetingLink !== undefined ? meetingLink : r.meetingLink } : r))
    );
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
        paymentConfig,
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
        loginAsDemoStudent,
        loginStudent,
        registerUser,
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
        refreshServerPaymentStatus,
        submitCoachingRequest,
        markNotificationRead,
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
