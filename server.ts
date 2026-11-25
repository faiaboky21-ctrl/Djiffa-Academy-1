/**
 * DJIFFA ACADEMY - Production-Ready Express Server
 * Handles:
 *  - Secure FedaPay / KKiaPay / CinetPay payment sessions, verification & HMAC webhooks
 *  - Admin authentication & HMAC Bearer session tokens
 *  - Supabase Admin (service_role) integration, enrollment enforcement, signed media URLs & migration
 *  - Vite dev middleware in development & static SPA serving in production
 */

import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Ephemeral in-memory fallback if ADMIN_SESSION_SECRET isn't provided in env
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// Idempotency stores for verified payment references & processed webhook events
const processedTransactions = new Map<string, { status: string; verifiedAt: string; provider: string }>();
const processedWebhookEvents = new Set<string>();

function rememberWebhookEvent(key: string) {
  if (processedWebhookEvents.size >= 1000) {
    const oldest = processedWebhookEvents.values().next().value;
    if (oldest) processedWebhookEvents.delete(oldest);
  }
  processedWebhookEvents.add(key);
}

interface ServerPaymentEvent {
  id: string;
  reference: string;
  provider: string;
  event: string;
  status: string;
  detail: string;
  receivedAt: string;
}

interface ServerContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  adminNotes?: string;
  createdAt: string;
}

const recentPaymentEvents: ServerPaymentEvent[] = [];
const recentContactMessages: ServerContactMessage[] = [];

function recordPaymentEvent(entry: Omit<ServerPaymentEvent, 'id' | 'receivedAt'>) {
  recentPaymentEvents.unshift({
    id: `pevt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...entry,
    receivedAt: new Date().toISOString()
  });
  if (recentPaymentEvents.length > 50) recentPaymentEvents.length = 50;
}

// Server-side Supabase Admin client (NEVER exposed to browser)
const stripEnvQuotes = (v: string | undefined) => (v || '').trim().replace(/^["']|["']$/g, '').trim();
const supabaseUrl = stripEnvQuotes(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const supabaseServiceKey = stripEnvQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY);
const isValidSupabaseUrl = /^https?:\/\/[^/\s]+/i.test(supabaseUrl);

let supabaseAdminInitError: string | null = null;
let supabaseAdminClient: SupabaseClient | null = null;
if (supabaseUrl && supabaseServiceKey) {
  if (!isValidSupabaseUrl) {
    supabaseAdminInitError =
      'Format de SUPABASE_URL invalide (doit commencer par https:// et contenir votre domaine .supabase.co).';
  } else {
    try {
      supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch (err) {
      supabaseAdminInitError = err instanceof Error ? err.message : 'Erreur d’initialisation Supabase serveur.';
    }
  }
}
const supabaseAdmin: SupabaseClient | null = supabaseAdminClient;

type KeyEnvKind = 'sandbox' | 'live' | 'mixed' | 'unknown' | 'unset';

function inspectFedaPayKeys(
  pubRaw: string,
  secRaw: string,
  mode: 'sandbox' | 'live'
): { keyEnvironment: KeyEnvKind; keyModeAligned: boolean } {
  const pub = pubRaw.trim();
  const sec = secRaw.trim();
  if (!pub && !sec) {
    return { keyEnvironment: 'unset', keyModeAligned: true };
  }
  const pubIsSandbox = pub.startsWith('pk_sandbox_');
  const pubIsLive = pub.startsWith('pk_live_');
  const secIsSandbox = sec.startsWith('sk_sandbox_');
  const secIsLive = sec.startsWith('sk_live_');

  const hasSandbox = pubIsSandbox || secIsSandbox;
  const hasLive = pubIsLive || secIsLive;

  if (hasSandbox && hasLive) {
    return { keyEnvironment: 'mixed', keyModeAligned: false };
  }
  if (hasSandbox) {
    return { keyEnvironment: 'sandbox', keyModeAligned: mode === 'sandbox' };
  }
  if (hasLive) {
    return { keyEnvironment: 'live', keyModeAligned: mode === 'live' };
  }
  return { keyEnvironment: 'unknown', keyModeAligned: true };
}

interface PaymentStatusInfo {
  configured: boolean;
  provider: 'fedapay' | 'kkiapay' | 'cinetpay';
  mode: 'sandbox' | 'live';
  publicKey: string | null;
  siteId: string | null;
  supportedMethods: string[];
  keyEnvironment?: KeyEnvKind;
  keyModeAligned?: boolean;
  message: string;
}

function getServerPaymentStatus(): PaymentStatusInfo {
  const providerEnv = (process.env.PAYMENT_PROVIDER || 'fedapay').trim().toLowerCase();
  const provider: 'fedapay' | 'kkiapay' | 'cinetpay' =
    providerEnv === 'kkiapay' ? 'kkiapay' : providerEnv === 'cinetpay' ? 'cinetpay' : 'fedapay';
  const mode: 'sandbox' | 'live' =
    (process.env.PAYMENT_MODE || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';

  if (provider === 'fedapay') {
    const pub = (process.env.FEDAPAY_PUBLIC_KEY || '').trim();
    const sec = (process.env.FEDAPAY_SECRET_KEY || '').trim();
    const configured = Boolean(pub && sec);
    const { keyEnvironment, keyModeAligned } = inspectFedaPayKeys(pub, sec, mode);
    const mismatchMsg =
      configured && !keyModeAligned
        ? `Incohérence FedaPay : PAYMENT_MODE=${mode}, mais les clés configurées sont de type ${keyEnvironment.toUpperCase()}.`
        : null;
    return {
      configured,
      provider: 'fedapay',
      mode,
      publicKey: pub || null,
      siteId: null,
      supportedMethods: ['MTN Mobile Money', 'Moov Money', 'Visa', 'Mastercard'],
      keyEnvironment,
      keyModeAligned,
      message:
        mismatchMsg ||
        (configured
          ? `Passerelle FedaPay connectée (${mode === 'live' ? 'Production' : 'Sandbox'}).`
          : 'Paiement non configuré côté serveur (clés FEDAPAY_PUBLIC_KEY / FEDAPAY_SECRET_KEY absentes).')
    };
  }

  if (provider === 'kkiapay') {
    const pub = process.env.KKIAPAY_PUBLIC_KEY || '';
    const priv = process.env.KKIAPAY_PRIVATE_KEY || '';
    const sec = process.env.KKIAPAY_SECRET || '';
    const configured = Boolean(pub && priv && sec);
    return {
      configured,
      provider: 'kkiapay',
      mode,
      publicKey: pub || null,
      siteId: null,
      supportedMethods: ['MTN Mobile Money', 'Moov Money', 'Visa', 'Mastercard'],
      message: configured
        ? `Passerelle KKiaPay connectée (${mode === 'live' ? 'Production' : 'Sandbox'}).`
        : 'Paiement non configuré côté serveur (clés KKIAPAY_* absentes).'
    };
  }

  const cinetKey = process.env.CINETPAY_API_KEY || '';
  const cinetSite = process.env.CINETPAY_SITE_ID || '';
  const configured = Boolean(cinetKey && cinetSite);
  return {
    configured,
    provider: 'cinetpay',
    mode,
    publicKey: null,
    siteId: cinetSite || null,
    supportedMethods: ['MTN Mobile Money', 'Moov Money', 'Orange Money', 'Wave', 'Visa', 'Mastercard'],
    message: configured
      ? `Passerelle CinetPay connectée (${mode === 'live' ? 'Production' : 'Sandbox'}).`
      : 'Paiement non configuré côté serveur (CINETPAY_API_KEY / CINETPAY_SITE_ID absents).'
  };
}

function issueAdminToken(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'usr-admin-faith',
      email,
      role: 'admin',
      exp: Date.now() + 1000 * 60 * 60 * 12 // 12 hours
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string | undefined | null): { email: string; role: 'admin' } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: string;
      role?: string;
      exp?: number;
    };
    if (parsed.role !== 'admin' || !parsed.exp || parsed.exp < Date.now() || !parsed.email) {
      return null;
    }
    return { email: parsed.email, role: 'admin' };
  } catch {
    return null;
  }
}

async function resolveCallerAuth(req: express.Request): Promise<{
  isAdmin: boolean;
  userId: string | null;
  email: string | null;
}> {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const altAdminToken = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'] : undefined;
  const supabaseHeader = typeof req.headers['x-supabase-token'] === 'string' ? req.headers['x-supabase-token'] : undefined;

  const adminClaim = verifyAdminToken(bearer) || verifyAdminToken(altAdminToken);
  if (adminClaim) {
    return { isAdmin: true, userId: 'usr-admin-faith', email: adminClaim.email };
  }

  const jwt = supabaseHeader || bearer;
  if (jwt && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.auth.getUser(jwt);
      if (!error && data.user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role, email')
          .eq('id', data.user.id)
          .single();
        return {
          isAdmin: profile?.role === 'admin',
          userId: data.user.id,
          email: profile?.email || data.user.email || null
        };
      }
    } catch {
      return { isAdmin: false, userId: null, email: null };
    }
  }

  return { isAdmin: false, userId: null, email: null };
}

async function activateOrderEnrollmentInSupabase(reference: string, providerTransactionId?: string) {
  if (!supabaseAdmin) return { ok: false, skipped: true };
  const { data: orderRow, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (fetchErr || !orderRow) return { ok: false, error: fetchErr?.message || 'Commande introuvable.' };
  if (orderRow.status === 'refunded') {
    return { ok: false, error: 'Commande déjà remboursée.' };
  }

  let targetUserId: string | null = orderRow.user_id || null;
  if (!targetUserId && orderRow.user_email) {
    const { data: matchedProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .ilike('email', String(orderRow.user_email).trim())
      .maybeSingle();
    if (matchedProfile?.id) {
      targetUserId = matchedProfile.id;
    }
  }

  const nextTxId = providerTransactionId || orderRow.provider_transaction_id || null;
  const alreadyConfirmed = orderRow.status === 'confirmed';

  const { error: updateErr } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'confirmed',
      user_id: targetUserId,
      provider_transaction_id: nextTxId,
      confirmed_at: orderRow.confirmed_at || new Date().toISOString()
    })
    .eq('reference', reference);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  if (targetUserId && orderRow.course_id) {
    const { error: enrollErr } = await supabaseAdmin.from('enrollments').upsert(
      {
        user_id: targetUserId,
        course_id: orderRow.course_id,
        granted_by: `payment:${orderRow.payment_provider}`
      },
      { onConflict: 'user_id,course_id' }
    );
    if (enrollErr) {
      return { ok: false, error: enrollErr.message };
    }
  }

  return { ok: true, alreadyConfirmed };
}

async function syncNonConfirmedOrderStatusInSupabase(
  reference: string,
  newStatus: 'pending' | 'processing' | 'failed' | 'cancelled',
  providerTransactionId?: string
): Promise<{ found: boolean; alreadyInState: boolean; lockedStatus?: string }> {
  if (!supabaseAdmin) return { found: false, alreadyInState: false };
  const { data: orderRow, error: fetchErr } = await supabaseAdmin
    .from('orders')
    .select('status, provider_transaction_id')
    .eq('reference', reference)
    .maybeSingle();

  if (fetchErr || !orderRow) return { found: false, alreadyInState: false };

  // Never downgrade a confirmed or refunded order via delayed/out-of-order pending or failure signals
  if (orderRow.status === 'confirmed' || orderRow.status === 'refunded') {
    return { found: true, alreadyInState: true, lockedStatus: orderRow.status };
  }

  const txIdUnchanged = !providerTransactionId || orderRow.provider_transaction_id === providerTransactionId;
  if (orderRow.status === newStatus && txIdUnchanged) {
    return { found: true, alreadyInState: true };
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (providerTransactionId && !orderRow.provider_transaction_id) {
    updatePayload.provider_transaction_id = providerTransactionId;
  }

  await supabaseAdmin.from('orders').update(updatePayload).eq('reference', reference);
  return { found: true, alreadyInState: false };
}

async function revokeOrderEnrollmentInSupabase(
  reference: string,
  newStatus: 'refunded' | 'cancelled' | 'failed',
  providerTransactionId?: string
) {
  if (!supabaseAdmin) return { found: false, alreadyInState: false };
  const { data: orderRow } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!orderRow) return { found: false, alreadyInState: false };

  const alreadyInState =
    orderRow.status === newStatus &&
    (!providerTransactionId || orderRow.provider_transaction_id === providerTransactionId);

  await supabaseAdmin
    .from('orders')
    .update({
      status: newStatus,
      ...(providerTransactionId && !orderRow.provider_transaction_id
        ? { provider_transaction_id: providerTransactionId }
        : {})
    })
    .eq('reference', reference);

  if (orderRow.user_id && orderRow.course_id) {
    const { data: otherConfirmed } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('user_id', orderRow.user_id)
      .eq('course_id', orderRow.course_id)
      .eq('status', 'confirmed')
      .neq('reference', reference)
      .limit(1);

    if (!otherConfirmed || otherConfirmed.length === 0) {
      await supabaseAdmin
        .from('enrollments')
        .delete()
        .eq('user_id', orderRow.user_id)
        .eq('course_id', orderRow.course_id);
    }
  }

  return { found: true, alreadyInState };
}

const FEDAPAY_COUNTRY_BY_DIAL: Array<{ dial: string; country: string }> = [
  { dial: '229', country: 'bj' },
  { dial: '225', country: 'ci' },
  { dial: '228', country: 'tg' },
  { dial: '221', country: 'sn' },
  { dial: '226', country: 'bf' },
  { dial: '223', country: 'ml' },
  { dial: '227', country: 'ne' },
  { dial: '224', country: 'gn' },
  { dial: '233', country: 'gh' },
  { dial: '234', country: 'ng' },
  { dial: '33', country: 'fr' }
];

function normalizeFedaPayPhoneNumber(rawPhone?: string | null): { number: string; country: string } | undefined {
  const input = String(rawPhone || '').trim();
  if (!input) return undefined;

  let compact = input.replace(/[\s().-]+/g, '');
  if (compact.startsWith('00')) {
    compact = `+${compact.slice(2)}`;
  }

  const hasPlus = compact.startsWith('+');
  let digitsOnly = compact.replace(/\D/g, '');
  if (digitsOnly.length < 8) return undefined;

  // Guard against duplicate Benin country prefix (+229 229 ..., 229229...)
  while (digitsOnly.startsWith('229229')) {
    const afterDouble = digitsOnly.slice(6);
    if (
      afterDouble.length === 8 ||
      (afterDouble.length === 10 && afterDouble.startsWith('01')) ||
      afterDouble.startsWith('229')
    ) {
      digitsOnly = `229${afterDouble}`;
    } else {
      break;
    }
  }

  if (hasPlus) {
    const matched = FEDAPAY_COUNTRY_BY_DIAL.find((entry) => digitsOnly.startsWith(entry.dial));
    if (matched) {
      const localPart = digitsOnly.slice(matched.dial.length);
      if (matched.dial === '229') {
        if (localPart.length === 8 || (localPart.length === 10 && localPart.startsWith('01'))) {
          return { number: `+229${localPart}`, country: 'bj' };
        }
        return undefined;
      }
      if (localPart.length >= 8) {
        return { number: `+${digitsOnly}`, country: matched.country };
      }
      return undefined;
    }
    return { number: `+${digitsOnly}`, country: 'bj' };
  }

  // Handle Benin numbers entered without '+' (229XXXXXXXX, 22901XXXXXXXX, 01XXXXXXXX, XXXXXXXX)
  if (digitsOnly.startsWith('229')) {
    const localPart = digitsOnly.slice(3);
    if (localPart.length === 8 || (localPart.length === 10 && localPart.startsWith('01'))) {
      return { number: `+229${localPart}`, country: 'bj' };
    }
    return undefined;
  }

  if (digitsOnly.length === 10 && digitsOnly.startsWith('01')) {
    return { number: `+229${digitsOnly}`, country: 'bj' };
  }

  if (digitsOnly.length === 8) {
    return { number: `+229${digitsOnly}`, country: 'bj' };
  }

  const matched = FEDAPAY_COUNTRY_BY_DIAL.find((entry) => digitsOnly.startsWith(entry.dial));
  if (matched && digitsOnly.length > matched.dial.length + 7) {
    return { number: `+${digitsOnly}`, country: matched.country };
  }

  return undefined;
}

function extractFedaPayApiError(rawBody: string, fallback: string): string {
  const trimmed = rawBody.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as {
      message?: string;
      errors?: Record<string, string[] | string | Record<string, unknown>>;
    };
    const parts: string[] = [];
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      parts.push(parsed.message.trim());
    }
    if (parsed.errors && typeof parsed.errors === 'object') {
      for (const [field, val] of Object.entries(parsed.errors)) {
        const msg = Array.isArray(val)
          ? val.join(', ')
          : val && typeof val === 'object'
          ? JSON.stringify(val)
          : String(val || '');
        if (msg.trim()) parts.push(`${field}: ${msg.trim()}`);
      }
    }
    return parts.length > 0 ? parts.join(' — ') : fallback;
  } catch {
    return trimmed.slice(0, 220) || fallback;
  }
}

interface FedaPayTransactionPayload {
  id?: number | string;
  reference?: string;
  status?: string;
  mode?: string;
  payment_method?: string;
  amount?: number | string;
  currency?: { iso?: string };
  custom_metadata?: { reference?: string };
  last_error?: {
    message?: string;
    code?: string;
    errors?: Record<string, string[] | string | Record<string, unknown>>;
  } | string;
  last_error_code?: string;
  last_error_message?: string;
  status_reason?: string;
  failure_reason?: string;
  reason?: string;
  errors?: Record<string, string[] | string | Record<string, unknown>>;
}

type FedaPayFetchResult =
  | { ok: true; tx: FedaPayTransactionPayload }
  | { ok: false; temporary: boolean; httpStatus?: number; error: string };

async function fetchFedaPayTransaction(transactionId: string, mode: 'sandbox' | 'live'): Promise<FedaPayFetchResult> {
  const baseUrl = mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
  try {
    const response = await fetch(`${baseUrl}/transactions/${encodeURIComponent(transactionId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      const rawErr = await response.text().catch(() => '');
      const errMsg = extractFedaPayApiError(rawErr, `Réponse API FedaPay HTTP ${response.status}`);
      return {
        ok: false,
        temporary: response.status >= 500 || response.status === 429 || response.status === 408,
        httpStatus: response.status,
        error: errMsg
      };
    }
    const data = (await response.json()) as { 'v1/transaction'?: FedaPayTransactionPayload };
    if (!data || !data['v1/transaction']) {
      return { ok: false, temporary: true, error: 'Réponse FedaPay incomplète (v1/transaction absent).' };
    }
    return { ok: true, tx: data['v1/transaction'] };
  } catch (err) {
    return {
      ok: false,
      temporary: true,
      error: err instanceof Error ? err.message : 'Erreur réseau temporaire lors de la vérification FedaPay.'
    };
  }
}

function appendStructuredErrors(
  parts: string[],
  errorsObj?: Record<string, string[] | string | Record<string, unknown>>
): void {
  if (!errorsObj || typeof errorsObj !== 'object') return;
  for (const [field, val] of Object.entries(errorsObj)) {
    const msg = Array.isArray(val)
      ? val.join(', ')
      : val && typeof val === 'object'
      ? JSON.stringify(val)
      : String(val || '');
    const formatted = msg.trim() ? `${field}: ${msg.trim()}` : '';
    if (formatted && !parts.includes(formatted)) {
      parts.push(formatted);
    }
  }
}

function extractFedaPayFailureReason(tx: FedaPayTransactionPayload): string | undefined {
  const parts: string[] = [];
  const pushUnique = (value?: string) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (trimmed && !parts.includes(trimmed)) {
      parts.push(trimmed);
    }
  };

  pushUnique(tx.status_reason);
  pushUnique(tx.failure_reason);
  pushUnique(tx.reason);
  pushUnique(tx.last_error_message);

  if (typeof tx.last_error === 'string') {
    pushUnique(tx.last_error);
  } else if (tx.last_error && typeof tx.last_error === 'object') {
    pushUnique(tx.last_error.message);
    if (typeof tx.last_error.code === 'string' && tx.last_error.code.trim()) {
      pushUnique(`code: ${tx.last_error.code.trim()}`);
    }
    appendStructuredErrors(parts, tx.last_error.errors);
  }
  if (typeof tx.last_error_code === 'string' && tx.last_error_code.trim()) {
    pushUnique(`code: ${tx.last_error_code.trim()}`);
  }
  appendStructuredErrors(parts, tx.errors);

  if (parts.length === 0) return undefined;
  return parts.join(' — ');
}

function sanitizeStorageObjectPath(rawPath: string): string | null {
  const normalized = rawPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
    return null;
  }
  return normalized;
}

function safeConstantTimeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

const CANONICAL_BRAND_ASSETS = [
  'hero_faith_ariola_academy_1794341068588',
  'course_method_faith_ariola_1794341070404',
  'course_virtual_fashion_ai_1794341069864',
  'course_cinema_storytelling_1794341071738'
];

function canonicalizeBrandImageForStorage(rawPath: string | undefined | null): string {
  const trimmed = String(rawPath || '').trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;
  const fileName = trimmed.split('#')[0].split('?')[0].split('/').pop() || '';
  for (const base of CANONICAL_BRAND_ASSETS) {
    const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${escaped}(?:-[A-Za-z0-9_-]+)?\\.[a-z0-9]+$`, 'i').test(fileName)) {
      return `/src/assets/images/${base}.jpg`;
    }
  }
  return trimmed;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // Preserve raw body for webhook HMAC signature verification
  app.use(
    express.json({
      limit: '5mb',
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  // 1. Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'djiffa-academy', timestamp: new Date().toISOString() });
  });

  // 2. Payment gateway readiness (never leaks secret keys)
  app.get('/api/payments/status', (_req, res) => {
    res.json(getServerPaymentStatus());
  });

  // 3. Unified Infrastructure Readiness (Supabase + Payments + Media + Security)
  app.get('/api/infrastructure/status', (_req, res) => {
    const payment = getServerPaymentStatus();
    const expectedAdminEmail = (process.env.ADMIN_EMAIL || 'faith.ariola@djiffa-agency.com').toLowerCase();
    const customAdminPass = Boolean(process.env.ADMIN_ACCESS_CODE);
    const hasPublicSupabase = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY);

    res.json({
      supabase: {
        configured: Boolean(supabaseAdmin && hasPublicSupabase),
        serverConnected: Boolean(supabaseAdmin),
        browserConfigured: hasPublicSupabase,
        storageBuckets: ['brand-assets', 'course-pdfs', 'course-videos']
      },
      payment: {
        ...payment,
        webhookPath: '/api/payments/webhook'
      },
      adminSecurity: {
        email: expectedAdminEmail,
        customCodeConfigured: customAdminPass,
        isProductionMode: isProduction
      },
      environment: isProduction ? 'production' : 'development'
    });
  });

  // 3b. Public Contact Form Submission (persisted server-side & in Supabase contact_messages when available)
  app.post('/api/public/contact', async (req, res) => {
    const { name, email, phone, subject, message } = req.body || {};
    const cleanName = String(name || '').trim().slice(0, 120);
    const cleanEmail = String(email || '').trim().slice(0, 160);
    const cleanPhone = phone ? String(phone).trim().slice(0, 40) : undefined;
    const cleanSubject = String(subject || 'Demande générale').trim().slice(0, 160);
    const cleanMessage = String(message || '').trim().slice(0, 4000);

    if (!cleanName || !cleanEmail || !cleanMessage) {
      res.status(400).json({ ok: false, error: 'Nom, email et message sont obligatoires.' });
      return;
    }

    const item: ServerContactMessage = {
      id: `msg-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'new',
      createdAt: new Date().toISOString()
    };

    recentContactMessages.unshift(item);
    if (recentContactMessages.length > 100) recentContactMessages.length = 100;

    if (supabaseAdmin) {
      await supabaseAdmin
        .from('contact_messages')
        .insert({
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone || null,
          subject: item.subject,
          message: item.message,
          status: 'new',
          created_at: item.createdAt
        })
        .then(() => undefined, () => undefined);
    }

    res.json({ ok: true, item });
  });

  // 3c. Public Coaching / Mentorship Request Submission (persists server-side to Supabase when active)
  app.post('/api/public/coaching-request', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    const {
      userId,
      userName,
      userEmail,
      userPhone,
      type,
      programTitle,
      needDescription,
      preferredDate
    } = req.body || {};

    const cleanName = String(userName || '').trim().slice(0, 120);
    const cleanEmail = String(userEmail || '').trim().slice(0, 160);
    const cleanPhone = String(userPhone || '').trim().slice(0, 40);
    const cleanNeed = String(needDescription || '').trim().slice(0, 4000);
    const cleanDate = String(preferredDate || '').trim().slice(0, 32);

    if (!cleanName || !cleanEmail || !cleanNeed || !cleanDate) {
      res.status(400).json({ ok: false, error: 'Informations d’accompagnement incomplètes.' });
      return;
    }

    const reqId = `req-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const validType = type === 'collective' ? 'collective' : 'individual';
    const resolvedUserId =
      caller.userId && /^[0-9a-f-]{36}$/i.test(caller.userId)
        ? caller.userId
        : userId && /^[0-9a-f-]{36}$/i.test(String(userId))
        ? String(userId)
        : null;

    if (supabaseAdmin) {
      await supabaseAdmin
        .from('coaching_requests')
        .insert({
          id: reqId,
          user_id: resolvedUserId,
          user_name: cleanName,
          user_email: cleanEmail,
          user_phone: cleanPhone,
          type: validType,
          program_title: String(programTitle || 'Accompagnement DJIFFA ACADEMY').slice(0, 200),
          need_description: cleanNeed,
          preferred_date: cleanDate,
          status: 'pending'
        })
        .then(() => undefined, () => undefined);
    }

    res.json({ ok: true, id: reqId });
  });

  // 3d. Admin-only endpoints for Contact Messages & Payment Events
  app.get('/api/admin/contact-messages', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && Array.isArray(data)) {
        res.json({
          ok: true,
          messages: data.map((m: any) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            phone: m.phone || undefined,
            subject: m.subject,
            message: m.message,
            status: m.status,
            adminNotes: m.admin_notes || undefined,
            createdAt: m.created_at
          }))
        });
        return;
      }
    }

    res.json({ ok: true, messages: recentContactMessages });
  });

  app.patch('/api/admin/contact-messages/:id', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }
    const msgId = String(req.params.id || '');
    const { status, adminNotes } = req.body || {};
    const validStatus: ServerContactMessage['status'] =
      status === 'read' || status === 'replied' || status === 'archived' ? status : 'new';

    const idx = recentContactMessages.findIndex((m) => m.id === msgId);
    if (idx >= 0) {
      recentContactMessages[idx] = {
        ...recentContactMessages[idx],
        status: validStatus,
        adminNotes: adminNotes !== undefined ? String(adminNotes) : recentContactMessages[idx].adminNotes
      };
    }

    let cloudSynced = false;
    let warning: string | undefined;

    if (supabaseAdmin) {
      const { error: updateErr } = await supabaseAdmin
        .from('contact_messages')
        .update({
          status: validStatus,
          admin_notes: adminNotes !== undefined ? String(adminNotes) : null
        })
        .eq('id', msgId);

      if (!updateErr) {
        cloudSynced = true;
      } else if (
        validStatus === 'archived' &&
        (updateErr.code === '23514' || /check constraint/i.test(updateErr.message))
      ) {
        warning =
          'Statut « archived » appliqué localement. Exécutez la mise à jour optionnelle dans supabase/migrations_optional_v2.sql pour autoriser « archived » dans Supabase.';
      } else if (
        updateErr.code !== '42P01' &&
        updateErr.code !== 'PGRST205' &&
        !/does not exist|schema cache/i.test(updateErr.message)
      ) {
        warning = `Synchronisation Supabase contact_messages : ${updateErr.message}`;
      }
    }

    res.json({ ok: true, cloudSynced, ...(warning ? { warning } : {}) });
  });

  app.get('/api/admin/payment-events', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }
    res.json({ ok: true, events: recentPaymentEvents });
  });

  // 4. Create real payment session (FedaPay / CinetPay / KKiaPay) + record pending order in Supabase if active
  app.post('/api/payments/create-session', async (req, res) => {
    const status = getServerPaymentStatus();
    const {
      reference,
      amount,
      currency,
      description,
      courseId,
      userId,
      customerEmail,
      customerName,
      customerPhone,
      paymentMethod,
      promoCode
    } = req.body || {};

    const numericAmount = Number(amount);
    if (!reference || !courseId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !currency || !customerEmail) {
      res.status(400).json({ ok: false, error: 'Paramètres de commande incomplets ou montant invalide.' });
      return;
    }

    if (!status.configured) {
      res.status(200).json({
        ok: false,
        notConfigured: true,
        provider: status.provider,
        mode: status.mode,
        message: status.message
      });
      return;
    }

    if (status.keyModeAligned === false) {
      res.status(503).json({
        ok: false,
        provider: status.provider,
        mode: status.mode,
        error: status.message
      });
      return;
    }

    const normalizedCurrency = currency === 'EUR' ? 'EUR' : currency === 'USD' ? 'USD' : 'XOF';
    let verifiedAmount = Math.round(numericAmount);
    const caller = await resolveCallerAuth(req);
    const resolvedUserId =
      caller.userId && /^[0-9a-f-]{36}$/i.test(caller.userId)
        ? caller.userId
        : userId && /^[0-9a-f-]{36}$/i.test(String(userId))
        ? String(userId)
        : null;

    // Validate authoritative course price & promo code from Supabase (never silently bypass on DB errors)
    if (supabaseAdmin) {
      let courseRow: {
        id: string;
        price_xof: number;
        price_eur: number;
        price_usd: number;
        promo_active?: boolean | null;
        promo_price_xof?: number | null;
        promo_price_eur?: number | null;
        promo_price_usd?: number | null;
      } | null = null;

      const extRes = await supabaseAdmin
        .from('courses')
        .select('id, price_xof, price_eur, price_usd, promo_active, promo_price_xof, promo_price_eur, promo_price_usd')
        .eq('id', String(courseId))
        .maybeSingle();

      if (extRes.error) {
        if (/column|schema cache|42703|PGRST204/i.test(extRes.error.message)) {
          const coreRes = await supabaseAdmin
            .from('courses')
            .select('id, price_xof, price_eur, price_usd')
            .eq('id', String(courseId))
            .maybeSingle();
          if (coreRes.error) {
            res.status(503).json({
              ok: false,
              error: 'Impossible de vérifier le tarif officiel de la formation auprès de Supabase.'
            });
            return;
          }
          courseRow = coreRes.data;
        } else {
          res.status(503).json({
            ok: false,
            error: 'Impossible de vérifier le tarif officiel de la formation auprès de Supabase.'
          });
          return;
        }
      } else {
        courseRow = extRes.data;
      }

      if (!courseRow) {
        res.status(400).json({
          ok: false,
          error: 'Formation introuvable ou non encore synchronisée dans la base officielle Supabase.'
        });
        return;
      }

      const promoEnabled = Boolean(courseRow.promo_active);
      const basePrice =
        normalizedCurrency === 'EUR'
          ? promoEnabled && courseRow.promo_price_eur
            ? Number(courseRow.promo_price_eur)
            : Number(courseRow.price_eur)
          : normalizedCurrency === 'USD'
          ? promoEnabled && courseRow.promo_price_usd
            ? Number(courseRow.promo_price_usd)
            : Number(courseRow.price_usd)
          : promoEnabled && courseRow.promo_price_xof
          ? Number(courseRow.promo_price_xof)
          : Number(courseRow.price_xof);

      let discountRatio = 0;
      if (promoCode) {
        const { data: promoRow, error: promoErr } = await supabaseAdmin
          .from('promo_codes')
          .select('discount_percent, is_active')
          .ilike('code', String(promoCode).trim())
          .maybeSingle();
        if (promoErr) {
          res.status(503).json({
            ok: false,
            error: 'Impossible de vérifier le code promotionnel auprès de Supabase.'
          });
          return;
        }
        if (promoRow && promoRow.is_active) {
          discountRatio = Math.min(95, Math.max(0, Number(promoRow.discount_percent || 0))) / 100;
        }
      }

      const expectedServerAmount = Math.max(0, Math.round(basePrice * (1 - discountRatio)));
      if (!Number.isFinite(expectedServerAmount) || expectedServerAmount <= 0) {
        res.status(400).json({
          ok: false,
          error: 'Tarif officiel de la formation invalide côté base de données.'
        });
        return;
      }
      if (verifiedAmount + 2 < expectedServerAmount) {
        res.status(400).json({
          ok: false,
          error: 'Le montant transmis ne correspond pas au tarif officiel de la formation.'
        });
        return;
      }
      verifiedAmount = expectedServerAmount;

      const { data: existingOrder, error: existingOrderErr } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('reference', String(reference))
        .maybeSingle();

      if (existingOrderErr) {
        res.status(503).json({
          ok: false,
          error: 'Impossible de vérifier la référence de commande dans Supabase.'
        });
        return;
      }
      if (existingOrder?.status === 'confirmed') {
        res.status(409).json({
          ok: false,
          error: 'Cette référence de commande est déjà confirmée.'
        });
        return;
      }

      const orderFields = {
        user_id: resolvedUserId,
        user_name: String(customerName || 'Apprenant'),
        user_email: String(customerEmail),
        course_id: String(courseId),
        course_title: String(description || 'Formation DJIFFA ACADEMY'),
        amount: verifiedAmount,
        currency: normalizedCurrency,
        payment_method: String(paymentMethod || 'mtn_momo'),
        payment_provider:
          status.provider === 'fedapay' ? 'FedaPay' : status.provider === 'kkiapay' ? 'KKiaPay' : 'CinetPay',
        status: 'pending',
        is_demo_transaction: status.mode !== 'live',
        promo_code_used: promoCode ? String(promoCode) : null,
        customer_phone: customerPhone ? String(customerPhone) : null
      };

      const { error: orderWriteErr } = existingOrder
        ? await supabaseAdmin.from('orders').update(orderFields).eq('reference', String(reference))
        : await supabaseAdmin.from('orders').insert({
            id: `ord-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
            reference: String(reference),
            ...orderFields
          });

      if (orderWriteErr) {
        res.status(500).json({
          ok: false,
          error: `Impossible d’enregistrer la commande avant paiement : ${orderWriteErr.message}`
        });
        return;
      }
    }

    try {
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`).replace(/\/$/, '');

      if (status.provider === 'fedapay') {
        const baseUrl = status.mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
        const normalizedPhone = normalizeFedaPayPhoneNumber(customerPhone);
        const customerPayload: {
          firstname: string;
          lastname: string;
          email: string;
          phone_number?: { number: string; country: string };
        } = {
          firstname: String(customerName || 'Apprenant').split(' ')[0],
          lastname: String(customerName || 'DJIFFA').split(' ').slice(1).join(' ') || 'Academy',
          email: customerEmail
        };
        if (normalizedPhone) {
          customerPayload.phone_number = normalizedPhone;
        }

        const response = await fetch(`${baseUrl}/transactions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            description: description || `Formation DJIFFA ACADEMY - ${reference}`,
            amount: verifiedAmount,
            currency: { iso: normalizedCurrency },
            callback_url: `${appUrl}/?payment_ref=${encodeURIComponent(reference)}`,
            custom_metadata: { reference, paymentMethod, courseId },
            customer: customerPayload
          })
        });

        const rawTxBody = await response.text().catch(() => '');
        if (!response.ok) {
          const errMsg = extractFedaPayApiError(rawTxBody, `Erreur API FedaPay (HTTP ${response.status}).`);
          recordPaymentEvent({
            reference: String(reference),
            provider: 'fedapay',
            event: 'create_session_error',
            status: 'failed',
            detail: errMsg
          });
          res.status(502).json({ ok: false, error: errMsg });
          return;
        }

        const data = (rawTxBody ? JSON.parse(rawTxBody) : {}) as {
          'v1/transaction'?: { id?: number; reference?: string; payment_url?: string };
        };
        const tx = data['v1/transaction'];
        const fedaTxId = tx?.id !== undefined && tx?.id !== null ? String(tx.id) : null;
        let paymentUrl = tx?.payment_url || null;

        // Persist the FedaPay transaction ID on the existing order immediately (no duplicate order created)
        if (supabaseAdmin && fedaTxId) {
          await supabaseAdmin
            .from('orders')
            .update({
              provider_transaction_id: fedaTxId,
              ...(normalizedPhone ? { customer_phone: normalizedPhone.number } : {})
            })
            .eq('reference', String(reference));
        }

        // Generate hosted checkout token URL via FedaPay /transactions/:id/token when needed
        if (!paymentUrl && fedaTxId) {
          const tokenRes = await fetch(`${baseUrl}/transactions/${encodeURIComponent(fedaTxId)}/token`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
          });
          const rawTokenBody = await tokenRes.text().catch(() => '');
          if (!tokenRes.ok) {
            const tokenErr = extractFedaPayApiError(
              rawTokenBody,
              `Impossible d’obtenir l’URL de paiement FedaPay (HTTP ${tokenRes.status}).`
            );
            recordPaymentEvent({
              reference: String(reference),
              provider: 'fedapay',
              event: 'create_session_error',
              status: 'failed',
              detail: `Token FedaPay Tx ${fedaTxId} : ${tokenErr}`
            });
            res.status(502).json({ ok: false, error: tokenErr });
            return;
          }
          const tokenData = (rawTokenBody ? JSON.parse(rawTokenBody) : {}) as { url?: string; token?: string };
          paymentUrl = tokenData.url || null;
        }

        if (!paymentUrl) {
          const missingUrlMsg = 'FedaPay n’a pas renvoyé d’URL de paiement hébergée.';
          recordPaymentEvent({
            reference: String(reference),
            provider: 'fedapay',
            event: 'create_session_error',
            status: 'failed',
            detail: missingUrlMsg
          });
          res.status(502).json({ ok: false, error: missingUrlMsg });
          return;
        }

        recordPaymentEvent({
          reference: String(reference),
          provider: 'fedapay',
          event: 'create_session',
          status: 'pending',
          detail: `Session créée (${normalizedCurrency} ${verifiedAmount}${fedaTxId ? `, Tx ${fedaTxId}` : ''}${
            normalizedPhone ? `, ${normalizedPhone.number}` : ''
          })`
        });

        res.json({
          ok: true,
          provider: 'fedapay',
          transactionId: tx?.id,
          paymentUrl,
          verifiedAmount
        });
        return;
      }

      if (status.provider === 'cinetpay') {
        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apikey: process.env.CINETPAY_API_KEY,
            site_id: process.env.CINETPAY_SITE_ID,
            transaction_id: reference,
            amount: verifiedAmount,
            currency: normalizedCurrency,
            description: description || `Formation DJIFFA ACADEMY`,
            notify_url: `${appUrl}/api/payments/webhook`,
            return_url: `${appUrl}/?payment_ref=${encodeURIComponent(reference)}`,
            channels: 'ALL',
            customer_name: customerName || 'Apprenant',
            customer_email: customerEmail,
            customer_phone_number: customerPhone || ''
          })
        });
        const data = (await response.json()) as {
          code?: string;
          message?: string;
          data?: { payment_url?: string; payment_token?: string };
        };
        if (data.code !== '201') {
          res.status(502).json({ ok: false, error: data.message || 'Erreur API CinetPay.' });
          return;
        }
        res.json({
          ok: true,
          provider: 'cinetpay',
          paymentUrl: data.data?.payment_url || null,
          paymentToken: data.data?.payment_token || null,
          verifiedAmount
        });
        return;
      }

      // KKiaPay widget config
      res.json({
        ok: true,
        provider: 'kkiapay',
        publicKey: status.publicKey,
        sandbox: status.mode === 'sandbox',
        reference,
        verifiedAmount,
        callbackUrl: `${appUrl}/?payment_ref=${encodeURIComponent(reference)}`
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur serveur lors de l’initialisation du paiement.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // 5. Server-side transaction verification + automatic Supabase enrollment
  app.post('/api/payments/verify', async (req, res) => {
    const status = getServerPaymentStatus();
    const { transactionId, reference } = req.body || {};

    if (!reference) {
      res.status(400).json({ ok: false, error: 'Référence de transaction requise.' });
      return;
    }

    const cleanRef = String(reference).trim();
    const cachedTx = processedTransactions.get(cleanRef);
    if (cachedTx?.status === 'confirmed') {
      res.json({ ok: true, alreadyVerified: true, verified: true, status: 'confirmed' });
      return;
    }
    if (cachedTx?.status === 'refunded') {
      res.json({
        ok: false,
        alreadyVerified: true,
        verified: false,
        finalFailure: true,
        status: 'refunded',
        error: 'Cette commande a déjà été remboursée.'
      });
      return;
    }

    if (!status.configured) {
      res.status(400).json({
        ok: false,
        notConfigured: true,
        error: 'Aucun prestataire de paiement réel n’est configuré sur le serveur.'
      });
      return;
    }

    let storedOrderAmount: number | null = null;
    let storedOrderCurrency: string | null = null;
    let storedOrderStatus: string | null = null;
    let storedProviderTxId: string | null = null;

    if (supabaseAdmin) {
      const { data: orderRow, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('amount, currency, status, provider_transaction_id')
        .eq('reference', cleanRef)
        .maybeSingle();
      if (orderErr) {
        res.status(503).json({
          ok: false,
          temporaryError: true,
          error: 'Impossible de contrôler la commande auprès de Supabase pour le moment.'
        });
        return;
      }
      if (orderRow?.status === 'confirmed') {
        processedTransactions.set(cleanRef, {
          status: 'confirmed',
          verifiedAt: new Date().toISOString(),
          provider: status.provider
        });
        res.json({ ok: true, alreadyVerified: true, verified: true, status: 'confirmed' });
        return;
      }
      if (orderRow?.status === 'refunded') {
        processedTransactions.set(cleanRef, {
          status: 'refunded',
          verifiedAt: new Date().toISOString(),
          provider: status.provider
        });
        res.json({
          ok: false,
          alreadyVerified: true,
          verified: false,
          finalFailure: true,
          status: 'refunded',
          error: 'Cette commande a été remboursée.'
        });
        return;
      }
      if (orderRow) {
        if (typeof orderRow.amount === 'number') storedOrderAmount = orderRow.amount;
        storedOrderCurrency = orderRow.currency || null;
        storedOrderStatus = orderRow.status || null;
        storedProviderTxId = orderRow.provider_transaction_id ? String(orderRow.provider_transaction_id).trim() : null;
      }
    }

    const resolvedTxId =
      transactionId !== undefined && transactionId !== null && String(transactionId).trim()
        ? String(transactionId).trim()
        : storedProviderTxId || '';

    try {
      if (status.provider === 'fedapay') {
        if (!resolvedTxId) {
          res.status(400).json({
            ok: false,
            verified: false,
            error: 'Identifiant de transaction FedaPay manquant pour la vérification.'
          });
          return;
        }

        const fedaRes = await fetchFedaPayTransaction(resolvedTxId, status.mode);
        if (!fedaRes.ok) {
          // Condition 7: never declare a payment failed because a temporary verification call failed
          res.status(fedaRes.temporary ? 503 : 502).json({
            ok: false,
            verified: false,
            temporaryError: true,
            status: storedOrderStatus || 'pending',
            error: `Vérification temporairement impossible auprès de FedaPay (${fedaRes.error}). La commande n’a pas été marquée comme échouée ; veuillez réessayer.`
          });
          return;
        }

        const tx = fedaRes.tx;
        const txStatus = String(tx.status || '').trim().toLowerCase();
        const metadataRef = tx.custom_metadata?.reference;
        const refMatches = !metadataRef || String(metadataRef) === cleanRef;
        const amountMatches =
          storedOrderAmount === null ||
          (tx.amount !== undefined && Number.isFinite(Number(tx.amount)) && Number(tx.amount) + 2 >= storedOrderAmount);
        const currencyMatches =
          !storedOrderCurrency || !tx.currency?.iso || String(tx.currency.iso).toUpperCase() === storedOrderCurrency;

        if (txStatus === 'approved' || txStatus === 'transferred') {
          if (!refMatches || !amountMatches || !currencyMatches) {
            recordPaymentEvent({
              reference: cleanRef,
              provider: 'fedapay',
              event: 'verify_mismatch',
              status: 'pending',
              detail: `Incohérence FedaPay Tx ${resolvedTxId} (ref=${refMatches}, montant=${amountMatches}, devise=${currencyMatches})`
            });
            res.status(400).json({
              ok: false,
              verified: false,
              status: 'pending',
              providerStatus: txStatus,
              error: 'Incohérence de référence, montant ou devise détectée lors du contrôle FedaPay.'
            });
            return;
          }

          const enrollRes = await activateOrderEnrollmentInSupabase(cleanRef, resolvedTxId);
          if (enrollRes && enrollRes.ok === false && !enrollRes.skipped) {
            recordPaymentEvent({
              reference: cleanRef,
              provider: 'fedapay',
              event: 'enrollment_error',
              status: 'pending',
              detail: `Transaction ${resolvedTxId} approuvée, mais activation Supabase échouée : ${enrollRes.error}`
            });
            res.status(500).json({
              ok: false,
              verified: false,
              temporaryError: true,
              status: storedOrderStatus || 'pending',
              providerStatus: txStatus,
              transactionId: resolvedTxId,
              error: `Paiement vérifié auprès de FedaPay, mais l’activation de la commande/inscription dans Supabase a échoué (${enrollRes.error}).`
            });
            return;
          }

          processedTransactions.set(cleanRef, {
            status: 'confirmed',
            verifiedAt: new Date().toISOString(),
            provider: 'fedapay'
          });
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'verify',
            status: 'confirmed',
            detail: `Transaction ${resolvedTxId} vérifiée (${txStatus})`
          });
          res.json({
            ok: true,
            verified: true,
            status: 'confirmed',
            providerStatus: txStatus,
            transactionId: resolvedTxId
          });
          return;
        }

        if (txStatus === 'declined' || txStatus === 'failed') {
          const failureReason = extractFedaPayFailureReason(tx);
          const txModeLabel = tx.mode || tx.payment_method;
          const modeSuffix = txModeLabel ? ` [mode: ${txModeLabel}]` : '';
          await syncNonConfirmedOrderStatusInSupabase(cleanRef, 'failed', resolvedTxId);
          processedTransactions.set(cleanRef, {
            status: 'failed',
            verifiedAt: new Date().toISOString(),
            provider: 'fedapay'
          });
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'verify',
            status: 'failed',
            detail: `Transaction ${resolvedTxId} refusée (${txStatus}${modeSuffix}${failureReason ? ` : ${failureReason}` : ''})`
          });
          res.json({
            ok: false,
            verified: false,
            finalFailure: true,
            status: 'failed',
            providerStatus: txStatus,
            transactionId: resolvedTxId,
            error: failureReason
              ? `Transaction refusée par FedaPay${modeSuffix} : ${failureReason}`
              : `Transaction refusée par FedaPay (${txStatus}${modeSuffix}).`
          });
          return;
        }

        if (txStatus === 'canceled' || txStatus === 'cancelled' || txStatus === 'expired') {
          await syncNonConfirmedOrderStatusInSupabase(cleanRef, 'cancelled', resolvedTxId);
          processedTransactions.set(cleanRef, {
            status: 'cancelled',
            verifiedAt: new Date().toISOString(),
            provider: 'fedapay'
          });
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'verify',
            status: 'cancelled',
            detail: `Transaction ${resolvedTxId} ${txStatus === 'expired' ? 'expirée' : 'annulée'} (${txStatus})`
          });
          res.json({
            ok: false,
            verified: false,
            finalFailure: true,
            status: 'cancelled',
            providerStatus: txStatus,
            transactionId: resolvedTxId,
            error:
              txStatus === 'expired'
                ? 'La session de paiement a expiré côté FedaPay.'
                : 'La transaction a été annulée côté FedaPay.'
          });
          return;
        }

        if (txStatus === 'refunded') {
          await revokeOrderEnrollmentInSupabase(cleanRef, 'refunded', resolvedTxId);
          processedTransactions.set(cleanRef, {
            status: 'refunded',
            verifiedAt: new Date().toISOString(),
            provider: 'fedapay'
          });
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'verify',
            status: 'refunded',
            detail: `Transaction ${resolvedTxId} remboursée`
          });
          res.json({
            ok: false,
            verified: false,
            finalFailure: true,
            status: 'refunded',
            providerStatus: 'refunded',
            transactionId: resolvedTxId,
            error: 'Cette transaction a été remboursée côté FedaPay.'
          });
          return;
        }

        // Still pending / processing / unknown non-final state -> keep pending (never unlock, never force failed)
        await syncNonConfirmedOrderStatusInSupabase(cleanRef, 'pending', resolvedTxId);
        const failureHint = extractFedaPayFailureReason(tx);
        const pendingModeLabel = tx.mode || tx.payment_method;
        const pendingModeSuffix = pendingModeLabel ? ` [mode: ${pendingModeLabel}]` : '';
        res.json({
          ok: false,
          verified: false,
          status: 'pending',
          providerStatus: txStatus || 'pending',
          transactionId: resolvedTxId,
          error: failureHint
            ? `En attente côté FedaPay${pendingModeSuffix} : ${failureHint}`
            : 'Transaction toujours en attente côté FedaPay (0 FCFA validé). Si la page Sandbox a affiché « Transaction échouée », réessayez avec un numéro de test Sandbox valide (ex. 66000001 MTN / 64000001 Moov).'
        });
        return;
      }

      if (status.provider === 'kkiapay' && resolvedTxId) {
        const baseUrl = status.mode === 'live' ? 'https://api.kkiapay.me' : 'https://api-sandbox.kkiapay.me';
        const response = await fetch(`${baseUrl}/api/v1/transactions/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.KKIAPAY_PUBLIC_KEY || '',
            'x-private-key': process.env.KKIAPAY_PRIVATE_KEY || '',
            'x-secret': process.env.KKIAPAY_SECRET || ''
          },
          body: JSON.stringify({ transactionId: resolvedTxId })
        });
        if (!response.ok) {
          res.status(503).json({
            ok: false,
            verified: false,
            temporaryError: true,
            status: storedOrderStatus || 'pending',
            error: `Vérification temporairement impossible auprès de KKiaPay (HTTP ${response.status}).`
          });
          return;
        }
        const data = (await response.json()) as { status?: string; amount?: number };
        const amountMatches =
          storedOrderAmount === null || (data.amount !== undefined && Number(data.amount) + 2 >= storedOrderAmount);
        if (data.status === 'SUCCESS' && amountMatches) {
          processedTransactions.set(cleanRef, {
            status: 'confirmed',
            verifiedAt: new Date().toISOString(),
            provider: 'kkiapay'
          });
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'kkiapay',
            event: 'verify',
            status: 'confirmed',
            detail: `Transaction ${resolvedTxId} approuvée`
          });
          await activateOrderEnrollmentInSupabase(cleanRef, resolvedTxId);
          res.json({ ok: true, verified: true, status: 'confirmed' });
          return;
        }
        res.json({ ok: false, verified: false, status: data.status || 'pending' });
        return;
      }

      if (status.provider === 'cinetpay') {
        const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apikey: process.env.CINETPAY_API_KEY,
            site_id: process.env.CINETPAY_SITE_ID,
            transaction_id: cleanRef
          })
        });
        if (!response.ok) {
          res.status(503).json({
            ok: false,
            verified: false,
            temporaryError: true,
            status: storedOrderStatus || 'pending',
            error: `Vérification temporairement impossible auprès de CinetPay (HTTP ${response.status}).`
          });
          return;
        }
        const data = (await response.json()) as {
          code?: string;
          data?: { status?: string; amount?: number | string; currency?: string };
        };
        const amountMatches =
          storedOrderAmount === null ||
          (data.data?.amount !== undefined && Number(data.data.amount) + 2 >= storedOrderAmount);
        const currencyMatches =
          !storedOrderCurrency || !data.data?.currency || String(data.data.currency).toUpperCase() === storedOrderCurrency;
        if (data.code === '00' && data.data?.status === 'ACCEPTED' && amountMatches && currencyMatches) {
          processedTransactions.set(cleanRef, {
            status: 'confirmed',
            verifiedAt: new Date().toISOString(),
            provider: 'cinetpay'
          });
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'cinetpay',
            event: 'verify',
            status: 'confirmed',
            detail: `Paiement CinetPay accepté`
          });
          await activateOrderEnrollmentInSupabase(cleanRef, resolvedTxId || cleanRef);
          res.json({ ok: true, verified: true, status: 'confirmed' });
          return;
        }
        res.json({ ok: false, verified: false, status: data.data?.status || 'pending' });
        return;
      }

      res.status(400).json({ ok: false, error: 'Identifiant de transaction manquant pour la vérification.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de vérification auprès du prestataire.';
      res.status(500).json({ ok: false, verified: false, temporaryError: true, error: message });
    }
  });

  // 6. Secure Webhook receiver (HMAC verification + idempotency + live FedaPay verification + Supabase activation/revocation)
  app.post('/api/payments/webhook', async (req: express.Request & { rawBody?: Buffer }, res) => {
    const status = getServerPaymentStatus();
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

    if (status.provider === 'fedapay') {
      const fedaSecret = process.env.FEDAPAY_WEBHOOK_SECRET || '';
      if (!fedaSecret) {
        if (isProduction && status.configured) {
          res.status(401).json({ ok: false, error: 'FEDAPAY_WEBHOOK_SECRET manquant côté serveur.' });
          return;
        }
      } else {
        const sig = req.headers['x-fedapay-signature'] as string | undefined;
        if (!sig) {
          res.status(401).json({ ok: false, error: 'Signature webhook FedaPay manquante.' });
          return;
        }
        const timestampMatch = sig.match(/t=([^,]+)/);
        const signatureMatch = sig.match(/s=([a-f0-9]+)/i);
        const expectedPlain = crypto.createHmac('sha256', fedaSecret).update(rawBody).digest('hex');
        const expectedTimestamped = timestampMatch
          ? crypto.createHmac('sha256', fedaSecret).update(`${timestampMatch[1]}.${rawBody}`).digest('hex')
          : '';
        const providedHex = signatureMatch ? signatureMatch[1] : sig.trim();
        const sigValid =
          safeConstantTimeEqual(providedHex.toLowerCase(), expectedPlain.toLowerCase()) ||
          (expectedTimestamped !== '' &&
            safeConstantTimeEqual(providedHex.toLowerCase(), expectedTimestamped.toLowerCase()));
        if (!sigValid) {
          res.status(403).json({ ok: false, error: 'Signature webhook FedaPay invalide.' });
          return;
        }
      }
    }

    if (status.provider === 'cinetpay') {
      const cinetSecret = process.env.CINETPAY_SECRET_KEY || '';
      if (!cinetSecret) {
        if (isProduction && status.configured) {
          res.status(401).json({ ok: false, error: 'CINETPAY_SECRET_KEY manquant côté serveur.' });
          return;
        }
      } else {
        const xToken = req.headers['x-token'] as string | undefined;
        if (!xToken) {
          res.status(401).json({ ok: false, error: 'Signature webhook CinetPay (x-token) manquante.' });
          return;
        }
        const expected = crypto.createHmac('sha256', cinetSecret).update(rawBody).digest('hex');
        if (!safeConstantTimeEqual(xToken.trim().toLowerCase(), expected.toLowerCase())) {
          res.status(403).json({ ok: false, error: 'Signature webhook CinetPay invalide.' });
          return;
        }
      }
    }

    if (status.provider === 'kkiapay') {
      const kkiaSecret = process.env.KKIAPAY_SECRET || '';
      if (!kkiaSecret) {
        if (isProduction && status.configured) {
          res.status(401).json({ ok: false, error: 'KKIAPAY_SECRET manquant côté serveur.' });
          return;
        }
      } else {
        const xSecret = req.headers['x-kkiapay-secret'] as string | undefined;
        if (!xSecret) {
          res.status(401).json({ ok: false, error: 'Secret webhook KKiaPay manquant.' });
          return;
        }
        if (!safeConstantTimeEqual(xSecret.trim(), kkiaSecret)) {
          res.status(403).json({ ok: false, error: 'Secret webhook KKiaPay invalide.' });
          return;
        }
      }
    }

    const rawTxId = req.body?.entity?.id ?? req.body?.transactionId;
    const cleanTxId = rawTxId !== undefined && rawTxId !== null && String(rawTxId).trim() ? String(rawTxId).trim() : undefined;
    let rawRef = req.body?.entity?.custom_metadata?.reference || req.body?.cpm_trans_id || req.body?.transactionId;

    if (!rawRef && cleanTxId && supabaseAdmin) {
      const { data: matchedByTx } = await supabaseAdmin
        .from('orders')
        .select('reference')
        .eq('provider_transaction_id', cleanTxId)
        .maybeSingle();
      if (matchedByTx?.reference) {
        rawRef = matchedByTx.reference;
      }
    }

    if (!rawRef) {
      res.json({ ok: true, received: true, ignored: true });
      return;
    }

    const cleanRef = String(rawRef).trim();
    const eventId = req.body?.id !== undefined && req.body?.id !== null ? String(req.body.id).trim() : '';
    const eventName = String(req.body?.name || req.body?.event || '').trim().toLowerCase();
    const entityStatus = String(req.body?.entity?.status || req.body?.status || '').trim().toLowerCase();

    const webhookKey = eventId
      ? `${status.provider}:evt:${eventId}`
      : `${status.provider}:tx:${cleanTxId || cleanRef}:${eventName}:${entityStatus}`;

    if (processedWebhookEvents.has(webhookKey)) {
      res.json({ ok: true, idempotent: true, received: true });
      return;
    }

    let dbOrder: {
      status?: string;
      amount?: number;
      currency?: string;
      provider_transaction_id?: string | null;
    } | null = null;
    if (supabaseAdmin) {
      const { data: orderRow, error: orderFetchErr } = await supabaseAdmin
        .from('orders')
        .select('status, amount, currency, provider_transaction_id')
        .eq('reference', cleanRef)
        .maybeSingle();
      if (orderFetchErr) {
        res.status(503).json({ ok: false, temporaryError: true, error: 'Erreur temporaire lecture commande Supabase.' });
        return;
      }
      dbOrder = orderRow;
    }

    const isRefund = entityStatus === 'refunded' || eventName.includes('refund');
    const isDeclinedOrFailed =
      entityStatus === 'declined' ||
      entityStatus === 'failed' ||
      entityStatus === 'refused' ||
      eventName.includes('declined') ||
      eventName.includes('failed') ||
      eventName.includes('refused');
    const isCanceledOrExpired =
      entityStatus === 'canceled' ||
      entityStatus === 'cancelled' ||
      entityStatus === 'expired' ||
      eventName.includes('cancel') ||
      eventName.includes('expired');
    const isPendingOrCreated =
      entityStatus === 'pending' ||
      entityStatus === 'processing' ||
      eventName === 'transaction.created' ||
      eventName === 'transaction.pending';

    const isConfirmedSignal =
      status.provider === 'fedapay'
        ? entityStatus === 'approved' ||
          entityStatus === 'transferred' ||
          eventName === 'transaction.approved' ||
          eventName === 'transaction.transferred'
        : status.provider === 'kkiapay'
        ? entityStatus === 'success' || eventName === 'transaction.success'
        : entityStatus === 'accepted' || String(req.body?.cpm_result || '') === '00';

    if (isRefund) {
      if (dbOrder?.status === 'refunded' || processedTransactions.get(cleanRef)?.status === 'refunded') {
        rememberWebhookEvent(webhookKey);
        res.json({ ok: true, idempotent: true, status: 'refunded' });
        return;
      }
      processedTransactions.set(cleanRef, {
        status: 'refunded',
        verifiedAt: new Date().toISOString(),
        provider: status.provider
      });
      recordPaymentEvent({
        reference: cleanRef,
        provider: status.provider,
        event: eventName || 'webhook',
        status: 'refunded',
        detail: `Webhook remboursement (${entityStatus || 'refunded'})`
      });
      await revokeOrderEnrollmentInSupabase(cleanRef, 'refunded', cleanTxId);
      rememberWebhookEvent(webhookKey);
      res.json({ ok: true, received: true, status: 'refunded' });
      return;
    }

    const memStatus = processedTransactions.get(cleanRef)?.status;

    if (isDeclinedOrFailed || isCanceledOrExpired) {
      const mappedStatus: 'failed' | 'cancelled' = isDeclinedOrFailed ? 'failed' : 'cancelled';
      if (
        dbOrder?.status === 'confirmed' ||
        dbOrder?.status === 'refunded' ||
        memStatus === 'confirmed' ||
        memStatus === 'refunded'
      ) {
        rememberWebhookEvent(webhookKey);
        res.json({ ok: true, idempotent: true, ignored: true, status: dbOrder?.status || memStatus });
        return;
      }
      const syncRes = await syncNonConfirmedOrderStatusInSupabase(cleanRef, mappedStatus, cleanTxId);
      const alreadyMem = memStatus === mappedStatus;
      processedTransactions.set(cleanRef, {
        status: mappedStatus,
        verifiedAt: new Date().toISOString(),
        provider: status.provider
      });
      if (!syncRes.alreadyInState && !alreadyMem) {
        recordPaymentEvent({
          reference: cleanRef,
          provider: status.provider,
          event: eventName || 'webhook',
          status: mappedStatus,
          detail: `Webhook reçu (${entityStatus || eventName || mappedStatus})`
        });
      }
      rememberWebhookEvent(webhookKey);
      res.json({ ok: true, received: true, status: mappedStatus, ...(syncRes.alreadyInState || alreadyMem ? { idempotent: true } : {}) });
      return;
    }

    if (isPendingOrCreated) {
      if (
        dbOrder?.status === 'confirmed' ||
        dbOrder?.status === 'refunded' ||
        memStatus === 'confirmed' ||
        memStatus === 'refunded'
      ) {
        rememberWebhookEvent(webhookKey);
        res.json({ ok: true, idempotent: true, ignored: true, status: dbOrder?.status || memStatus });
        return;
      }
      const syncRes = await syncNonConfirmedOrderStatusInSupabase(cleanRef, 'pending', cleanTxId);
      if (!syncRes.alreadyInState) {
        recordPaymentEvent({
          reference: cleanRef,
          provider: status.provider,
          event: eventName || 'webhook',
          status: 'pending',
          detail: `Webhook en attente (${entityStatus || eventName || 'pending'})`
        });
      }
      rememberWebhookEvent(webhookKey);
      res.json({ ok: true, received: true, pending: true, status: 'pending' });
      return;
    }

    if (isConfirmedSignal) {
      if (memStatus === 'confirmed' || dbOrder?.status === 'confirmed') {
        rememberWebhookEvent(webhookKey);
        res.json({ ok: true, idempotent: true, status: 'confirmed' });
        return;
      }
      if (memStatus === 'refunded' || dbOrder?.status === 'refunded') {
        rememberWebhookEvent(webhookKey);
        res.json({ ok: true, idempotent: true, ignored: true, status: 'refunded' });
        return;
      }

      let verifiedTxId = cleanTxId || dbOrder?.provider_transaction_id || undefined;

      // Condition 1 & 2: When FedaPay is configured, always verify the actual transaction status via FedaPay API before confirming
      if (status.provider === 'fedapay' && status.configured) {
        if (!verifiedTxId) {
          res.status(400).json({ ok: false, error: 'Identifiant de transaction FedaPay absent dans le webhook.' });
          return;
        }
        const fedaRes = await fetchFedaPayTransaction(verifiedTxId, status.mode);
        if (!fedaRes.ok) {
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'webhook_verify_retry',
            status: 'pending',
            detail: `Vérification FedaPay temporairement impossible (${fedaRes.error})`
          });
          res.status(503).json({
            ok: false,
            temporaryError: true,
            error: `Vérification API FedaPay temporairement indisponible : ${fedaRes.error}`
          });
          return;
        }

        const realTx = fedaRes.tx;
        const realStatus = String(realTx.status || '').trim().toLowerCase();
        if (realStatus !== 'approved' && realStatus !== 'transferred') {
          const syncedStatus: 'pending' | 'failed' | 'cancelled' =
            realStatus === 'declined' || realStatus === 'failed'
              ? 'failed'
              : realStatus === 'canceled' || realStatus === 'cancelled' || realStatus === 'expired'
              ? 'cancelled'
              : 'pending';
          await syncNonConfirmedOrderStatusInSupabase(cleanRef, syncedStatus, verifiedTxId);
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'webhook_status_guard',
            status: syncedStatus,
            detail: `Webhook bloqué : statut réel FedaPay = ${realStatus || 'inconnu'}`
          });
          rememberWebhookEvent(webhookKey);
          res.json({ ok: true, received: true, verified: false, status: syncedStatus });
          return;
        }

        const apiRef = realTx.custom_metadata?.reference;
        if (apiRef && String(apiRef) !== cleanRef) {
          res.status(400).json({ ok: false, error: 'Référence FedaPay API incohérente avec le webhook.' });
          return;
        }
        if (
          dbOrder &&
          typeof dbOrder.amount === 'number' &&
          (realTx.amount === undefined || !Number.isFinite(Number(realTx.amount)) || Number(realTx.amount) + 2 < dbOrder.amount)
        ) {
          recordPaymentEvent({
            reference: cleanRef,
            provider: 'fedapay',
            event: 'webhook_amount_mismatch',
            status: 'failed',
            detail: `Montant FedaPay (${realTx.amount}) inférieur à la commande (${dbOrder.amount})`
          });
          res.status(400).json({ ok: false, error: 'Montant FedaPay incohérent avec la commande.' });
          return;
        }
        if (
          dbOrder?.currency &&
          realTx.currency?.iso &&
          String(realTx.currency.iso).toUpperCase() !== dbOrder.currency
        ) {
          res.status(400).json({ ok: false, error: 'Devise FedaPay incohérente avec la commande.' });
          return;
        }
      } else {
        const rawWebhookAmount = req.body?.entity?.amount ?? req.body?.cpm_amount ?? req.body?.amount;
        if (dbOrder && typeof dbOrder.amount === 'number' && rawWebhookAmount !== undefined && Number.isFinite(Number(rawWebhookAmount))) {
          if (Number(rawWebhookAmount) + 2 < dbOrder.amount) {
            recordPaymentEvent({
              reference: cleanRef,
              provider: status.provider,
              event: 'webhook_amount_mismatch',
              status: 'failed',
              detail: `Montant webhook (${rawWebhookAmount}) inférieur à la commande (${dbOrder.amount})`
            });
            res.status(400).json({ ok: false, error: 'Montant webhook incohérent avec la commande.' });
            return;
          }
        }
      }

      const enrollRes = await activateOrderEnrollmentInSupabase(cleanRef, verifiedTxId);
      if (enrollRes && enrollRes.ok === false && !enrollRes.skipped) {
        recordPaymentEvent({
          reference: cleanRef,
          provider: status.provider,
          event: 'webhook_enrollment_error',
          status: 'pending',
          detail: `Webhook vérifié, mais échec activation Supabase : ${enrollRes.error}`
        });
        res.status(503).json({
          ok: false,
          temporaryError: true,
          error: `Échec temporaire d’activation de la commande/inscription dans Supabase : ${enrollRes.error}`
        });
        return;
      }

      processedTransactions.set(cleanRef, {
        status: 'confirmed',
        verifiedAt: new Date().toISOString(),
        provider: status.provider
      });
      recordPaymentEvent({
        reference: cleanRef,
        provider: status.provider,
        event: eventName || 'webhook',
        status: 'confirmed',
        detail: `Webhook confirmé${verifiedTxId ? ` (Tx ${verifiedTxId})` : ''}`
      });
      rememberWebhookEvent(webhookKey);
      res.json({ ok: true, received: true, status: 'confirmed' });
      return;
    }

    // Any unknown event/status is safely ignored without ever confirming enrollment
    recordPaymentEvent({
      reference: cleanRef,
      provider: status.provider,
      event: eventName || 'webhook_ignored',
      status: 'pending',
      detail: `Événement ignoré sans déblocage (${entityStatus || eventName || 'inconnu'})`
    });
    rememberWebhookEvent(webhookKey);
    res.json({ ok: true, received: true, ignored: true });
  });

  // 7. Admin Refund Route (protected by verified Admin token)
  app.post('/api/payments/refund', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Action réservée à la Direction.' });
      return;
    }

    const { reference, providerTransactionId } = req.body || {};
    if (!reference) {
      res.status(400).json({ ok: false, error: 'Référence de commande requise.' });
      return;
    }

    const status = getServerPaymentStatus();
    if (status.configured && status.provider === 'fedapay' && providerTransactionId) {
      try {
        const baseUrl = status.mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
        const refundRes = await fetch(`${baseUrl}/transactions/${encodeURIComponent(String(providerTransactionId))}/refund`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (!refundRes.ok) {
          const errData = (await refundRes.json()) as { message?: string };
          res.status(502).json({ ok: false, error: errData.message || 'Échec du remboursement auprès de FedaPay.' });
          return;
        }
      } catch (err) {
        res.status(500).json({
          ok: false,
          error: err instanceof Error ? err.message : 'Erreur lors du remboursement.'
        });
        return;
      }
    }

    processedTransactions.set(String(reference), {
      status: 'refunded',
      verifiedAt: new Date().toISOString(),
      provider: status.provider
    });
    recordPaymentEvent({
      reference: String(reference),
      provider: status.provider,
      event: 'admin_refund',
      status: 'refunded',
      detail: 'Remboursement déclenché par la Direction'
    });
    await revokeOrderEnrollmentInSupabase(String(reference), 'refunded');
    res.json({ ok: true, status: 'refunded' });
  });

  // 8. Admin Verification & Session Token
  app.post('/api/auth/admin-verify', (req, res) => {
    const { email, accessCode } = req.body || {};
    const expectedEmail = (process.env.ADMIN_EMAIL || 'faith.ariola@djiffa-agency.com').toLowerCase();
    const expectedCode = (process.env.ADMIN_ACCESS_CODE || '').trim();

    if (isProduction && !expectedCode) {
      res.status(503).json({
        ok: false,
        error: 'Configuration sécurité incomplète : définissez ADMIN_ACCESS_CODE dans les variables d’environnement de production.'
      });
      return;
    }

    if (!email || String(email).toLowerCase().trim() !== expectedEmail) {
      res.status(401).json({ ok: false, error: 'Identifiant administratrice incorrect.' });
      return;
    }

    const validCode = expectedCode || 'DJIFFA-ADMIN';
    if (!safeConstantTimeEqual(String(accessCode || ''), validCode)) {
      res.status(401).json({ ok: false, error: 'Code d’accès administratrice invalide.' });
      return;
    }

    const token = issueAdminToken(expectedEmail);
    res.json({
      ok: true,
      demoMode: !expectedCode,
      token,
      admin: {
        id: 'usr-admin-faith',
        name: 'Faith Ariola',
        email: expectedEmail,
        role: 'admin'
      }
    });
  });

  app.get('/api/auth/admin-session', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(401).json({ ok: false });
      return;
    }
    res.json({ ok: true, email: caller.email, role: 'admin' });
  });

  // 9. Protected Media Signed URL (Enforces enrollment or admin before issuing Supabase signed URL)
  app.post('/api/media/signed-url', async (req, res) => {
    if (!supabaseAdmin) {
      res.status(400).json({ ok: false, error: 'Supabase Storage non configuré côté serveur.' });
      return;
    }

    const caller = await resolveCallerAuth(req);
    if (!caller.userId && !caller.isAdmin) {
      res.status(401).json({ ok: false, error: 'Authentification requise pour accéder à cette ressource privée.' });
      return;
    }

    const { bucket, path: rawPath, courseId } = req.body || {};
    if (bucket !== 'course-pdfs' && bucket !== 'course-videos') {
      res.status(400).json({ ok: false, error: 'Bucket média non autorisé.' });
      return;
    }

    const safePath = sanitizeStorageObjectPath(String(rawPath || ''));
    if (!safePath) {
      res.status(400).json({ ok: false, error: 'Chemin de fichier invalide.' });
      return;
    }

    if (!caller.isAdmin) {
      if (!courseId || !caller.userId) {
        res.status(403).json({ ok: false, error: 'Accès refusé : inscription non vérifiée.' });
        return;
      }
      const { data: enrollment } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('user_id', caller.userId)
        .eq('course_id', String(courseId))
        .maybeSingle();

      if (!enrollment) {
        res.status(403).json({ ok: false, error: 'Vous devez acquérir cette formation pour lire cette ressource.' });
        return;
      }
    }

    const expiresIn = bucket === 'course-videos' ? 1800 : 300;
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(safePath, expiresIn);
    if (error || !data?.signedUrl) {
      res.status(404).json({ ok: false, error: error?.message || 'Fichier introuvable dans Supabase Storage.' });
      return;
    }

    res.json({ ok: true, signedUrl: data.signedUrl, expiresIn });
  });

  // 10. Admin Upload Signed URL Generator for Supabase Storage (PDF / Video / Logo)
  app.post('/api/media/upload-url', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Téléversement réservé à la Direction.' });
      return;
    }
    if (!supabaseAdmin) {
      res.status(400).json({ ok: false, error: 'Supabase Storage non configuré côté serveur.' });
      return;
    }

    const { bucket, filePath } = req.body || {};
    if (bucket !== 'course-pdfs' && bucket !== 'course-videos' && bucket !== 'brand-assets') {
      res.status(400).json({ ok: false, error: 'Bucket invalide.' });
      return;
    }
    const safePath = sanitizeStorageObjectPath(String(filePath || ''));
    if (!safePath) {
      res.status(400).json({ ok: false, error: 'Nom de fichier invalide.' });
      return;
    }

    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(safePath);
    if (error || !data) {
      res.status(500).json({ ok: false, error: error?.message || 'Impossible de préparer le téléversement.' });
      return;
    }

    const publicUrl =
      bucket === 'brand-assets'
        ? supabaseAdmin.storage.from('brand-assets').getPublicUrl(safePath).data.publicUrl
        : `sb://${bucket}/${safePath}`;

    res.json({ ok: true, signedUrl: data.signedUrl, token: data.token, path: safePath, storageRef: publicUrl });
  });

  // 11. Admin Migration Endpoint: Non-destructive sync of Catalog, Domains, Promos, Coaching, Settings -> Supabase
  app.post('/api/supabase/migrate', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Migration réservée à la Direction authentifiée.' });
      return;
    }
    if (!supabaseAdmin) {
      res.status(400).json({ ok: false, error: 'Clés SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY absentes sur le serveur.' });
      return;
    }

    const { domains, courses, promoCodes, coachingPrograms, testimonials, siteSettings } = req.body || {};

    try {
      const counts: Record<string, number> = {};

      if (Array.isArray(domains) && domains.length > 0) {
        const rows = domains.map((d: any, idx: number) => ({
          id: d.id,
          code: d.code,
          title: d.title,
          short_label: d.shortLabel,
          description: d.description,
          skills: d.skills || [],
          highlight_course_id: d.highlightCourseId || null,
          sort_order: idx
        }));
        const { error } = await supabaseAdmin.from('domains').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Domains: ${error.message}`);
        counts.domains = rows.length;
      }

      if (Array.isArray(courses) && courses.length > 0) {
        const publicRowsCore = courses.map((c: any) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          subtitle: c.subtitle,
          description: c.description,
          domain_id: c.domain,
          level: c.level,
          duration: c.duration,
          modules_count: c.modules?.length ?? c.modulesCount ?? 0,
          lessons_count: c.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) ?? c.lessonsCount ?? 0,
          price_xof: c.priceXOF,
          price_eur: c.priceEUR,
          price_usd: c.priceUSD,
          original_price_xof: c.originalPriceXOF || null,
          cover_image: canonicalizeBrandImageForStorage(c.coverImage),
          is_featured: Boolean(c.isFeatured),
          is_published: Boolean(c.isPublished),
          certificate_eligible: Boolean(c.certificateEligible),
          objectives: c.objectives || [],
          skills_acquired: c.skillsAcquired || [],
          resources_included: c.resourcesIncluded || [],
          // Public syllabus hides private video URLs, downloads URLs, model corrections, and quiz answer keys
          syllabus_modules: (c.modules || []).map((m: any) => ({
            id: m.id,
            order: m.order,
            title: m.title,
            description: m.description,
            lessons: (m.lessons || []).map((l: any) => ({
              id: l.id,
              moduleId: l.moduleId,
              title: l.title,
              duration: l.duration,
              type: l.type
            }))
          }))
        }));

        const publicRowsExtended = publicRowsCore.map((row: any, idx: number) => ({
          ...row,
          promo_active: Boolean(courses[idx].promoActive),
          promo_price_xof: courses[idx].promoPriceXOF || null,
          promo_price_eur: courses[idx].promoPriceEUR || null,
          promo_price_usd: courses[idx].promoPriceUSD || null
        }));

        let { error: courseErr } = await supabaseAdmin.from('courses').upsert(publicRowsExtended, { onConflict: 'id' });
        if (courseErr && /column|schema cache|42703|PGRST204/i.test(courseErr.message)) {
          const fallbackRes = await supabaseAdmin.from('courses').upsert(publicRowsCore, { onConflict: 'id' });
          courseErr = fallbackRes.error;
        }
        if (courseErr) throw new Error(`Courses: ${courseErr.message}`);

        const privateRows = courses.map((c: any) => ({
          course_id: c.id,
          modules_payload: c.modules || []
        }));
        const { error: privErr } = await supabaseAdmin
          .from('course_private_contents')
          .upsert(privateRows, { onConflict: 'course_id' });
        if (privErr) throw new Error(`Private contents: ${privErr.message}`);
        counts.courses = publicRowsCore.length;
      }

      if (Array.isArray(promoCodes) && promoCodes.length > 0) {
        const rows = promoCodes.map((p: any) => ({
          id: p.id,
          code: p.code,
          discount_percent: p.discountPercent,
          is_active: Boolean(p.isActive)
        }));
        const { error } = await supabaseAdmin.from('promo_codes').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Promo codes: ${error.message}`);
        counts.promoCodes = rows.length;
      }

      if (Array.isArray(coachingPrograms) && coachingPrograms.length > 0) {
        const rows = coachingPrograms.map((p: any) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          subtitle: p.subtitle,
          price_xof: p.priceXOF,
          price_eur: p.priceEUR,
          price_usd: p.priceUSD,
          duration: p.duration,
          badge: p.badge,
          features: p.features || []
        }));
        const { error } = await supabaseAdmin.from('coaching_programs').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Coaching: ${error.message}`);
        counts.coachingPrograms = rows.length;
      }

      if (Array.isArray(testimonials) && testimonials.length > 0) {
        const rows = testimonials.map((t: any) => ({
          id: t.id,
          author_name: t.authorName,
          author_role: t.authorRole,
          course_title: t.courseTitle,
          quote: t.quote,
          verified_date: t.verifiedDate,
          is_published: true
        }));
        const { error } = await supabaseAdmin.from('testimonials').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(`Testimonials: ${error.message}`);
        counts.testimonials = rows.length;
      }

      if (siteSettings) {
        const coreSettings = {
          id: 'default',
          agency_logo_url: siteSettings.agencyLogoDataUrl || null,
          contact_email: siteSettings.contactEmail,
          contact_phone: siteSettings.contactPhone,
          headquarters: siteSettings.headquarters
        };
        const extendedSettings = {
          ...coreSettings,
          academy_name: siteSettings.academyName,
          parent_agency_name: siteSettings.parentAgencyName,
          director_name: siteSettings.directorName,
          academy_presentation: siteSettings.academyPresentation,
          parent_agency_presentation: siteSettings.parentAgencyPresentation,
          director_bio: siteSettings.directorBio,
          whatsapp_number: siteSettings.whatsappNumber,
          support_hours: siteSettings.supportHours,
          instagram_url: siteSettings.instagramUrl,
          linkedin_url: siteSettings.linkedinUrl,
          youtube_url: siteSettings.youtubeUrl,
          legal_notices: siteSettings.legalNotices,
          terms_of_sale: siteSettings.termsOfSale
        };
        let { error } = await supabaseAdmin.from('site_settings').upsert(extendedSettings, { onConflict: 'id' });
        if (error && /column|schema cache|42703|PGRST204/i.test(error.message)) {
          const fallback = await supabaseAdmin.from('site_settings').upsert(coreSettings, { onConflict: 'id' });
          error = fallback.error;
        }
        if (error) throw new Error(`Settings: ${error.message}`);
        counts.siteSettings = 1;
      }

      res.json({
        ok: true,
        message: 'Données locales migrées et synchronisées dans Supabase avec succès.',
        counts
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur lors de la migration vers Supabase.'
      });
    }
  });

  // 12. Admin Data Fetch from Supabase (students, enrollments, progress, certificates, orders, coaching)
  app.get('/api/supabase/admin-data', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }
    if (!supabaseAdmin) {
      res.json({ ok: false, notConfigured: true });
      return;
    }

    try {
      const [
        { data: profiles },
        { data: enrollments },
        { data: progress },
        { data: certificates },
        { data: orders },
        { data: coachingRequests }
      ] = await Promise.all([
        supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('enrollments').select('*'),
        supabaseAdmin.from('lesson_progress').select('*'),
        supabaseAdmin.from('certificates').select('*'),
        supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('coaching_requests').select('*').order('created_at', { ascending: false })
      ]);

      res.json({
        ok: true,
        profiles: profiles || [],
        enrollments: enrollments || [],
        progress: progress || [],
        certificates: certificates || [],
        orders: orders || [],
        coachingRequests: coachingRequests || []
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Erreur chargement Supabase.' });
    }
  });

  // 13. Admin Action Sync to Supabase (single mutations & deletions)
  app.post('/api/supabase/admin-action', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Action réservée à la Direction.' });
      return;
    }
    if (!supabaseAdmin) {
      res.json({ ok: false, notConfigured: true });
      return;
    }

    const { action, payload } = req.body || {};
    try {
      switch (action) {
        case 'delete_course':
          await supabaseAdmin.from('courses').delete().eq('id', String(payload?.courseId || ''));
          break;
        case 'delete_domain':
          await supabaseAdmin.from('domains').delete().eq('id', String(payload?.domainId || ''));
          break;
        case 'delete_promo':
          await supabaseAdmin.from('promo_codes').delete().eq('id', String(payload?.promoId || ''));
          break;
        case 'delete_testimonial':
          await supabaseAdmin.from('testimonials').delete().eq('id', String(payload?.id || ''));
          break;
        case 'update_order_status': {
          const { reference, status } = payload || {};
          if (status === 'confirmed') {
            await activateOrderEnrollmentInSupabase(String(reference));
          } else if (status === 'refunded' || status === 'cancelled' || status === 'failed') {
            await revokeOrderEnrollmentInSupabase(String(reference), status);
          } else if (reference && status) {
            await supabaseAdmin.from('orders').update({ status }).eq('reference', String(reference));
          }
          break;
        }
        case 'update_coaching_status': {
          const updateExt: Record<string, unknown> = {
            status: payload?.status,
            meeting_link: payload?.meetingLink ?? null,
            admin_notes: payload?.adminNotes ?? null
          };
          const resExt = await supabaseAdmin
            .from('coaching_requests')
            .update(updateExt)
            .eq('id', String(payload?.id || ''));
          if (resExt.error && /column|schema cache|42703|PGRST204/i.test(resExt.error.message)) {
            await supabaseAdmin
              .from('coaching_requests')
              .update({
                status: payload?.status,
                meeting_link: payload?.meetingLink ?? null
              })
              .eq('id', String(payload?.id || ''));
          }
          break;
        }
        case 'update_contact_message_status': {
          const msgId = String(payload?.id || '');
          const nextStatus =
            payload?.status === 'read' || payload?.status === 'replied' || payload?.status === 'archived'
              ? payload.status
              : 'new';
          const idx = recentContactMessages.findIndex((m) => m.id === msgId);
          if (idx >= 0) {
            recentContactMessages[idx] = {
              ...recentContactMessages[idx],
              status: nextStatus,
              adminNotes: payload?.adminNotes !== undefined ? payload.adminNotes : recentContactMessages[idx].adminNotes
            };
          }
          const { error: msgUpdateErr } = await supabaseAdmin
            .from('contact_messages')
            .update({
              status: nextStatus,
              admin_notes: payload?.adminNotes ?? null
            })
            .eq('id', msgId);
          if (
            msgUpdateErr &&
            !(nextStatus === 'archived' && (msgUpdateErr.code === '23514' || /check constraint/i.test(msgUpdateErr.message))) &&
            msgUpdateErr.code !== '42P01' &&
            msgUpdateErr.code !== 'PGRST205'
          ) {
            throw new Error(msgUpdateErr.message);
          }
          break;
        }
        case 'grant_access':
          if (payload?.userId && payload?.courseId && /^[0-9a-f-]{36}$/i.test(String(payload.userId))) {
            await supabaseAdmin.from('enrollments').upsert(
              {
                user_id: String(payload.userId),
                course_id: String(payload.courseId),
                granted_by: 'admin'
              },
              { onConflict: 'user_id,course_id' }
            );
          }
          break;
        case 'revoke_access':
          if (payload?.userId && payload?.courseId && /^[0-9a-f-]{36}$/i.test(String(payload.userId))) {
            await supabaseAdmin
              .from('enrollments')
              .delete()
              .eq('user_id', String(payload.userId))
              .eq('course_id', String(payload.courseId));
          }
          break;
        default:
          res.status(400).json({ ok: false, error: 'Action inconnue.' });
          return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Erreur synchronisation Supabase.' });
    }
  });

  // 14. Centre de configuration et de lancement (Admin-only diagnostics — never leaks secret values)
  app.get('/api/launch-center/audit', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }

    const rootDir = path.resolve(__dirname);
    const hasFile = (rel: string) => fs.existsSync(path.join(rootDir, rel));
    const readTextSafe = (rel: string): string => {
      try {
        const full = path.join(rootDir, rel);
        return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
      } catch {
        return '';
      }
    };

    // Inspect local Git / Render / AI Studio runtime state safely (never fabricates repo/branch/commit)
    const officialRepoUrl = 'https://github.com/faiaboky21-ctrl/Djiffa-Academy-1';
    const hasGitHead = hasFile('.git/HEAD');
    const gitHeadRaw = readTextSafe('.git/HEAD').trim();
    const branchMatch = gitHeadRaw.match(/^ref:\s*refs\/heads\/(.+)$/);
    const localBranch = branchMatch ? branchMatch[1] : gitHeadRaw ? 'detached' : null;
    const headRefPath = localBranch && localBranch !== 'detached' ? `.git/refs/heads/${localBranch}` : null;
    const refCommitRaw = headRefPath ? readTextSafe(headRefPath).trim() : '';
    const detachedCommitRaw =
      localBranch === 'detached' && /^[0-9a-f]{7,40}$/i.test(gitHeadRaw) ? gitHeadRaw : '';

    const gitConfigRaw = readTextSafe('.git/config');
    const localRemoteConfigured = /\[remote "origin"\]/.test(gitConfigRaw);
    let localRemoteUrl: string | null = null;
    if (localRemoteConfigured) {
      const urlMatch = gitConfigRaw.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
      if (urlMatch?.[1]) {
        // Strip any embedded credentials if present
        localRemoteUrl = urlMatch[1].trim().replace(/\/\/[^@]+@/, '//');
      }
    }

    const renderRepoSlug = (process.env.RENDER_GIT_REPO_SLUG || '').trim() || null;
    const renderBranch = (process.env.RENDER_GIT_BRANCH || '').trim() || null;
    const renderCommitRaw = (process.env.RENDER_GIT_COMMIT || '').trim() || null;
    const isRenderRuntime = Boolean(
      process.env.RENDER === 'true' ||
        process.env.RENDER_SERVICE_ID ||
        process.env.RENDER_EXTERNAL_URL ||
        renderRepoSlug ||
        renderBranch ||
        renderCommitRaw
    );
    const isAiStudioRuntime = Boolean(
      !isRenderRuntime &&
        !hasGitHead &&
        (process.env.K_SERVICE ||
          process.env.K_REVISION ||
          (process.env.APP_URL || '').includes('.run.app'))
    );

    const renderRepoUrl = renderRepoSlug
      ? renderRepoSlug.startsWith('http')
        ? renderRepoSlug
        : `https://github.com/${renderRepoSlug}`
      : null;

    const branch = renderBranch || localBranch;
    const effectiveCommitRaw = renderCommitRaw || refCommitRaw || detachedCommitRaw;
    const headCommitShort =
      effectiveCommitRaw && /^[0-9a-f]{7,40}$/i.test(effectiveCommitRaw)
        ? effectiveCommitRaw.slice(0, 7)
        : null;
    const remoteOriginUrl = localRemoteUrl || renderRepoUrl;
    const remoteOriginConfigured = Boolean(localRemoteConfigured || renderRepoUrl);
    const gitInitialized = Boolean(hasGitHead || renderRepoUrl || renderCommitRaw);
    const githubSource: 'render' | 'local-git' | 'ai-studio' | 'none' = isRenderRuntime
      ? 'render'
      : hasGitHead
      ? 'local-git'
      : isAiStudioRuntime
      ? 'ai-studio'
      : 'none';

    const gitignoreRaw = readTextSafe('.gitignore');
    const gitignoreProtectsEnv = /(^|\n)\.env(\s|$)/.test(gitignoreRaw);

    let buildScriptReady = false;
    let startScriptReady = false;
    try {
      const pkgRaw = readTextSafe('package.json');
      if (pkgRaw) {
        const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, string> };
        buildScriptReady = Boolean(pkg.scripts?.build);
        startScriptReady = Boolean(pkg.scripts?.start && pkg.scripts.start.includes('server.ts'));
      }
    } catch {
      buildScriptReady = false;
      startScriptReady = false;
    }

    const payment = getServerPaymentStatus();
    const viteUrlSet = Boolean((process.env.VITE_SUPABASE_URL || '').trim());
    const viteAnonKeySet = Boolean((process.env.VITE_SUPABASE_ANON_KEY || '').trim());
    const serverUrlSet = Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim());
    const serviceRoleKeySet = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());

    const fedaPubRaw = (process.env.FEDAPAY_PUBLIC_KEY || '').trim();
    const fedaSecRaw = (process.env.FEDAPAY_SECRET_KEY || '').trim();
    const fedaPubSet = Boolean(fedaPubRaw);
    const fedaSecSet = Boolean(fedaSecRaw);
    const fedaWebhookSet = Boolean((process.env.FEDAPAY_WEBHOOK_SECRET || '').trim());
    const fedaKeyInspection = inspectFedaPayKeys(fedaPubRaw, fedaSecRaw, payment.mode);

    const kkiaPubSet = Boolean((process.env.KKIAPAY_PUBLIC_KEY || '').trim());
    const kkiaPrivSet = Boolean((process.env.KKIAPAY_PRIVATE_KEY || '').trim());
    const kkiaSecSet = Boolean((process.env.KKIAPAY_SECRET || '').trim());

    const cinetKeySet = Boolean((process.env.CINETPAY_API_KEY || '').trim());
    const cinetSiteSet = Boolean((process.env.CINETPAY_SITE_ID || '').trim());
    const cinetSecSet = Boolean((process.env.CINETPAY_SECRET_KEY || '').trim());

    const appUrlRaw = (process.env.APP_URL || '').trim();
    const appUrlConfigured = Boolean(appUrlRaw && !appUrlRaw.includes('MY_APP_URL'));

    res.json({
      ok: true,
      auditedAt: new Date().toISOString(),
      supabase: {
        viteUrlSet,
        viteAnonKeySet,
        serverUrlSet,
        serviceRoleKeySet,
        browserReady: viteUrlSet && viteAnonKeySet,
        serverReady: Boolean(supabaseAdmin),
        fullyConfigured: Boolean(supabaseAdmin && viteUrlSet && viteAnonKeySet),
        schemaFileReady: hasFile('supabase/schema.sql'),
        bucketsExpected: ['brand-assets', 'course-pdfs', 'course-videos']
      },
      github: {
        gitInitialized,
        branch,
        headCommitShort,
        remoteOriginConfigured,
        remoteOriginUrl,
        officialRepoUrl,
        source: githubSource,
        gitignoreProtectsEnv,
        readmeReady: hasFile('README.md'),
        deploymentGuideReady: hasFile('DEPLOYMENT.md')
      },
      render: {
        renderYamlReady: hasFile('render.yaml'),
        distBuilt: hasFile('dist/index.html'),
        buildScriptReady,
        startScriptReady,
        appUrlConfigured,
        isProductionMode: isProduction
      },
      payments: {
        activeProvider: payment.provider,
        mode: payment.mode,
        activeConfigured: payment.configured,
        webhookPath: '/api/payments/webhook',
        providers: {
          fedapay: {
            publicKeySet: fedaPubSet,
            secretKeySet: fedaSecSet,
            webhookSecretSet: fedaWebhookSet,
            configured: fedaPubSet && fedaSecSet,
            keyEnvironment: fedaKeyInspection.keyEnvironment,
            keyModeAligned: fedaKeyInspection.keyModeAligned
          },
          kkiapay: {
            publicKeySet: kkiaPubSet,
            privateKeySet: kkiaPrivSet,
            secretSet: kkiaSecSet,
            configured: kkiaPubSet && kkiaPrivSet && kkiaSecSet
          },
          cinetpay: {
            apiKeySet: cinetKeySet,
            siteIdSet: cinetSiteSet,
            secretKeySet: cinetSecSet,
            configured: cinetKeySet && cinetSiteSet
          }
        }
      },
      security: {
        adminEmail: (process.env.ADMIN_EMAIL || 'faith.ariola@djiffa-agency.com').toLowerCase(),
        customAdminCodeSet: Boolean((process.env.ADMIN_ACCESS_CODE || '').trim()),
        sessionSecretEnvSet: Boolean((process.env.ADMIN_SESSION_SECRET || '').trim()),
        serviceRoleServerOnly: !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
        paymentSecretsServerOnly:
          !process.env.VITE_FEDAPAY_SECRET_KEY &&
          !process.env.VITE_KKIAPAY_PRIVATE_KEY &&
          !process.env.VITE_CINETPAY_SECRET_KEY,
        gitignoreProtectsEnv,
        envExampleReady: hasFile('.env.example'),
        isProductionMode: isProduction
      }
    });
  });

  // 15. Live verification of Supabase DB tables & Storage buckets
  app.post('/api/launch-center/verify-supabase', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }

    const expectedBuckets = ['brand-assets', 'course-pdfs', 'course-videos'];
    if (!supabaseAdmin) {
      res.json({
        ok: false,
        status: supabaseAdminInitError ? 'error' : 'missing_connection',
        message:
          supabaseAdminInitError ||
          'Connexion manquante : SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY non injectée dans le serveur actif (vérifiez les Secrets et redémarrez l’aperçu).',
        tableCounts: null,
        tables: [],
        bucketsFound: [],
        missingBuckets: expectedBuckets,
        buckets: []
      });
      return;
    }

    try {
      const [domainsRes, coursesRes, profilesRes, ordersRes, bucketsRes] = await Promise.all([
        supabaseAdmin.from('domains').select('id', { count: 'exact' }).limit(1),
        supabaseAdmin.from('courses').select('id', { count: 'exact' }).limit(1),
        supabaseAdmin.from('profiles').select('id', { count: 'exact' }).limit(1),
        supabaseAdmin.from('orders').select('id', { count: 'exact' }).limit(1),
        supabaseAdmin.storage.listBuckets()
      ]);

      const tableChecks = [
        { name: 'domains', res: domainsRes },
        { name: 'courses', res: coursesRes },
        { name: 'profiles', res: profilesRes },
        { name: 'orders', res: ordersRes }
      ];
      const failedTable = tableChecks.find((t) => Boolean(t.res.error));

      if (failedTable?.res.error) {
        const dbError = failedTable.res.error;
        const httpStatus = failedTable.res.status;
        const httpStatusText = failedTable.res.statusText || '';
        const errText = [dbError.message, dbError.details, dbError.hint]
          .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          .join(' — ');
        const isMissingSchema =
          /does not exist|schema cache|42P01|PGRST205/i.test(errText) ||
          dbError.code === '42P01' ||
          dbError.code === 'PGRST205';

        const statusLabel = [
          httpStatus ? `HTTP ${httpStatus}` : '',
          httpStatusText,
          dbError.code ? `Code ${dbError.code}` : ''
        ]
          .filter(Boolean)
          .join(' · ');

        const detailMessage =
          errText ||
          (httpStatus === 401 || httpStatus === 403
            ? 'Authentification Supabase refusée : vérifiez que SUPABASE_SERVICE_ROLE_KEY correspond bien à la clé service_role du même projet que SUPABASE_URL.'
            : httpStatus
            ? `Échec de la requête sur la table « ${failedTable.name} » (${statusLabel}).`
            : `Erreur Supabase non détaillée sur la table « ${failedTable.name} ».`);

        res.json({
          ok: false,
          status: isMissingSchema ? 'external_action' : 'error',
          httpStatus: httpStatus || undefined,
          httpStatusText: httpStatusText || undefined,
          errorCode: dbError.code || undefined,
          message: isMissingSchema
            ? `Supabase joignable, mais les tables SQL sont absentes (${statusLabel || 'PGRST205'}). Exécutez supabase/schema.sql dans Supabase SQL Editor.`
            : `Erreur Supabase${statusLabel ? ` (${statusLabel})` : ''} : ${detailMessage}`,
          tableCounts: null,
          tables: [],
          bucketsFound: [],
          missingBuckets: expectedBuckets,
          buckets: []
        });
        return;
      }

      const tableCounts = {
        domains: domainsRes.count ?? 0,
        courses: coursesRes.count ?? 0,
        profiles: profilesRes.count ?? 0,
        orders: ordersRes.count ?? 0
      };

      const tables = [
        { name: 'profiles', ok: !profilesRes.error, count: profilesRes.count ?? 0 },
        { name: 'domains', ok: !domainsRes.error, count: domainsRes.count ?? 0 },
        { name: 'courses', ok: !coursesRes.error, count: coursesRes.count ?? 0 },
        { name: 'orders', ok: !ordersRes.error, count: ordersRes.count ?? 0 }
      ];

      const existingBucketMap = new Map((bucketsRes.data || []).map((b) => [b.name, b]));
      const bucketsFound = expectedBuckets.filter((b) => existingBucketMap.has(b));
      const missingBuckets = expectedBuckets.filter((b) => !existingBucketMap.has(b));
      const buckets = expectedBuckets.map((name) => ({
        name,
        ok: existingBucketMap.has(name),
        isPublic: Boolean(existingBucketMap.get(name)?.public)
      }));

      if (bucketsRes.error) {
        const storageErr = bucketsRes.error as { message?: string; statusCode?: string | number; status?: number };
        const storageCode = storageErr.status ?? storageErr.statusCode;
        const storageDetail =
          (typeof storageErr.message === 'string' && storageErr.message.trim()) ||
          (storageCode ? `Erreur Storage (${storageCode})` : 'Impossible de lister les buckets Supabase Storage.');
        res.json({
          ok: false,
          status: 'error',
          httpStatus: typeof storageCode === 'number' ? storageCode : undefined,
          errorCode: storageCode !== undefined ? String(storageCode) : undefined,
          message: `Tables SQL détectées, mais erreur Supabase Storage${storageCode ? ` (${storageCode})` : ''} : ${storageDetail}`,
          tableCounts,
          tables,
          bucketsFound: [],
          missingBuckets: expectedBuckets,
          buckets
        });
        return;
      }

      if (missingBuckets.length > 0) {
        res.json({
          ok: true,
          status: 'external_action',
          message: `Base SQL connectée (${tableCounts.courses} formation(s)), mais buckets manquants : ${missingBuckets.join(', ')}.`,
          tableCounts,
          tables,
          bucketsFound,
          missingBuckets,
          buckets
        });
        return;
      }

      res.json({
        ok: true,
        status: 'completed',
        message: `Supabase opérationnel : tables profiles, domains, courses, orders et les 3 buckets Storage actifs.`,
        tableCounts,
        tables,
        bucketsFound,
        missingBuckets: [],
        buckets
      });
    } catch (err) {
      const errMsg =
        err instanceof Error && err.message.trim() ? err.message.trim() : 'Erreur réseau lors du test Supabase.';
      res.json({
        ok: false,
        status: 'error',
        message: errMsg,
        tableCounts: null,
        tables: [],
        bucketsFound: [],
        missingBuckets: expectedBuckets,
        buckets: []
      });
    }
  });

  // 16. Live verification of FedaPay / KKiaPay / CinetPay API credentials
  app.post('/api/launch-center/verify-payment', async (req, res) => {
    const caller = await resolveCallerAuth(req);
    if (!caller.isAdmin) {
      res.status(403).json({ ok: false, error: 'Accès réservé à la Direction.' });
      return;
    }

    const reqProvider = String(req.body?.provider || process.env.PAYMENT_PROVIDER || 'fedapay').toLowerCase();
    const provider: 'fedapay' | 'kkiapay' | 'cinetpay' =
      reqProvider === 'kkiapay' ? 'kkiapay' : reqProvider === 'cinetpay' ? 'cinetpay' : 'fedapay';
    const mode: 'sandbox' | 'live' =
      (process.env.PAYMENT_MODE || 'sandbox').trim().toLowerCase() === 'live' ? 'live' : 'sandbox';

    try {
      if (provider === 'fedapay') {
        const pub = (process.env.FEDAPAY_PUBLIC_KEY || '').trim();
        const sec = (process.env.FEDAPAY_SECRET_KEY || '').trim();
        if (!pub || !sec) {
          res.json({
            ok: false,
            provider,
            status: 'missing_connection',
            message: 'Clés FEDAPAY_PUBLIC_KEY / FEDAPAY_SECRET_KEY manquantes côté serveur.'
          });
          return;
        }
        const keyCheck = inspectFedaPayKeys(pub, sec, mode);
        if (!keyCheck.keyModeAligned) {
          res.json({
            ok: false,
            provider,
            status: 'error',
            message: `Incohérence FedaPay : PAYMENT_MODE=${mode}, mais les clés configurées sont de type ${keyCheck.keyEnvironment.toUpperCase()}.`
          });
          return;
        }
        const baseUrl = mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
        const probe = await fetch(`${baseUrl}/currencies`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${sec}`, Accept: 'application/json' }
        });
        if (probe.ok) {
          res.json({
            ok: true,
            provider,
            status: 'completed',
            message: `API FedaPay (${mode === 'live' ? 'Live' : 'Sandbox'}) joignable et clés ${keyCheck.keyEnvironment} acceptées.`
          });
          return;
        }
        const rawErrBody = await probe.text().catch(() => '');
        let fedaErrDetail = '';
        if (rawErrBody) {
          try {
            const parsedErr = JSON.parse(rawErrBody) as {
              message?: string;
              errors?: Record<string, string[] | string>;
            };
            const parts: string[] = [];
            if (typeof parsedErr.message === 'string' && parsedErr.message.trim()) {
              parts.push(parsedErr.message.trim());
            }
            if (parsedErr.errors && typeof parsedErr.errors === 'object') {
              for (const [field, val] of Object.entries(parsedErr.errors)) {
                const msg = Array.isArray(val) ? val.join(', ') : String(val || '');
                if (msg.trim()) parts.push(`${field}: ${msg.trim()}`);
              }
            }
            fedaErrDetail = parts.join(' — ');
          } catch {
            fedaErrDetail = rawErrBody.trim().slice(0, 200);
          }
        }
        res.json({
          ok: false,
          provider,
          status: 'error',
          message:
            probe.status === 401 || probe.status === 403
              ? `Clé secrète FedaPay refusée (HTTP ${probe.status}). Vérifiez le mode Sandbox vs Live.${fedaErrDetail ? ` (${fedaErrDetail})` : ''}`
              : `Réponse API FedaPay inattendue (HTTP ${probe.status})${fedaErrDetail ? ` : ${fedaErrDetail}` : '.'}`
        });
        return;
      }

      if (provider === 'kkiapay') {
        const pub = (process.env.KKIAPAY_PUBLIC_KEY || '').trim();
        const priv = (process.env.KKIAPAY_PRIVATE_KEY || '').trim();
        const sec = (process.env.KKIAPAY_SECRET || '').trim();
        if (!pub || !priv || !sec) {
          res.json({
            ok: false,
            provider,
            status: 'missing_connection',
            message: 'Clés KKIAPAY_PUBLIC_KEY / KKIAPAY_PRIVATE_KEY / KKIAPAY_SECRET manquantes.'
          });
          return;
        }
        const baseUrl = mode === 'live' ? 'https://api.kkiapay.me' : 'https://api-sandbox.kkiapay.me';
        const probe = await fetch(`${baseUrl}/api/v1/transactions/status`, {
          method: 'POST',
          headers: {
            'x-api-key': pub,
            'x-private-key': priv,
            'x-secret-key': sec,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ transactionId: 'djiffa-health-probe' })
        });
        if (probe.status === 401 || probe.status === 403) {
          res.json({
            ok: false,
            provider,
            status: 'error',
            message: 'Identifiants KKiaPay refusés par le serveur (HTTP 401/403).'
          });
          return;
        }
        res.json({
          ok: true,
          provider,
          status: 'completed',
          message: `Passerelle KKiaPay (${mode === 'live' ? 'Live' : 'Sandbox'}) joignable et clés acceptées.`
        });
        return;
      }

      // CinetPay
      const cinetKey = (process.env.CINETPAY_API_KEY || '').trim();
      const cinetSite = (process.env.CINETPAY_SITE_ID || '').trim();
      if (!cinetKey || !cinetSite) {
        res.json({
          ok: false,
          provider,
          status: 'missing_connection',
          message: 'Variables CINETPAY_API_KEY / CINETPAY_SITE_ID manquantes côté serveur.'
        });
        return;
      }
      const probe = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: cinetKey,
          site_id: cinetSite,
          transaction_id: 'DJIFFA-PROBE'
        })
      });
      const data = (await probe.json().catch(() => ({}))) as { code?: string; message?: string };
      if (probe.status === 401 || probe.status === 403 || data.code === '608' || data.code === '624') {
        res.json({
          ok: false,
          provider,
          status: 'error',
          message: `Identifiants CinetPay refusés (${data.message || `code ${data.code || probe.status}`}).`
        });
        return;
      }
      res.json({
        ok: true,
        provider,
        status: 'completed',
        message: `API CinetPay joignable et identifiants reconnus (Site ID ${cinetSite}).`
      });
    } catch (err) {
      res.json({
        ok: false,
        provider,
        status: 'error',
        message: err instanceof Error ? err.message : 'Erreur réseau lors du test de paiement.'
      });
    }
  });

  // Ensure unmatched /api/* endpoints always return JSON (never Vite HTML fallback)
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ ok: false, error: 'Route API introuvable sur ce serveur.' });
  });

  // Vite middleware in dev, static serving in production
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DJIFFA ACADEMY server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DJIFFA ACADEMY server:', err);
  process.exit(1);
});
