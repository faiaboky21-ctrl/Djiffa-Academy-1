/**
 * DJIFFA ACADEMY - Video & Resource Media Utilities
 * Handles direct MP4/WebM streams, Supabase Storage private paths (via signed URLs),
 * and safe allowlisted embed URLs (Bunny Stream, Cloudflare Stream, Vimeo, YouTube).
 */

export type ResolvedVideoSource =
  | { kind: 'none' }
  | { kind: 'supabase_storage'; bucket: 'course-videos'; path: string }
  | { kind: 'iframe'; embedUrl: string; providerLabel: string }
  | { kind: 'video'; url: string };

const ALLOWED_EMBED_HOSTS = [
  'iframe.mediadelivery.net', // Bunny Stream
  'video.bunnycdn.com',
  'customer-', // Cloudflare Stream subdomains (*.cloudflarestream.com)
  'cloudflarestream.com',
  'videodelivery.net',
  'player.vimeo.com',
  'vimeo.com',
  'www.youtube.com',
  'youtube.com',
  'youtu.be'
];

export function resolveVideoSource(rawUrl?: string): ResolvedVideoSource {
  if (!rawUrl || !rawUrl.trim()) return { kind: 'none' };
  const trimmed = rawUrl.trim();

  // Supabase private storage path format: sb://course-videos/path/to/file.mp4
  if (trimmed.startsWith('sb://course-videos/')) {
    return {
      kind: 'supabase_storage',
      bucket: 'course-videos',
      path: trimmed.replace('sb://course-videos/', '')
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { kind: 'none' };
    }
    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\//, '');
      return { kind: 'iframe', embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0`, providerLabel: 'YouTube' };
    }
    if (host.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) {
        return { kind: 'iframe', embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(v)}?rel=0`, providerLabel: 'YouTube' };
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return { kind: 'iframe', embedUrl: trimmed, providerLabel: 'YouTube' };
      }
    }
    if (host === 'vimeo.com') {
      const id = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (/^\d+$/.test(id)) {
        return { kind: 'iframe', embedUrl: `https://player.vimeo.com/video/${id}`, providerLabel: 'Vimeo' };
      }
    }
    if (
      host.includes('mediadelivery.net') ||
      host.includes('cloudflarestream.com') ||
      host.includes('videodelivery.net') ||
      host === 'player.vimeo.com'
    ) {
      return {
        kind: 'iframe',
        embedUrl: trimmed,
        providerLabel: host.includes('mediadelivery') ? 'Bunny Stream' : host.includes('vimeo') ? 'Vimeo' : 'Cloudflare Stream'
      };
    }

    if (ALLOWED_EMBED_HOSTS.some((h) => host.includes(h)) && parsed.pathname.includes('embed')) {
      return { kind: 'iframe', embedUrl: trimmed, providerLabel: 'Lecteur Externe' };
    }

    return { kind: 'video', url: trimmed };
  } catch {
    return { kind: 'none' };
  }
}

export function isSupabaseStorageRef(url?: string): { bucket: 'course-pdfs' | 'course-videos'; path: string } | null {
  if (!url) return null;
  if (url.startsWith('sb://course-pdfs/')) {
    return { bucket: 'course-pdfs', path: url.replace('sb://course-pdfs/', '') };
  }
  if (url.startsWith('sb://course-videos/')) {
    return { bucket: 'course-videos', path: url.replace('sb://course-videos/', '') };
  }
  return null;
}

export async function fetchProtectedSignedMediaUrl(params: {
  bucket: 'course-pdfs' | 'course-videos';
  path: string;
  courseId: string;
  supabaseToken?: string | null;
  adminToken?: string | null;
}): Promise<{ ok: boolean; signedUrl?: string; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.supabaseToken) {
    headers['Authorization'] = `Bearer ${params.supabaseToken}`;
  } else if (params.adminToken) {
    headers['X-Admin-Token'] = params.adminToken;
  }

  const res = await fetch('/api/media/signed-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      bucket: params.bucket,
      path: params.path,
      courseId: params.courseId
    })
  });
  return res.json();
}

export function safeExternalUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

