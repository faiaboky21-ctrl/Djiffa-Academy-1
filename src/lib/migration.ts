/**
 * DJIFFA ACADEMY - Safe LocalStorage -> Supabase Cloud Migration Helpers
 * Preserves existing local data and pushes catalog, domains, settings, or student progress to Supabase.
 */

import {
  Course,
  DomainCategory,
  PromoCode,
  CoachingProgramConfig,
  Testimonial,
  SiteSettings,
  User,
  Order,
  CoachingRequest
} from '../types';
import { supabase, getSupabaseAccessToken } from './supabase';

export interface LocalMigrationBundle {
  domains: DomainCategory[];
  courses: Course[];
  promoCodes: PromoCode[];
  coachingPrograms: CoachingProgramConfig[];
  testimonials: Testimonial[];
  siteSettings: SiteSettings;
}

export interface FullBackupBundle extends LocalMigrationBundle {
  exportedAt: string;
  brand: string;
  students: User[];
  orders: Order[];
  coachingRequests: CoachingRequest[];
}

export interface BackupMeta {
  fileName: string;
  exportedAt: string;
  counts: {
    domains: number;
    courses: number;
    students: number;
    orders: number;
    coachingRequests: number;
  };
}

export const PRE_MIGRATION_BACKUP_KEY = 'djiffa_pre_migration_backup_meta';

export function loadStoredBackupMeta(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(PRE_MIGRATION_BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BackupMeta;
  } catch {
    return null;
  }
}

export function createPreMigrationBackup(payload: Omit<FullBackupBundle, 'exportedAt' | 'brand'>): BackupMeta {
  const now = new Date();
  const exportedAt = now.toISOString();
  const stamp = exportedAt.slice(0, 16).replace(/[:T]/g, '-');
  const fileName = `djiffa-academy-sauvegarde-${stamp}.json`;

  const fullBundle: FullBackupBundle = {
    brand: 'DJIFFA ACADEMY — DJIFFA DESIGN AGENCY (Faith Ariola)',
    exportedAt,
    ...payload
  };

  const jsonContent = JSON.stringify(fullBundle, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const meta: BackupMeta = {
    fileName,
    exportedAt,
    counts: {
      domains: payload.domains.length,
      courses: payload.courses.length,
      students: payload.students.length,
      orders: payload.orders.length,
      coachingRequests: payload.coachingRequests.length
    }
  };
  try {
    localStorage.setItem(PRE_MIGRATION_BACKUP_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage quota errors
  }
  return meta;
}

export async function migrateCatalogToSupabaseServer(
  bundle: LocalMigrationBundle,
  adminToken: string | null
): Promise<{ ok: boolean; message: string; counts?: Record<string, number> }> {
  const supabaseToken = await getSupabaseAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  if (supabaseToken) headers['X-Supabase-Token'] = supabaseToken;

  const res = await fetch('/api/supabase/migrate', {
    method: 'POST',
    headers,
    body: JSON.stringify(bundle)
  });

  return res.json();
}

export async function migrateStudentProgressToSupabase(user: User): Promise<{ ok: boolean; message: string }> {
  if (!supabase) {
    return { ok: false, message: 'Supabase non configuré côté navigateur.' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const authUid = sessionData.session?.user?.id;
  if (!authUid) {
    return { ok: false, message: 'Connectez-vous d’abord à votre compte Supabase pour synchroniser votre progression.' };
  }

  try {
    // Sync profile metadata (never sends role)
    await supabase
      .from('profiles')
      .update({
        name: user.name,
        phone: user.phone || null,
        country: user.country || 'Bénin',
        updated_at: new Date().toISOString()
      })
      .eq('id', authUid);

    // Sync per-course lesson progress (safe under RLS where user_id = auth.uid())
    const courseIds = Array.from(
      new Set([
        ...user.enrolledCourseIds,
        ...Object.keys(user.lastAccessedLessonByCourse || {})
      ])
    );

    for (const courseId of courseIds) {
      await supabase.from('lesson_progress').upsert(
        {
          user_id: authUid,
          course_id: courseId,
          completed_lesson_ids: user.completedLessonIds,
          last_accessed_lesson_id: user.lastAccessedLessonByCourse?.[courseId] || null,
          submitted_exercises: user.submittedExercises,
          quiz_scores: user.quizScores,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,course_id' }
      );
    }

    return { ok: true, message: 'Votre profil et votre progression locale ont été synchronisés dans le cloud.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Erreur lors de la synchronisation.'
    };
  }
}
