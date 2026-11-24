/**
 * DJIFFA ACADEMY - Static Brand & Course Asset Bundler
 * Ensures all local images in src/assets/images are properly fingerprinted and
 * bundled into dist/assets/ by Vite in production (Render) while remaining
 * backward-compatible with both legacy '/src/assets/images/...' strings and
 * previously fingerprinted Vite '/assets/<name>-<hash>.jpg' URLs stored in DB/localStorage.
 */

import heroFaithAriolaImg from '../assets/images/hero_faith_ariola_academy_1794341068588.jpg';
import courseMethodFaithImg from '../assets/images/course_method_faith_ariola_1794341070404.jpg';
import courseVirtualFashionImg from '../assets/images/course_virtual_fashion_ai_1794341069864.jpg';
import courseCinemaStoryImg from '../assets/images/course_cinema_storytelling_1794341071738.jpg';

export const BRAND_IMAGES = {
  faithPortrait: heroFaithAriolaImg,
  courseMethod: courseMethodFaithImg,
  courseFashion: courseVirtualFashionImg,
  courseCinema: courseCinemaStoryImg
} as const;

interface BrandAssetDescriptor {
  baseName: string;
  canonicalPath: string;
  bundledUrl: string;
}

const BRAND_ASSET_DESCRIPTORS: BrandAssetDescriptor[] = [
  {
    baseName: 'hero_faith_ariola_academy_1794341068588',
    canonicalPath: '/src/assets/images/hero_faith_ariola_academy_1794341068588.jpg',
    bundledUrl: heroFaithAriolaImg
  },
  {
    baseName: 'course_method_faith_ariola_1794341070404',
    canonicalPath: '/src/assets/images/course_method_faith_ariola_1794341070404.jpg',
    bundledUrl: courseMethodFaithImg
  },
  {
    baseName: 'course_virtual_fashion_ai_1794341069864',
    canonicalPath: '/src/assets/images/course_virtual_fashion_ai_1794341069864.jpg',
    bundledUrl: courseVirtualFashionImg
  },
  {
    baseName: 'course_cinema_storytelling_1794341071738',
    canonicalPath: '/src/assets/images/course_cinema_storytelling_1794341071738.jpg',
    bundledUrl: courseCinemaStoryImg
  }
];

function findBrandAssetDescriptor(src?: string | null): BrandAssetDescriptor | undefined {
  if (!src || !src.trim()) return undefined;
  const trimmed = src.trim();
  if (trimmed.startsWith('data:')) return undefined;

  const cleanPath = trimmed.split('#')[0].split('?')[0];
  const fileName = cleanPath.split('/').pop() || cleanPath;

  return BRAND_ASSET_DESCRIPTORS.find((desc) => {
    if (trimmed === desc.bundledUrl || cleanPath === desc.canonicalPath) return true;
    const escapedBase = desc.baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hashedOrPlainRegex = new RegExp(`^${escapedBase}(?:-[A-Za-z0-9_-]+)?\\.[a-z0-9]+$`, 'i');
    return hashedOrPlainRegex.test(fileName);
  });
}

export function resolveAssetImageUrl(src?: string | null, fallback: string = courseMethodFaithImg): string {
  if (!src || !src.trim()) return fallback;
  const matched = findBrandAssetDescriptor(src);
  if (matched) return matched.bundledUrl;
  return src.trim();
}

export function canonicalizeAssetImageForStorage(src?: string | null): string {
  if (!src || !src.trim()) return '';
  const matched = findBrandAssetDescriptor(src);
  if (matched) return matched.canonicalPath;
  return src.trim();
}
