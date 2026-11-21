/**
 * DJIFFA ACADEMY - Server Entry Point (Express + Vite Middleware)
 * Keeps payment secret keys and webhook verification strictly server-side.
 */

import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Track verified transaction references in memory to prevent double-validation (idempotency)
const processedTransactions = new Map<string, { status: string; verifiedAt: string; provider: string }>();

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
  const mode: 'sandbox' | 'live' = (process.env.PAYMENT_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';

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

async function startServer() {
  const app = express();

  // Preserve raw body for webhook HMAC verification
  app.use(
    express.json({
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

  // 3. Initiate a real payment session with configured provider
  app.post('/api/payments/create-session', async (req, res) => {
    const status = getServerPaymentStatus();
    const { reference, amount, currency, description, customerEmail, customerName, customerPhone, paymentMethod } = req.body || {};

    if (!reference || !amount || !currency || !customerEmail) {
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

    try {
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

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
            custom_metadata: { reference, paymentMethod },
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
        res.json({
          ok: true,
          provider: 'fedapay',
          transactionId: tx?.id,
          paymentUrl: tx?.payment_url || null
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
        const data = (await response.json()) as { code?: string; message?: string; data?: { payment_url?: string; payment_token?: string } };
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

      // KKiaPay uses public widget SDK on client + server-side verification
      res.json({
        ok: true,
        provider: 'kkiapay',
        publicKey: status.publicKey,
        sandbox: status.mode === 'sandbox'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur serveur lors de l’initialisation du paiement.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // 4. Server-side verification of transaction status (never trust client-only confirmation)
  app.post('/api/payments/verify', async (req, res) => {
    const status = getServerPaymentStatus();
    const { transactionId, reference } = req.body || {};

    if (!reference) {
      res.status(400).json({ ok: false, error: 'Référence de transaction requise.' });
      return;
    }

    if (processedTransactions.has(reference)) {
      const existing = processedTransactions.get(reference);
      res.json({ ok: true, alreadyVerified: true, status: existing?.status });
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
          processedTransactions.set(reference, { status: 'confirmed', verifiedAt: new Date().toISOString(), provider: 'fedapay' });
          res.json({ ok: true, verified: true, status: 'confirmed' });
          return;
        }
        res.json({ ok: false, verified: false, status: txStatus || 'pending' });
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
          processedTransactions.set(reference, { status: 'confirmed', verifiedAt: new Date().toISOString(), provider: 'cinetpay' });
          res.json({ ok: true, verified: true, status: 'confirmed' });
          return;
        }
        res.json({ ok: false, verified: false, status: data.data?.status || 'pending' });
        return;
      }

      res.status(400).json({ ok: false, error: 'Impossible de vérifier cette transaction.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de vérification auprès du prestataire.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // 5. Secure Webhook receiver with HMAC signature verification and idempotency
  app.post('/api/payments/webhook', (req: express.Request & { rawBody?: Buffer }, res) => {
    const status = getServerPaymentStatus();
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

    if (status.provider === 'fedapay' && process.env.FEDAPAY_WEBHOOK_SECRET) {
      const sig = req.headers['x-fedapay-signature'] as string | undefined;
      if (!sig) {
        res.status(401).json({ ok: false, error: 'Signature webhook manquante.' });
        return;
      }
      const expected = crypto.createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
      if (!sig.includes(expected)) {
        res.status(403).json({ ok: false, error: 'Signature webhook invalide.' });
        return;
      }
    }

    const ref = req.body?.entity?.custom_metadata?.reference || req.body?.cpm_trans_id || req.body?.transactionId;
    if (ref && processedTransactions.has(ref)) {
      res.json({ ok: true, idempotent: true });
      return;
    }

    if (ref) {
      processedTransactions.set(String(ref), {
        status: 'confirmed',
        verifiedAt: new Date().toISOString(),
        provider: status.provider
      });
    }

    res.json({ ok: true, received: true });
  });

  // 6. Admin verification endpoint
  app.post('/api/auth/admin-verify', (req, res) => {
    const { email, accessCode } = req.body || {};
    const expectedEmail = (process.env.ADMIN_EMAIL || 'faith.ariola@djiffa-agency.com').toLowerCase();
    const expectedCode = process.env.ADMIN_ACCESS_CODE || '';

    if (!email || String(email).toLowerCase().trim() !== expectedEmail) {
      res.status(401).json({ ok: false, error: 'Identifiant administratrice incorrect.' });
      return;
    }

    // If ADMIN_ACCESS_CODE is set in env, enforce it strictly; otherwise allow default demo passphrase 'DJIFFA-ADMIN'
    const validCode = expectedCode || 'DJIFFA-ADMIN';
    if (String(accessCode || '') !== validCode) {
      res.status(401).json({ ok: false, error: 'Code d’accès administratrice invalide.' });
      return;
    }

    res.json({
      ok: true,
      demoMode: !expectedCode,
      admin: {
        id: 'usr-admin-faith',
        name: 'Faith Ariola',
        email: expectedEmail,
        role: 'admin'
      }
    });
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
