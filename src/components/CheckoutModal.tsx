/**
 * DJIFFA ACADEMY - Secure Checkout & Payment System
 * Supports real FedaPay / KKiaPay / CinetPay server sessions + verification
 * Falls back cleanly to clearly marked TEST/DEMO mode when gateway keys are not yet configured
 */

import React, { useState, useEffect } from 'react';
import { Course, PaymentMethod, Order } from '../types';
import { useApp } from '../context/AppContext';
import {
  X,
  ShieldCheck,
  Smartphone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  Lock,
  Info,
  Loader2,
  UserPlus,
  LogIn,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckoutModalProps {
  course: Course;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ course, onClose }) => {
  const {
    currentUser,
    formatPrice,
    currency,
    processPurchase,
    verifyExistingPayment,
    paymentConfig,
    supabaseReady,
    navigateTo,
    validatePromoCode,
    signUpWithEmailPassword,
    signInWithEmailPassword
  } = useApp();

  const [step, setStep] = useState<'account' | 'details' | 'processing' | 'confirmed' | 'failed'>(
    currentUser ? 'details' : 'account'
  );
  const [accountMode, setAccountMode] = useState<'register' | 'login'>('register');

  // Account creation/login fields
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authCountry, setAuthCountry] = useState('Bénin');
  const [authLoading, setAuthLoading] = useState(false);

  // Payment details
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('mtn_momo');
  const [phoneNumber, setPhoneNumber] = useState(currentUser?.phone || '');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number } | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Active external payment session state (FedaPay / CinetPay / KKiaPay)
  const [externalPaymentUrl, setExternalPaymentUrl] = useState<string | null>(null);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [pendingTxId, setPendingTxId] = useState<string>('');
  const [verifyingExternal, setVerifyingExternal] = useState(false);

  const discountRatio = appliedPromo ? appliedPromo.percent / 100 : 0;

  useEffect(() => {
    if (currentUser?.phone && !phoneNumber) {
      setPhoneNumber(currentUser.phone);
    }
  }, [currentUser?.id, currentUser?.phone, phoneNumber]);

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');
    setAuthLoading(true);
    try {
      if (accountMode === 'login') {
        const res = await signInWithEmailPassword(authEmail, authPassword);
        if (!res.ok) {
          setErrorMessage(res.message || 'Compte introuvable ou mot de passe incorrect.');
          return;
        }
        setStep('details');
      } else {
        if (!authName.trim() || !authEmail.trim()) {
          setErrorMessage('Veuillez renseigner votre nom complet et votre adresse email.');
          return;
        }
        if (supabaseReady && authPassword.length < 6) {
          setErrorMessage('Veuillez choisir un mot de passe d’au moins 6 caractères.');
          return;
        }
        const res = await signUpWithEmailPassword(authName, authEmail, authPassword, authPhone, authCountry);
        if (!res.ok) {
          setErrorMessage(res.message || 'Création de compte impossible.');
          return;
        }
        if (res.needsConfirmation) {
          setInfoMessage(res.message || 'Vérifiez votre email pour confirmer votre compte avant de poursuivre.');
          return;
        }
        if (authPhone) setPhoneNumber(authPhone);
        setStep('details');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erreur d’authentification.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleApplyPromo = () => {
    setErrorMessage('');
    const found = validatePromoCode(promoInput);
    if (found) {
      setAppliedPromo({ code: found.code, percent: found.discountPercent });
    } else {
      setAppliedPromo(null);
      setErrorMessage('Code promotionnel invalide ou expiré.');
    }
  };

  const handleVerifyExternalPayment = async () => {
    if (!pendingRef) return;
    setErrorMessage('');
    setVerifyingExternal(true);
    try {
      const verify = await verifyExistingPayment(pendingRef, pendingTxId || undefined, course.id);
      if (verify.verified && currentUser) {
        const baseAmount =
          currency === 'EUR' ? course.priceEUR : currency === 'USD' ? course.priceUSD : course.priceXOF;
        const finalAmount = Math.max(0, Math.round(baseAmount * (1 - discountRatio)));
        setConfirmedOrder({
          id: `ord-${Date.now()}`,
          reference: pendingRef,
          userId: currentUser.id,
          userName: currentUser.name,
          userEmail: currentUser.email,
          courseId: course.id,
          courseTitle: course.title,
          amount: finalAmount,
          currency,
          paymentMethod: selectedMethod,
          paymentProvider:
            paymentConfig.activeProvider === 'kkiapay'
              ? 'KKiaPay'
              : paymentConfig.activeProvider === 'cinetpay'
              ? 'CinetPay'
              : 'FedaPay',
          providerTransactionId: pendingTxId || undefined,
          status: 'confirmed',
          isDemoTransaction: paymentConfig.isTestMode,
          promoCodeUsed: appliedPromo?.code,
          customerPhone: phoneNumber || currentUser.phone,
          createdAt: new Date().toISOString(),
          confirmedAt: new Date().toISOString()
        });
        setStep('confirmed');
        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
        } catch {
          // ignore confetti error
        }
      } else {
        setErrorMessage(verify.message || 'Le paiement n’est pas encore confirmé par le prestataire.');
      }
    } finally {
      setVerifyingExternal(false);
    }
  };

  const handleExecutePayment = async (e: React.FormEvent, forceDemoTest = false) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentUser) {
      setStep('account');
      return;
    }

    if (selectedMethod.includes('momo') && !phoneNumber.trim()) {
      setErrorMessage('Veuillez renseigner un numéro Mobile Money valide.');
      return;
    }

    setStep('processing');

    try {
      const baseAmount =
        currency === 'EUR' ? course.priceEUR : currency === 'USD' ? course.priceUSD : course.priceXOF;
      const finalAmount = Math.max(0, Math.round(baseAmount * (1 - discountRatio)));

      // Real server payment session initialization
      if (paymentConfig.serverConfigured && !forceDemoTest) {
        const ref = `DJF-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
        const sessionRes = await fetch('/api/payments/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: ref,
            amount: finalAmount,
            currency,
            description: course.title,
            courseId: course.id,
            userId: currentUser.id,
            customerEmail: currentUser.email,
            customerName: currentUser.name,
            customerPhone: phoneNumber || currentUser.phone,
            paymentMethod: selectedMethod,
            promoCode: appliedPromo?.code
          })
        });
        const sessionData = await sessionRes.json();

        if (sessionData.ok && sessionData.paymentUrl) {
          setPendingRef(ref);
          if (sessionData.transactionId) setPendingTxId(String(sessionData.transactionId));
          setExternalPaymentUrl(sessionData.paymentUrl);
          setStep('details');
          return;
        }

        if (sessionData.ok && sessionData.provider === 'kkiapay') {
          setPendingRef(ref);
          setExternalPaymentUrl(`https://widget.kkiapay.me/?amount=${finalAmount}&key=${encodeURIComponent(sessionData.publicKey || '')}&sandbox=${sessionData.sandbox ? 'true' : 'false'}&callback=${encodeURIComponent(sessionData.callbackUrl || window.location.origin)}`);
          setStep('details');
          return;
        }

        if (!sessionData.ok) {
          setStep('failed');
          setErrorMessage(sessionData.error || sessionData.message || 'Impossible d’initialiser le paiement.');
          return;
        }
      }

      // Demo / Sandbox test flow clearly identified as TEST when gateway isn't configured
      await new Promise((res) => setTimeout(res, 900));
      const contactRef = selectedMethod.startsWith('card') ? 'Passerelle Carte Sécurisée' : phoneNumber;

      const result = await processPurchase(course.id, selectedMethod, contactRef, {
        promoCode: appliedPromo?.code,
        discountPercent: appliedPromo?.percent,
        isDemoMode: true
      });

      if (result.success) {
        setConfirmedOrder(result.order);
        setStep('confirmed');
        try {
          confetti({ particleCount: 70, spread: 65, origin: { y: 0.6 } });
        } catch (err) {
          console.error(err);
        }
      } else {
        setStep('failed');
        setErrorMessage(result.message || 'La transaction n’a pas pu être confirmée.');
      }
    } catch (err) {
      setStep('failed');
      setErrorMessage(err instanceof Error ? err.message : 'Erreur lors du traitement du paiement.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-8">

        {/* Top Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-zinc-900 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37]">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-brand text-sm sm:text-base font-bold text-slate-100">
                Commande & Paiement Sécurisé
              </h3>
              <p className="text-[11px] text-zinc-400">
                DJIFFA ACADEMY · Zéro stockage de données bancaires
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clear Server Gateway Status Notice */}
        <div
          className={`px-5 py-2.5 border-b flex items-center justify-between text-xs ${
            paymentConfig.serverConfigured
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
              : 'bg-amber-950/30 border-[#D4AF37]/30 text-[#F3E5AB]'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              {paymentConfig.serverConfigured
                ? `Passerelle active : ${paymentConfig.activeProvider.toUpperCase()} (${paymentConfig.isTestMode ? 'Sandbox' : 'Production'})`
                : 'Paiement non configuré côté serveur — Mode Démonstration (aucun débit réel)'}
            </span>
          </div>
        </div>

        {/* STEP 1 (if guest): Create Account or Sign In */}
        {step === 'account' && (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={course.coverImage}
                  alt={course.title}
                  className="w-12 h-12 rounded-lg object-cover border border-zinc-700 shrink-0"
                />
                <div>
                  <h4 className="font-brand text-xs sm:text-sm font-bold text-slate-100 line-clamp-1">
                    {course.title}
                  </h4>
                  <span className="text-[11px] text-zinc-400">Étape 1/2 : Identification apprenant</span>
                </div>
              </div>
              <span className="font-brand text-base font-bold text-[#D4AF37] tabular-nums shrink-0">
                {formatPrice(course.priceXOF)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => { setAccountMode('register'); setErrorMessage(''); setInfoMessage(''); }}
                className={`py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                  accountMode === 'register' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400'
                }`}
              >
                Créer mon compte
              </button>
              <button
                type="button"
                onClick={() => { setAccountMode('login'); setErrorMessage(''); setInfoMessage(''); }}
                className={`py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                  accountMode === 'login' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400'
                }`}
              >
                J’ai déjà un compte
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleAccountSubmit} className="space-y-3.5 text-xs">
              {accountMode === 'register' && (
                <div>
                  <label className="text-zinc-400 block mb-1">Nom et Prénoms *</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Ex: Amara Diallo"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              <div>
                <label className="text-zinc-400 block mb-1">Adresse Email *</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="apprenant@exemple.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {supabaseReady && (
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Mot de passe {accountMode === 'register' ? '* (6 caractères min.)' : '*'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={accountMode === 'register' ? 6 : undefined}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              {accountMode === 'register' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 block mb-1">Téléphone WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="+229 97 00 00 00"
                      className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 block mb-1">Pays</label>
                    <input
                      type="text"
                      value={authCountry}
                      onChange={(e) => setAuthCountry(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {accountMode === 'register' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>{authLoading ? 'Traitement...' : 'Continuer vers le paiement sécurisé'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: Payment Method & Confirmation */}
        {step === 'details' && currentUser && (
          <form onSubmit={(e) => handleExecutePayment(e, !paymentConfig.serverConfigured)} className="p-6 space-y-5">

            {/* External hosted checkout link & live verification panel */}
            {externalPaymentUrl && pendingRef && (
              <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-600/60 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-emerald-300">
                    Session sécurisée {paymentConfig.activeProvider.toUpperCase()} prête
                  </p>
                  <span className="font-mono text-[11px] text-zinc-300">Réf : {pendingRef}</span>
                </div>

                <a
                  href={externalPaymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold"
                >
                  <span>1. Ouvrir la page de paiement officielle</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <div className="pt-2 border-t border-emerald-800/50 space-y-2">
                  {paymentConfig.activeProvider !== 'cinetpay' && (
                    <input
                      type="text"
                      value={pendingTxId}
                      onChange={(e) => setPendingTxId(e.target.value)}
                      placeholder="ID de transaction (si demandé après validation)"
                      className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-[11px] text-slate-100"
                    />
                  )}
                  <button
                    type="button"
                    disabled={verifyingExternal}
                    onClick={handleVerifyExternalPayment}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifyingExternal ? 'animate-spin' : ''}`} />
                    <span>{verifyingExternal ? 'Vérification en cours...' : '2. J’ai terminé — Vérifier mon paiement'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Order Summary */}
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={course.coverImage}
                  alt={course.title}
                  className="w-14 h-14 rounded-lg object-cover border border-zinc-700 shrink-0"
                />
                <div>
                  <h4 className="font-brand text-xs sm:text-sm font-bold text-slate-100 line-clamp-1">
                    {course.title}
                  </h4>
                  <span className="text-[11px] text-zinc-400 block">
                    Compte : {currentUser.name} ({currentUser.email})
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-brand text-base sm:text-lg font-bold text-[#D4AF37] tabular-nums">
                  {formatPrice(course.priceXOF * (1 - discountRatio))}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-200 block">
                Choisissez votre moyen de paiement
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('mtn_momo')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    selectedMethod === 'mtn_momo'
                      ? 'bg-amber-950/20 border-[#D4AF37] text-white'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-[10px] font-bold text-amber-400">MTN MoMo</span>
                  </div>
                  <span className="text-xs font-semibold block">MTN Bénin</span>
                  <span className="text-[10px] text-zinc-500">Mobile Money</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('moov_momo')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    selectedMethod === 'moov_momo'
                      ? 'bg-amber-950/20 border-[#D4AF37] text-white'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-[10px] font-bold text-blue-400">Moov</span>
                  </div>
                  <span className="text-xs font-semibold block">Moov Money</span>
                  <span className="text-[10px] text-zinc-500">Bénin & UEMOA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('card_visa')}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    selectedMethod.startsWith('card')
                      ? 'bg-amber-950/20 border-[#D4AF37] text-white'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-[10px] font-bold text-zinc-300">Visa / MC</span>
                  </div>
                  <span className="text-xs font-semibold block">Carte Bancaire</span>
                  <span className="text-[10px] text-zinc-500">International</span>
                </button>
              </div>
            </div>

            {/* Method-specific safe instructions */}
            {selectedMethod.includes('momo') ? (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                <label className="text-xs text-slate-200 font-medium block">
                  Numéro Mobile Money ({selectedMethod === 'mtn_momo' ? 'MTN' : 'Moov'}) *
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+229 97 00 00 00"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
                <p className="text-[11px] text-zinc-400">
                  Vous validerez la transaction directement sur la page sécurisée du prestataire et par confirmation USSD sur votre téléphone.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 text-xs text-zinc-300">
                <div className="flex items-center gap-2 font-semibold text-slate-100">
                  <ShieldCheck className="w-4 h-4 text-[#D4AF37]" />
                  <span>Redirection vers le terminal bancaire crypté</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Pour votre sécurité, DJIFFA ACADEMY ne saisit et ne conserve jamais vos numéros complets de carte Visa/Mastercard ni votre code CVC. La saisie s’effectue exclusivement sur la page officielle du prestataire ({paymentConfig.activeProvider.toUpperCase()}).
                </p>
              </div>
            )}

            {/* Dynamic Promo Code */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Code promo (ex: DJIFFA2026)"
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-slate-100 uppercase"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                className="px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer"
              >
                Appliquer
              </button>
            </div>

            {appliedPromo && (
              <p className="text-xs text-emerald-400 font-medium">
                ✓ Code {appliedPromo.code} appliqué : -{appliedPromo.percent}% de réduction.
              </p>
            )}

            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!paymentConfig.serverConfigured && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-[#D4AF37]/30 text-[11px] text-zinc-300 space-y-1">
                <p className="font-semibold text-[#F3E5AB]">
                  Paiement réel non configuré sur le serveur
                </p>
                <p className="text-zinc-400">
                  Les clés API {paymentConfig.activeProvider.toUpperCase()} ne sont pas encore renseignées dans les variables serveur. Le bouton ci-dessous exécute une <strong>commande de test (DÉMO)</strong> sans aucun débit financier réel.
                </p>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-4 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-extrabold text-xs uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>
                {paymentConfig.serverConfigured
                  ? `Payer maintenant · ${formatPrice(course.priceXOF * (1 - discountRatio))}`
                  : `Simuler un achat de test (Démo) · ${formatPrice(course.priceXOF * (1 - discountRatio))}`}
              </span>
            </button>
          </form>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-12 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37] mx-auto flex items-center justify-center text-[#D4AF37]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <h4 className="font-brand text-lg font-bold text-slate-100">
              Vérification de la transaction...
            </h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Communication avec le serveur DJIFFA ACADEMY ({paymentConfig.serverConfigured ? 'Vérification prestataire' : 'Mode Test / Démonstration'}).
            </p>
          </div>
        )}

        {/* Confirmed */}
        {step === 'confirmed' && confirmedOrder && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-500 mx-auto flex items-center justify-center text-emerald-400 shadow-xl">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold">
                {confirmedOrder.isDemoTransaction ? 'Commande de Test Enregistrée (Démo)' : 'Paiement Réel Confirmé'}
              </span>
              <h4 className="font-brand text-2xl font-bold text-slate-100">
                Accès Débloqué avec Succès
              </h4>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Votre formation est maintenant accessible dans votre Espace Apprenant.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-left space-y-2.5 text-xs">
              <div className="flex justify-between pb-2 border-b border-zinc-800">
                <span className="text-zinc-400">Référence :</span>
                <span className="font-mono font-bold text-[#F3E5AB]">{confirmedOrder.reference}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-zinc-800">
                <span className="text-zinc-400">Formation :</span>
                <span className="font-semibold text-slate-200 line-clamp-1">{confirmedOrder.courseTitle}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-zinc-800">
                <span className="text-zinc-400">Montant :</span>
                <span className="font-mono font-bold text-[#D4AF37] tabular-nums">
                  {confirmedOrder.amount.toLocaleString('fr-FR')} {confirmedOrder.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Nature :</span>
                <span className="text-emerald-400 font-semibold">
                  {confirmedOrder.isDemoTransaction ? 'TEST / DÉMONSTRATION' : 'PAYÉ & VÉRIFIÉ'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  onClose();
                  navigateTo('player', course.id);
                }}
                className="flex-1 py-3.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Commencer la formation</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => window.print()}
                className="py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Imprimer le reçu</span>
              </button>
            </div>
          </div>
        )}

        {/* Failed */}
        {step === 'failed' && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-950 border border-red-500 mx-auto flex items-center justify-center text-red-400">
              <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h4 className="font-brand text-xl font-bold text-slate-100">Paiement non abouti</h4>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {errorMessage || 'La transaction a été interrompue ou refusée.'}
              </p>
            </div>
            <button
              onClick={() => setStep('details')}
              className="py-3 px-6 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Revenir au choix du paiement
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
