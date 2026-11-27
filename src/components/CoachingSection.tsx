/**
 * DJIFFA ACADEMY - Coaching & Mentorship Programs
 * Individual VIP (Faith Ariola) & Collective Bootcamp cohorts
 * With interactive application form and direct synchronization with student & admin dashboards
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sparkles,
  CheckCircle,
  Send,
  ShieldCheck,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const CoachingSection: React.FC = () => {
  const {
    formatPrice,
    currentUser,
    submitCoachingRequest,
    navigateTo,
    coachingPrograms,
    siteSettings
  } = useApp();

  const [selectedProgramType, setSelectedProgramType] = useState<'individual' | 'collective'>('individual');
  const [userName, setUserName] = useState(currentUser?.name || '');
  const [userEmail, setUserEmail] = useState(currentUser?.email || '');
  const [userPhone, setUserPhone] = useState(currentUser?.phone || '');
  const [needDescription, setNeedDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setUserName((prev) => prev || currentUser.name);
      setUserEmail((prev) => prev || currentUser.email);
      setUserPhone((prev) => prev || currentUser.phone || '');
    }
  }, [currentUser]);

  const activeProgram = coachingPrograms.find(p => p.type === selectedProgramType) || coachingPrograms[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!userName.trim() || !userEmail.trim() || !userPhone.trim() || !needDescription.trim() || !preferredDate) {
      setSubmitError('Veuillez remplir tous les champs obligatoires (nom, email, WhatsApp, date souhaitée et besoin).');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await submitCoachingRequest({
      userName: userName.trim(),
      userEmail: userEmail.trim(),
      userPhone: userPhone.trim(),
      type: selectedProgramType,
      programTitle: activeProgram.title,
      needDescription: needDescription.trim(),
      preferredDate
    });

    setSubmitting(false);

    if (!result.ok) {
      setSubmitError(
        result.error || 'Impossible d’enregistrer votre demande d’accompagnement. Veuillez réessayer.'
      );
      return;
    }

    setSubmittedSuccess(true);
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="py-12 sm:py-20 bg-[#08080A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-[#D4AF37]/30 text-xs text-[#F3E5AB]">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Accompagnement Sur-Mesure {siteSettings.academyName}</span>
          </div>

          <h1 className="font-brand text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-100">
            Propulsez vos Projets avec un Mentorat d’Élite
          </h1>

          <p className="text-sm sm:text-base text-zinc-400">
            Bénéficiez des retours directs, de l’expertise technique et de la direction stratégique de {siteSettings.directorName} et des experts de {siteSettings.parentAgencyName}.
          </p>
        </div>

        {/* 2 Offer Cards: Individual VIP vs Collective Cohort */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {coachingPrograms.map((prog) => {
            const isSelected = selectedProgramType === prog.type;
            const isIndividual = prog.type === 'individual';

            return (
              <div
                key={prog.id}
                className={`p-6 sm:p-8 rounded-3xl border transition-all duration-300 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-zinc-950 border-[#D4AF37] shadow-2xl ring-1 ring-[#D4AF37]/40'
                    : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="space-y-6">
                  
                  {/* Top Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF37]">
                      {isIndividual ? 'Format 1-sur-1 Privé' : 'Format Collectif / Cohorte'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300">
                      {prog.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-brand text-xl sm:text-2xl font-bold text-slate-100">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      {prog.subtitle}
                    </p>
                  </div>

                  {/* Pricing Box */}
                  <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block">
                      Tarif d’investissement
                    </span>
                    <div className="font-brand text-2xl font-bold text-[#D4AF37] tabular-nums mt-0.5">
                      {formatPrice(prog.priceXOF)}
                    </div>
                    <span className="text-[11px] text-zinc-400 block mt-1">
                      {prog.duration}
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-semibold text-slate-200 block">
                      Le programme comprend :
                    </span>
                    <ul className="space-y-2 text-xs text-zinc-300">
                      {prog.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>

                <div className="pt-8">
                  <button
                    onClick={() => {
                      setSelectedProgramType(prog.type);
                      const formElem = document.getElementById('coaching-form');
                      if (formElem) formElem.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-[#D4AF37] text-zinc-950 shadow-lg'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-slate-200 border border-zinc-700'
                    }`}
                  >
                    <span>{isSelected ? '✓ Formule Sélectionnée' : 'Choisir cette formule'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* Application Form Section */}
        <div id="coaching-form" className="max-w-2xl mx-auto rounded-3xl bg-zinc-950 border border-zinc-800 p-6 sm:p-10 shadow-2xl space-y-6">
          
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold">
              Candidature & Prise de Rendez-vous
            </span>
            <h2 className="font-brand text-2xl font-bold text-slate-100">
              Formulaire de Demande d’Accompagnement
            </h2>
            <p className="text-xs text-zinc-400">
              Formule sélectionnée : <strong className="text-[#F3E5AB]">{activeProgram.title}</strong>
            </p>
          </div>

          {!submittedSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Votre Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ex: Amara Diallo"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="amara@exemple.com"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 block mb-1">Téléphone WhatsApp (avec indicatif pays) *</label>
                  <input
                    type="tel"
                    required
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    placeholder="+229 97 00 00 00"
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Date souhaitée pour le 1er rendez-vous *</label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Décrivez votre projet, vos attentes et vos défis créatifs ou commerciaux *
                </label>
                <textarea
                  rows={4}
                  required
                  value={needDescription}
                  onChange={(e) => setNeedDescription(e.target.value)}
                  placeholder="Ex: Je souhaite produire une publicité pour une marque locale au Bénin mais je bute sur la cohérence des personnages et le closing commercial..."
                  className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>
                  Les rendez-vous ne sont confirmés qu'après validation effective par {siteSettings.directorName} afin de garantir un engagement mutuel de haute qualité.
                </span>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-700/70 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Enregistrement en cours...' : 'Soumettre ma demande d’accompagnement'}</span>
              </button>
            </form>
          ) : (
            <div className="p-8 text-center space-y-4 bg-emerald-950/40 border border-emerald-600/50 rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-emerald-900 border border-emerald-400 mx-auto flex items-center justify-center text-emerald-300">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-brand text-lg font-bold text-slate-100">
                Demande Reçue avec Succès !
              </h3>
              <p className="text-xs text-zinc-300 max-w-md mx-auto">
                Merci {userName}. {siteSettings.directorName} et l'équipe pédagogique étudient votre dossier. Vous recevrez une réponse personnalisée par email et WhatsApp pour confirmer votre créneau.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => navigateTo('student-space')}
                  className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs"
                >
                  Suivre ma demande dans mon Espace
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
