/**
 * DJIFFA ACADEMY - Internationalization (i18n) Architecture
 * Interface en français par défaut, extensible vers d'autres langues (EN, etc.)
 */

import { Language } from '../types';

export const TRANSLATIONS: Record<Language, {
  nav: {
    courses: string;
    method: string;
    coaching: string;
    about: string;
    contact: string;
    studentSpace: string;
    adminSpace: string;
    signIn: string;
  };
  hero: {
    badge: string;
    titlePrefix: string;
    titleAccent: string;
    titleSuffix: string;
    subtitle: string;
    ctaCourses: string;
    ctaCoaching: string;
    ctaMethod: string;
  };
  catalog: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allCourses: string;
    buyCourse: string;
    discoverCourse: string;
  };
}> = {
  fr: {
    nav: {
      courses: 'Formations',
      method: 'La Méthode',
      coaching: 'Accompagnement',
      about: 'À Propos',
      contact: 'Contact',
      studentSpace: 'Mon Espace',
      adminSpace: 'Administration',
      signIn: 'Connexion / Compte'
    },
    hero: {
      badge: 'DJIFFA DESIGN AGENCY',
      titlePrefix: 'L’École Internationale pour Maîtriser l’',
      titleAccent: 'IA Créative',
      titleSuffix: '& le Business Digital',
      subtitle:
        'DJIFFA ACADEMY forme les créateurs, entrepreneurs et professionnels en Afrique et à l’international. Transformez des concepts audacieux en spots publicitaires cinématographiques, collections de mode virtuelles et opportunités professionnelles hautement rémunératrices.',
      ctaCourses: 'Découvrir les formations',
      ctaCoaching: 'Être accompagné',
      ctaMethod: 'Voir la Méthode Faith Ariola'
    },
    catalog: {
      title: 'Formations Professionnelles Certifiantes',
      subtitle:
        'Chaque formation est accessible individuellement sans abonnement obligatoire. Apprenez à votre rythme avec des projets réels et obtenez une certification internationale.',
      searchPlaceholder: 'Rechercher par mot-clé, outil ou compétence...',
      allCourses: 'Toutes les formations',
      buyCourse: 'Acheter cette formation',
      discoverCourse: 'Découvrir la formation'
    }
  },
  en: {
    nav: {
      courses: 'Courses',
      method: 'The Method',
      coaching: 'Coaching',
      about: 'About',
      contact: 'Contact',
      studentSpace: 'Student Portal',
      adminSpace: 'Admin Panel',
      signIn: 'Sign In / Join'
    },
    hero: {
      badge: 'DJIFFA DESIGN AGENCY',
      titlePrefix: 'The International School for ',
      titleAccent: 'Creative AI',
      titleSuffix: '& Digital Business',
      subtitle:
        'DJIFFA ACADEMY trains creators, entrepreneurs, and professionals across Africa and worldwide. Turn bold ideas into cinematic ad spots, virtual fashion collections, and profitable creative ventures.',
      ctaCourses: 'Explore Courses',
      ctaCoaching: 'Get Mentorship',
      ctaMethod: 'Discover The Faith Ariola Method'
    },
    catalog: {
      title: 'Certified Professional Programs',
      subtitle:
        'Every course can be purchased individually with zero mandatory subscription. Learn at your own pace with real projects and earn an official certificate.',
      searchPlaceholder: 'Search by keyword, tool, or skill...',
      allCourses: 'All Courses',
      buyCourse: 'Buy This Course',
      discoverCourse: 'Discover Course'
    }
  }
};
