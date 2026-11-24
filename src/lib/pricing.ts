/**
 * DJIFFA ACADEMY - Pricing & Promotion Helpers
 * Ensures consistent pricing across catalog, course detail, checkout, and server validation.
 */

import { Course, Currency } from '../types';

export interface EffectiveCoursePricing {
  isPromo: boolean;
  activeXOF: number;
  activeEUR: number;
  activeUSD: number;
  crossedOutXOF?: number;
  discountPercent: number;
}

export function getCoursePricing(course: Course): EffectiveCoursePricing {
  const hasExplicitPromo =
    Boolean(course.promoActive) &&
    typeof course.promoPriceXOF === 'number' &&
    course.promoPriceXOF > 0 &&
    course.promoPriceXOF < course.priceXOF;

  if (hasExplicitPromo) {
    const activeXOF = course.promoPriceXOF!;
    const activeEUR =
      typeof course.promoPriceEUR === 'number' && course.promoPriceEUR > 0
        ? course.promoPriceEUR
        : Math.round(activeXOF / 655.957);
    const activeUSD =
      typeof course.promoPriceUSD === 'number' && course.promoPriceUSD > 0
        ? course.promoPriceUSD
        : Math.round(activeXOF / 600);

    return {
      isPromo: true,
      activeXOF,
      activeEUR,
      activeUSD,
      crossedOutXOF: course.priceXOF,
      discountPercent: Math.max(1, Math.round(((course.priceXOF - activeXOF) / course.priceXOF) * 100))
    };
  }

  const hasLegacyOriginal =
    typeof course.originalPriceXOF === 'number' && course.originalPriceXOF > course.priceXOF;

  return {
    isPromo: hasLegacyOriginal,
    activeXOF: course.priceXOF,
    activeEUR: course.priceEUR,
    activeUSD: course.priceUSD,
    crossedOutXOF: hasLegacyOriginal ? course.originalPriceXOF : undefined,
    discountPercent: hasLegacyOriginal
      ? Math.max(1, Math.round(((course.originalPriceXOF! - course.priceXOF) / course.originalPriceXOF!) * 100))
      : 0
  };
}

export function getCourseAmountInCurrency(course: Course, currency: Currency): number {
  const pricing = getCoursePricing(course);
  if (currency === 'EUR') return pricing.activeEUR;
  if (currency === 'USD') return pricing.activeUSD;
  return pricing.activeXOF;
}
