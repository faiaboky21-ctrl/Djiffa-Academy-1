/**
 * DJIFFA ACADEMY - Official Contact & Support Section
 * Headquarters in Cotonou, Benin & International Assistance
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, MapPin, Send, MessageCircle, Clock, CheckCircle } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const { siteSettings } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Renseignements Formation');
  const [message, setMessage] = useState('');
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    setSentSuccess(true);
  };

  return (
    <section className="py-16 sm:py-24 bg-[#08080A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold block">
            Échange & Accompagnement
          </span>
          <h1 className="font-brand text-3xl sm:text-4xl font-bold text-slate-100">
            Contacter DJIFFA ACADEMY
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Une question sur un programme ? Un besoin d’accompagnement sur-mesure pour votre entreprise ? Notre équipe vous répond sous 24 heures.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          
          {/* Left Column: Direct Contact Info (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-6 shadow-xl">
              
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] font-semibold">
                  Maison Mère
                </span>
                <h3 className="font-brand text-lg font-bold text-slate-100">
                  DJIFFA DESIGN AGENCY
                </h3>
                <p className="text-xs text-zinc-400">
                  Pôle Formation & Éducation Numérique
                </p>
              </div>

              <div className="space-y-4 text-xs text-zinc-300">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[#D4AF37] shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-200 block">Siège Principal</strong>
                    <span>{siteSettings.headquarters}</span>
                    <span className="text-zinc-500 block text-[11px]">Rayonnement Afrique de l’Ouest & International</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[#D4AF37] shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-200 block">Courrier Électronique</strong>
                    <span className="text-[#F3E5AB]">{siteSettings.contactEmail}</span>
                    <span className="text-zinc-500 block text-[11px]">Réponse sous 24h ouvrées</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[#D4AF37] shrink-0 mt-0.5">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-200 block">WhatsApp Direction & Support</strong>
                    <span>{siteSettings.contactPhone}</span>
                    <span className="text-zinc-500 block text-[11px]">Assistance inscription & paiement</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[#D4AF37] shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-slate-200 block">Horaires de Permanence</strong>
                    <span className="block">Lundi – Vendredi : 08h30 – 19h00 (GMT+1)</span>
                    <span className="block">Samedi : 09h00 – 14h00</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Interactive Form (7 cols) */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-6">
              
              {!sentSuccess ? (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    Envoyez un message direct à l’académie
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-zinc-400 block mb-1">Votre Nom et Prénoms *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Faith Ariola"
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
                        placeholder="email@exemple.com"
                        className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Objet de votre demande</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="Renseignements Formation">Renseignements sur une formation</option>
                      <option value="Accompagnement VIP">Accompagnement VIP avec Faith Ariola</option>
                      <option value="Paiement Mobile Money">Question sur le paiement Mobile Money</option>
                      <option value="Partenariat Marque">Partenariat marque / Formation entreprise</option>
                      <option value="Autre">Autre demande</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-zinc-400 block mb-1">Votre Message *</label>
                    <textarea
                      rows={5}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Expliquez-nous votre besoin ou votre question..."
                      className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Envoyer mon message</span>
                  </button>
                </form>
              ) : (
                <div className="p-8 text-center space-y-4 bg-emerald-950/40 border border-emerald-500/50 rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-emerald-900 border border-emerald-400 mx-auto flex items-center justify-center text-emerald-300">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-brand text-lg font-bold text-slate-100">
                    Message Transmis à DJIFFA ACADEMY
                  </h3>
                  <p className="text-xs text-zinc-300 max-w-sm mx-auto">
                    Merci {name}. Votre message a été remis à l’équipe de Faith Ariola. Nous vous répondrons dans les plus brefs délais à l’adresse {email}.
                  </p>
                  <button
                    onClick={() => {
                      setSentSuccess(false);
                      setMessage('');
                    }}
                    className="text-xs text-[#D4AF37] hover:underline"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
