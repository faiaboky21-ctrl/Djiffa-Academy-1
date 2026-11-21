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

// Idempotency store for verified payment references
const processedTransactions = new Map<string, { status: string; verifiedAt: string; provider: string }>();

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

interface PaymentStatusInfo {
  configured: boolean;
  provider: 'fedapay' | 'kkiapay' | 'cinetpay';
  mode: 'sandbox' | 'live';
  publicKey: string | null;
  siteId: string | null;
  supportedMethods: string[];
  message: string;
}

function getServerPaymentStatus(): PaymentStatusInfo {
  const providerEnv = (process.env.PAYMENT_PROVIDER || 'fedapay').toLowerCase();
  const provider: 'fedapay' | 'kkiapay' | 'cinetpay' =
    providerEnv === 'kkiapay' ? 'kkiapay' : providerEnv === 'cinetpay' ? 'cinetpay' : 'fedapay';
  const mode: 'sandbox' | 'live' =
    (process.env.PAYMENT_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';

  if (provider === 'fedapay') {
    const pub = process.env.FEDAPAY_PUBLIC_KEY || '';
    const sec = process.env.FEDAPAY_SECRET_KEY || '';
    const configured = Boolean(pub && sec);
    return {
      configured,
      provider: 'fedapay',
      mode,
      publicKey: pub || null,
      siteId: null,
      supportedMethods: ['MTN Mobile Money', 'Moov Money', 'Visa', 'Mastercard'],
      message: configured
        ? `Passerelle FedaPay connectée (${mode === 'live' ? 'Production' : 'Sandbox'}).`
        : 'Paiement non configuré côté serveur (clés FEDAPAY_PUBLIC_KEY / FEDAPAY_SECRET_KEY absentes).'
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
  if (!supabaseAdmin) return;
  const { data: orderRow } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!orderRow) return;

  await supabaseAdmin
    .from('orders')
    .update({
      status: 'confirmed',
      provider_transaction_id: providerTransactionId || orderRow.provider_transaction_id,
      confirmed_at: orderRow.confirmed_at || new Date().toISOString()
    })
    .eq('reference', reference);

  if (orderRow.user_id && orderRow.course_id) {
    await supabaseAdmin.from('enrollments').upsert(
      {
        user_id: orderRow.user_id,
        course_id: orderRow.course_id,
        granted_by: `payment:${orderRow.payment_provider}`
      },
      { onConflict: 'user_id,course_id' }
    );
  }
}

async function revokeOrderEnrollmentInSupabase(reference: string, newStatus: 'refunded' | 'cancelled' | 'failed') {
  if (!supabaseAdmin) return;
  const { data: orderRow } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!orderRow) return;

  await supabaseAdmin.from('orders').update({ status: newStatus }).eq('reference', reference);

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
}

function sanitizeStorageObjectPath(rawPath: string): string | null {
  const normalized = rawPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.includes('\0')) {
    return null;
  }
  return normalized;
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
        customCodeConfigured: customAdminPass
      },
      environment: isProduction ? 'production' : 'development'
    });
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

    if (!reference || amount === undefined || !currency || !customerEmail) {
      res.status(400).json({ ok: false, error: 'Paramètres de commande incomplets.' });
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

    // Record pending order server-side in Supabase when connected
    if (supabaseAdmin && courseId) {
      await supabaseAdmin.from('orders').upsert(
        {
          id: `ord-${Date.now()}`,
          reference: String(reference),
          user_id: userId && /^[0-9a-f-]{36}$/i.test(String(userId)) ? String(userId) : null,
          user_name: String(customerName || 'Apprenant'),
          user_email: String(customerEmail),
          course_id: String(courseId),
          course_title: String(description || 'Formation DJIFFA ACADEMY'),
          amount: Math.round(Number(amount)),
          currency: currency === 'EUR' ? 'EUR' : currency === 'USD' ? 'USD' : 'XOF',
          payment_method: String(paymentMethod || 'mtn_momo'),
          payment_provider:
            status.provider === 'fedapay' ? 'FedaPay' : status.provider === 'kkiapay' ? 'KKiaPay' : 'CinetPay',
          status: 'pending',
          is_demo_transaction: status.mode !== 'live',
          promo_code_used: promoCode ? String(promoCode) : null,
          customer_phone: customerPhone ? String(customerPhone) : null
        },
        { onConflict: 'reference' }
      );
    }

    try {
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`).replace(/\/$/, '');

      if (status.provider === 'fedapay') {
        const baseUrl = status.mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
        const response = await fetch(`${baseUrl}/transactions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: description || `Formation DJIFFA ACADEMY - ${reference}`,
            amount: Math.round(Number(amount)),
            currency: { iso: currency === 'EUR' ? 'EUR' : currency === 'USD' ? 'USD' : 'XOF' },
            callback_url: `${appUrl}/?payment_ref=${encodeURIComponent(reference)}`,
            custom_metadata: { reference, paymentMethod, courseId },
            customer: {
              firstname: String(customerName || 'Apprenant').split(' ')[0],
              lastname: String(customerName || 'DJIFFA').split(' ').slice(1).join(' ') || 'Academy',
              email: customerEmail,
              phone_number: customerPhone ? { number: customerPhone, country: 'bj' } : undefined
            }
          })
        });

        const data = (await response.json()) as {
          'v1/transaction'?: { id?: number; reference?: string; payment_url?: string };
          message?: string;
        };
        if (!response.ok) {
          res.status(502).json({ ok: false, error: data.message || 'Erreur API FedaPay.' });
          return;
        }

        const tx = data['v1/transaction'];
        let paymentUrl = tx?.payment_url || null;

        // Generate hosted checkout token URL via FedaPay /transactions/:id/token when needed
        if (!paymentUrl && tx?.id) {
          const tokenRes = await fetch(`${baseUrl}/transactions/${encodeURIComponent(String(tx.id))}/token`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          if (tokenRes.ok) {
            const tokenData = (await tokenRes.json()) as { url?: string; token?: string };
            paymentUrl = tokenData.url || null;
          }
        }

        res.json({
          ok: true,
          provider: 'fedapay',
          transactionId: tx?.id,
          paymentUrl
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
            amount: Math.round(Number(amount)),
            currency: currency === 'EUR' ? 'EUR' : currency === 'USD' ? 'USD' : 'XOF',
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
          paymentToken: data.data?.payment_token || null
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

    if (processedTransactions.has(String(reference))) {
      const existing = processedTransactions.get(String(reference));
      res.json({ ok: true, alreadyVerified: true, verified: existing?.status === 'confirmed', status: existing?.status });
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

    try {
      if (status.provider === 'fedapay' && transactionId) {
        const baseUrl = status.mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
        const response = await fetch(`${baseUrl}/transactions/${encodeURIComponent(String(transactionId))}`, {
          headers: { Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}` }
        });
        const data = (await response.json()) as { 'v1/transaction'?: { status?: string } };
        const txStatus = data['v1/transaction']?.status;
        if (txStatus === 'approved') {
          processedTransactions.set(String(reference), {
            status: 'confirmed',
            verifiedAt: new Date().toISOString(),
            provider: 'fedapay'
          });
          await activateOrderEnrollmentInSupabase(String(reference), String(transactionId));
          res.json({ ok: true, verified: true, status: 'confirmed' });
          return;
        }
        res.json({ ok: false, verified: false, status: txStatus || 'pending' });
        return;
      }

      if (status.provider === 'kkiapay' && transactionId) {
        const baseUrl = status.mode === 'live' ? 'https://api.kkiapay.me' : 'https://api-sandbox.kkiapay.me';
        const response = await fetch(`${baseUrl}/api/v1/transactions/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.KKIAPAY_PUBLIC_KEY || '',
            'x-private-key': process.env.KKIAPAY_PRIVATE_KEY || '',
            'x-secret': process.env.KKIAPAY_SECRET || ''
          },
          body: JSON.stringify({ transactionId: String(transactionId) })
        });
        const data = (await response.json()) as { status?: string };
        if (data.status === 'SUCCESS') {
          processedTransactions.set(String(reference), {
            status: 'confirmed',
            verifiedAt: new Date().toISOString(),
            provider: 'kkiapay'
          });
          await activateOrderEnrollmentInSupabase(String(reference), String(transactionId));
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
            transaction_id: reference
          })
        });
        const data = (await response.json()) as { code?: string; data?: { status?: string } };
        if (data.code === '00' && data.data?.status === 'ACCEPTED') {
          processedTransactions.set(String(reference), {
            status: 'confirmed',
            verifiedAt: new Date().toISOString(),
            provider: 'cinetpay'
          });
          await activateOrderEnrollmentInSupabase(String(reference), String(transactionId || reference));
          res.json({ ok: true, verified: true, status: 'confirmed' });
          return;
        }
        res.json({ ok: false, verified: false, status: data.data?.status || 'pending' });
        return;
      }

      res.status(400).json({ ok: false, error: 'Identifiant de transaction manquant pour la vérification.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de vérification auprès du prestataire.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // 6. Secure Webhook receiver (HMAC verification + idempotency + Supabase activation/revocation)
  app.post('/api/payments/webhook', async (req: express.Request & { rawBody?: Buffer }, res) => {
    const status = getServerPaymentStatus();
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

    if (status.provider === 'fedapay' && process.env.FEDAPAY_WEBHOOK_SECRET) {
      const sig = req.headers['x-fedapay-signature'] as string | undefined;
      if (!sig) {
        res.status(401).json({ ok: false, error: 'Signature webhook FedaPay manquante.' });
        return;
      }
      const expected = crypto.createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
      if (!sig.includes(expected)) {
        res.status(403).json({ ok: false, error: 'Signature webhook FedaPay invalide.' });
        return;
      }
    }

    if (status.provider === 'cinetpay' && process.env.CINETPAY_SECRET_KEY) {
      const xToken = req.headers['x-token'] as string | undefined;
      if (xToken) {
        const expected = crypto
          .createHmac('sha256', process.env.CINETPAY_SECRET_KEY)
          .update(rawBody)
          .digest('hex');
        if (xToken !== expected) {
          res.status(403).json({ ok: false, error: 'Signature webhook CinetPay invalide.' });
          return;
        }
      }
    }

    if (status.provider === 'kkiapay' && process.env.KKIAPAY_SECRET) {
      const xSecret = req.headers['x-kkiapay-secret'] as string | undefined;
      if (xSecret && xSecret !== process.env.KKIAPAY_SECRET) {
        res.status(403).json({ ok: false, error: 'Secret webhook KKiaPay invalide.' });
        return;
      }
    }

    const ref = req.body?.entity?.custom_metadata?.reference || req.body?.cpm_trans_id || req.body?.transactionId;
    const txId = req.body?.entity?.id || req.body?.transactionId;
    const eventName = String(req.body?.name || req.body?.event || '').toLowerCase();
    const entityStatus = String(req.body?.entity?.status || req.body?.status || '').toLowerCase();

    if (ref) {
      const cleanRef = String(ref);
      const isRefundOrFailure =
        eventName.includes('refund') ||
        eventName.includes('declined') ||
        eventName.includes('cancel') ||
        entityStatus === 'refunded' ||
        entityStatus === 'declined' ||
        entityStatus === 'canceled';

      if (isRefundOrFailure) {
        const mappedStatus = entityStatus === 'refunded' || eventName.includes('refund') ? 'refunded' : 'cancelled';
        processedTransactions.set(cleanRef, {
          status: mappedStatus,
          verifiedAt: new Date().toISOString(),
          provider: status.provider
        });
        await revokeOrderEnrollmentInSupabase(cleanRef, mappedStatus);
      } else {
        if (processedTransactions.get(cleanRef)?.status === 'confirmed') {
          res.json({ ok: true, idempotent: true });
          return;
        }
        processedTransactions.set(cleanRef, {
          status: 'confirmed',
          verifiedAt: new Date().toISOString(),
          provider: status.provider
        });
        await activateOrderEnrollmentInSupabase(cleanRef, txId ? String(txId) : undefined);
      }
    }

    res.json({ ok: true, received: true });
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
    await revokeOrderEnrollmentInSupabase(String(reference), 'refunded');
    res.json({ ok: true, status: 'refunded' });
  });

  // 8. Admin Verification & Session Token
  app.post('/api/auth/admin-verify', (req, res) => {
    const { email, accessCode } = req.body || {};
    const expectedEmail = (process.env.ADMIN_EMAIL || 'faith.ariola@djiffa-agency.com').toLowerCase();
    const expectedCode = process.env.ADMIN_ACCESS_CODE || '';

    if (!email || String(email).toLowerCase().trim() !== expectedEmail) {
      res.status(401).json({ ok: false, error: 'Identifiant administratrice incorrect.' });
      return;
    }

    const validCode = expectedCode || 'DJIFFA-ADMIN';
    if (String(accessCode || '') !== validCode) {
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
        const publicRows = courses.map((c: any) => ({
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
          cover_image: c.coverImage,
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

        const { error: courseErr } = await supabaseAdmin.from('courses').upsert(publicRows, { onConflict: 'id' });
        if (courseErr) throw new Error(`Courses: ${courseErr.message}`);

        const privateRows = courses.map((c: any) => ({
          course_id: c.id,
          modules_payload: c.modules || []
        }));
        const { error: privErr } = await supabaseAdmin
          .from('course_private_contents')
          .upsert(privateRows, { onConflict: 'course_id' });
        if (privErr) throw new Error(`Private contents: ${privErr.message}`);
        counts.courses = publicRows.length;
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
        const { error } = await supabaseAdmin.from('site_settings').upsert(
          {
            id: 'default',
            agency_logo_url: siteSettings.agencyLogoDataUrl || null,
            contact_email: siteSettings.contactEmail,
            contact_phone: siteSettings.contactPhone,
            headquarters: siteSettings.headquarters
          },
          { onConflict: 'id' }
        );
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
        case 'update_coaching_status':
          await supabaseAdmin
            .from('coaching_requests')
            .update({
              status: payload?.status,
              meeting_link: payload?.meetingLink ?? null
            })
            .eq('id', String(payload?.id || ''));
          break;
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

    // Inspect local Git repository state safely via fs (no shell execution)
    const gitInitialized = hasFile('.git/HEAD');
    const gitHeadRaw = readTextSafe('.git/HEAD').trim();
    const branchMatch = gitHeadRaw.match(/^ref:\s*refs\/heads\/(.+)$/);
    const branch = branchMatch ? branchMatch[1] : gitHeadRaw ? 'detached' : null;
    const headRefPath = branch && branch !== 'detached' ? `.git/refs/heads/${branch}` : null;
    const headCommitRaw = headRefPath ? readTextSafe(headRefPath).trim() : '';
    const headCommitShort = headCommitRaw ? headCommitRaw.slice(0, 7) : null;
    const gitConfigRaw = readTextSafe('.git/config');
    const remoteOriginConfigured = /\[remote "origin"\]/.test(gitConfigRaw);
    let remoteOriginUrl: string | null = null;
    if (remoteOriginConfigured) {
      const urlMatch = gitConfigRaw.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
      if (urlMatch?.[1]) {
        // Strip any embedded credentials if present
        remoteOriginUrl = urlMatch[1].trim().replace(/\/\/[^@]+@/, '//');
      }
    }

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

    const fedaPubSet = Boolean((process.env.FEDAPAY_PUBLIC_KEY || '').trim());
    const fedaSecSet = Boolean((process.env.FEDAPAY_SECRET_KEY || '').trim());
    const fedaWebhookSet = Boolean((process.env.FEDAPAY_WEBHOOK_SECRET || '').trim());

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
            configured: fedaPubSet && fedaSecSet
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
        supabaseAdmin.from('domains').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('courses').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
        supabaseAdmin.storage.listBuckets()
      ]);

      const dbError = domainsRes.error || coursesRes.error || profilesRes.error || ordersRes.error;
      if (dbError) {
        const isMissingSchema =
          /does not exist|schema cache|42P01|PGRST205/i.test(dbError.message) ||
          dbError.code === '42P01' ||
          dbError.code === 'PGRST205';

        res.json({
          ok: false,
          status: isMissingSchema ? 'external_action' : 'error',
          message: isMissingSchema
            ? 'Supabase joignable, mais les tables SQL sont absentes. Exécutez supabase/schema.sql dans Supabase SQL Editor.'
            : `Erreur Supabase : ${dbError.message}`,
          tableCounts: null,
          bucketsFound: [],
          missingBuckets: expectedBuckets
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
        res.json({
          ok: false,
          status: 'error',
          message: `Tables SQL détectées, mais impossible de lister Supabase Storage : ${bucketsRes.error.message}`,
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
      res.json({
        ok: false,
        status: 'error',
        message: err instanceof Error ? err.message : 'Erreur réseau lors du test Supabase.',
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
      (process.env.PAYMENT_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';

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
        const baseUrl = mode === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
        const probe = await fetch(`${baseUrl}/transactions?per_page=1`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${sec}`, Accept: 'application/json' }
        });
        if (probe.ok) {
          res.json({
            ok: true,
            provider,
            status: 'completed',
            message: `API FedaPay (${mode === 'live' ? 'Live' : 'Sandbox'}) joignable et clé secrète acceptée.`
          });
          return;
        }
        res.json({
          ok: false,
          provider,
          status: 'error',
          message:
            probe.status === 401 || probe.status === 403
              ? 'Clé secrète FedaPay refusée (HTTP 401/403). Vérifiez le mode Sandbox vs Live.'
              : `Réponse API FedaPay inattendue (HTTP ${probe.status}).`
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
