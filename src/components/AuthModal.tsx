/**
 * DJIFFA ACADEMY - Authentication Modal
 * Supports both Real Supabase Auth (Email + Password) when configured and Local Demo Fallback
 * Strictly separates Student Accounts from Private Director/Admin Access
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { X, GraduationCap, ShieldCheck, Lock, UserPlus, LogIn, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    supabaseReady,
    adminSessionExpiredNotice,
    signInWithEmailPassword,
    signUpWithEmailPassword,
    loginAsDemoStudent,
    loginAdminServer
  } = useApp();

  const [tab, setTab] = useState<'login' | 'register' | 'admin'>(
    authModalMode === 'admin' ? 'admin' : 'login'
  );

  // Student fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Bénin');

  // Admin fields
  const [adminEmail, setAdminEmail] = useState('faith.ariola@djiffa-agency.com');
  const [adminCode, setAdminCode] = useState('');

  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(authModalMode === 'admin' ? 'admin' : 'login');
    setError('');
    setInfoMessage('');
  }, [authModalMode, authModalOpen]);

  if (!authModalOpen) return null;

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      const res = await signInWithEmailPassword(email, password);
      if (!res.ok) {
        setError(res.message || 'Connexion impossible.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    if (!name.trim() || !email.trim()) {
      setError('Veuillez renseigner votre nom complet et votre email.');
      return;
    }
    if (supabaseReady && password.length < 6) {
      setError('Votre mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      const res = await signUpWithEmailPassword(name, email, password, phone, country);
      if (!res.ok) {
        setError(res.message || 'Inscription impossible.');
      } else if (res.needsConfirmation) {
        setInfoMessage(res.message || 'Compte créé ! Vérifiez votre email pour activer votre accès.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);
    const res = await loginAdminServer(adminEmail, adminCode);
    setLoading(false);
    if (!res.ok) {
      setError(res.message || 'Accès refusé.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-8">

        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37]">
              {tab === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-brand text-sm sm:text-base font-bold text-slate-100">
                {tab === 'admin' ? 'Accès Direction Privé' : 'Espace Membre DJIFFA ACADEMY'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {tab === 'admin'
                  ? 'Réservé à Faith Ariola'
                  : supabaseReady
                  ? 'Compte Cloud Sécurisé Supabase'
                  : 'Apprenants & Créateurs'}
              </p>
            </div>
          </div>

          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="p-2 bg-zinc-900/70 border-b border-zinc-800 grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); setInfoMessage(''); }}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'login' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); setInfoMessage(''); }}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'register' ? 'bg-[#D4AF37] text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Créer un compte
          </button>
          <button
            type="button"
            onClick={() => { setTab('admin'); setError(''); setInfoMessage(''); }}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'admin' ? 'bg-zinc-800 text-[#F3E5AB] border border-[#D4AF37]/40' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Direction
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Student Login */}
          {tab === 'login' && (
            <form onSubmit={handleStudentLogin} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Adresse email de votre compte *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amara.diallo@exemple.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {supabaseReady && (
                <div>
                  <label className="text-zinc-400 block mb-1">Mot de passe *</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'Connexion...' : 'Accéder à mon espace'}</span>
              </button>

              <div className="pt-3 border-t border-zinc-800/80 space-y-2">
                {!supabaseReady && (
                  <div className="p-3 rounded-lg bg-zinc-900/70 border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
                    <Info className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <span>
                      Mode Local : variables Supabase non renseignées. Vos données sont sauvegardées sur cet appareil et vous pouvez tester le compte démo ci-dessous.
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={loginAsDemoStudent}
                  className="w-full py-2.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold cursor-pointer"
                >
                  Explorer avec le compte Apprenant Démo (Amara Diallo)
                </button>
              </div>
            </form>
          )}

          {/* Student Registration */}
          {tab === 'register' && (
            <form onSubmit={handleStudentRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Nom et Prénoms *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Kossi Mensah"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Adresse Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kossi@exemple.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {supabaseReady && (
                <div>
                  <label className="text-zinc-400 block mb-1">Mot de passe * (6 caractères min.)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choisissez un mot de passe sécurisé"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Téléphone WhatsApp</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+229 97..."
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Pays</label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Bénin"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'Création du compte...' : 'Créer mon compte Apprenant'}</span>
              </button>
            </form>
          )}

          {/* Admin Private Login */}
          {tab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4 text-xs">
              {adminSessionExpiredNotice && (
                <div className="p-3 rounded-lg bg-amber-950/60 border border-[#D4AF37]/60 text-[11px] text-[#F3E5AB] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                  <span>{adminSessionExpiredNotice}</span>
                </div>
              )}

              <div className="p-3 rounded-lg bg-amber-950/20 border border-[#D4AF37]/30 text-[11px] text-[#F3E5AB] flex items-start gap-2">
                <Lock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>
                  Espace strictement réservé à la Direction. La vérification s’effectue côté serveur.
                  <span className="block text-zinc-400 mt-1">
                    Code de démonstration par défaut (si non défini dans les variables serveur) : <strong className="font-mono text-white">DJIFFA-ADMIN</strong>
                  </span>
                </span>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Email Directrice *</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Code d’accès Administratrice *</label>
                <input
                  type="password"
                  required
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{loading ? 'Vérification...' : 'Ouvrir le Tableau de Bord Direction'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
