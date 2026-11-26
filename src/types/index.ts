/**
 * DJIFFA ACADEMY - Data Types & Models
 * Brand: DJIFFA ACADEMY | Parent: DJIFFA DESIGN AGENCY | Founder: Faith Ariola
 */

export type CourseDomain = string;

export interface DomainCategory {
  id: string;
  code: string;
  title: string;
  shortLabel: string;
  description: string;
  skills: string[];
  highlightCourseId?: string;
}

export type CourseLevel = 'Débutant' | 'Intermédiaire' | 'Avancé' | 'Tous niveaux';

export type Currency = 'XOF' | 'EUR' | 'USD';

export type Language = 'fr' | 'en';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Exercise {
  title: string;
  instructions: string;
  deliverable: string;
  criteria: string[];
  modelCorrection: string;
}

export interface ResourceDownload {
  name: string;
  type: 'PDF' | 'PROMPTS' | 'TEMPLATE' | 'ASSET' | 'AUDIO';
  size: string;
  description: string;
  url?: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  duration: string;
  type: 'video' | 'practical' | 'resource' | 'quiz';
  videoUrl?: string;
  videoThumbnail?: string;
  summary: string;
  contentHtml: string;
  keyTakeaways: string[];
  downloads?: ResourceDownload[];
  exercise?: Exercise;
  quiz?: QuizQuestion[];
}

export interface CourseModule {
  id: string;
  order: number;
  title: string;
  description: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  domain: CourseDomain;
  level: CourseLevel;
  duration: string;
  modulesCount: number;
  lessonsCount: number;
  priceXOF: number;
  priceEUR: number;
  priceUSD: number;
  originalPriceXOF?: number;
  promoActive?: boolean;
  promoPriceXOF?: number;
  promoPriceEUR?: number;
  promoPriceUSD?: number;
  coverImage: string;
  objectives: string[];
  skillsAcquired: string[];
  resourcesIncluded: string[];
  isFeatured: boolean;
  isPublished: boolean;
  accessCondition?: string;
  modules: CourseModule[];
  finalQuiz?: QuizQuestion[];
  certificateEligible: boolean;
}

export interface UserSubmittedExercise {
  submissionText: string;
  link?: string;
  submittedAt: string;
  status: 'submitted' | 'reviewed';
  feedback?: string;
  score?: number;
}

export interface UserCertificate {
  id: string;
  courseId: string;
  courseTitle: string;
  issuedDate: string;
  studentName: string;
  verificationCode: string;
  directorName: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin';
  phone?: string;
  country?: string;
  enrolledCourseIds: string[];
  completedLessonIds: string[];
  lastAccessedLessonByCourse?: Record<string, string>;
  submittedExercises: Record<string, UserSubmittedExercise>;
  quizScores: Record<string, { score: number; total: number; passed: boolean; completedAt: string }>;
  certificates: UserCertificate[];
  createdAt?: string;
}

export type PaymentMethod =
  | 'mtn_momo'
  | 'moov_momo'
  | 'card_visa'
  | 'card_mastercard'
  | 'kkiapay'
  | 'fedapay'
  | 'cinetpay';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export interface Order {
  id: string;
  reference: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  amount: number;
  currency: Currency;
  paymentMethod: PaymentMethod;
  paymentProvider: 'FedaPay' | 'KKiaPay' | 'CinetPay' | 'Stripe/Cartes';
  providerTransactionId?: string;
  status: PaymentStatus;
  isDemoTransaction?: boolean;
  promoCodeUsed?: string;
  customerPhone?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface CoachingProgramConfig {
  id: string;
  type: 'individual' | 'collective';
  title: string;
  subtitle: string;
  badge: string;
  priceXOF: number;
  priceEUR: number;
  priceUSD: number;
  duration: string;
  features: string[];
  targetAudience: string;
}

export interface CoachingRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  type: 'individual' | 'collective';
  programTitle: string;
  needDescription: string;
  preferredDate: string;
  status: 'pending' | 'validated' | 'scheduled' | 'completed' | 'cancelled';
  meetingLink?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  isActive: boolean;
  description?: string;
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string;
  courseTitle: string;
  quote: string;
  verifiedDate: string;
}

export interface NotificationItem {
  id: string;
  userId: string | 'all';
  title: string;
  message: string;
  category: 'purchase' | 'course' | 'progress' | 'coaching';
  read: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied';
  adminNotes?: string;
  createdAt: string;
}

export interface PaymentEventLog {
  id: string;
  reference: string;
  provider: string;
  mode?: 'sandbox' | 'live';
  event: string;
  status: string;
  detail: string;
  receivedAt: string;
}

export interface SiteSettings {
  agencyLogoDataUrl: string | null;
  academyName: string;
  parentAgencyName: string;
  directorName: string;
  academyPresentation: string;
  parentAgencyPresentation: string;
  directorBio: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  headquarters: string;
  supportHours: string;
  instagramUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  legalNotices: string;
  termsOfSale: string;
}

export interface PaymentGatewayConfig {
  activeProvider: 'fedapay' | 'kkiapay' | 'cinetpay';
  isTestMode: boolean;
  serverConfigured: boolean;
  serverMessage: string;
  momoBeninActive: boolean;
  cardsActive: boolean;
}
