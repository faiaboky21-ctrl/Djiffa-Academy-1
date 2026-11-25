/**
 * DJIFFA ACADEMY - Global Footer
 * Displays brand lockup, imported agency logo, language switcher (FR/EN), legal notices and payment info
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { safeExternalUrl } from '../lib/media';

export const Footer: React.FC = () => {
  const { navigateTo, openAuthModal, siteSettings, language, setLanguage, paymentConfig } = useApp();

  return (
    <footer className="bg-zinc-950 border-t border-zinc-800/80 text-zinc-400 text-xs pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          
          {/* Col 1: Brand & Parent Agency */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              {siteSettings.agencyLogoDataUrl ? (
                <img
                  src={siteSettings.agencyLogoDataUrl}
                  alt="DJIFFA DESIGN AGENCY"
                  className="w-9 h-9 rounded-lg object-contain bg-zinc-900 border border-[#D4AF37]/50 p-0.5"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] font-brand font-bold text-lg">
                  D
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-brand text-lg font-extrabold tracking-widest text-slate-100 uppercase">
                  {siteSettings.academyName}
                </span>
                <span className="text-[10px] text-zinc-400 tracking-wider uppercase font-medium">
                  Une branche de {siteSettings.parentAgencyName}
                </span>
              </div>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed max-w-sm">
              {siteSettings.academyPresentation}
            </p>

            <div className="text-[11px] text-zinc-400 pt-1">
              Créée et dirigée par <strong className="text-[#F3E5AB]">{siteSettings.directorName}</strong>.
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
              <span>{siteSettings.headquarters}</span>
              <span>·</span>
              <span>{siteSettings.contactEmail}</span>
              {siteSettings.whatsappNumber && (
                <>
                  <span>·</span>
                  <span>WhatsApp : {siteSettings.whatsappNumber}</span>
                </>
              )}
            </div>

            {(safeExternalUrl(siteSettings.instagramUrl) ||
              safeExternalUrl(siteSettings.linkedinUrl) ||
              safeExternalUrl(siteSettings.youtubeUrl)) && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                {safeExternalUrl(siteSettings.instagramUrl) && (
                  <a
                    href={safeExternalUrl(siteSettings.instagramUrl)!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-zinc-300 hover:text-[#D4AF37]"
                  >
                    <span>Instagram</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {safeExternalUrl(siteSettings.linkedinUrl) && (
                  <a
                    href={safeExternalUrl(siteSettings.linkedinUrl)!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-zinc-300 hover:text-[#D4AF37]"
                  >
                    <span>LinkedIn</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {safeExternalUrl(siteSettings.youtubeUrl) && (
                  <a
                    href={safeExternalUrl(siteSettings.youtubeUrl)!}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-zinc-300 hover:text-[#D4AF37]"
                  >
                    <span>YouTube</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Col 2: Navigation */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 block">
              Programmes
            </span>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigateTo('catalog')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Catalogue complet
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('course-detail', 'course-faith-ariola-methode')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer text-left"
                >
                  La Méthode Faith Ariola
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('course-detail', 'course-mode-virtuelle-ia')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Mode Virtuelle IA
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('course-detail', 'course-cinema-storytelling-ia')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Cinéma & Storytelling
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('coaching')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Accompagnement VIP
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Student & Admin Access */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 block">
              Espaces Membres
            </span>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => navigateTo('student-space')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Mon Espace Apprenant
                </button>
              </li>
              <li>
                <button
                  onClick={() => openAuthModal('student')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Connexion / Inscription
                </button>
              </li>
              <li>
                <button
                  onClick={() => openAuthModal('admin')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer text-[#F3E5AB] font-medium"
                >
                  Espace Direction (Admin)
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('about')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  À propos de l’Agence
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigateTo('contact')}
                  className="hover:text-[#D4AF37] transition-colors cursor-pointer"
                >
                  Contact & Support
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Payments & Multi-language */}
          <div className="lg:col-span-3 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 block">
              Paiements & Langue
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Paiement individuel via la passerelle FedaPay, selon les moyens activés et vérifiés sur le compte marchand.
            </p>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1.5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                Passerelle configurée : FedaPay
              </span>
              <div className="text-xs font-semibold text-slate-200">
                Mobile Money (MTN / Moov) & Visa / Mastercard
              </div>
              <span className="text-[10px] text-zinc-500 block">
                {paymentConfig.serverConfigured
                  ? paymentConfig.isTestMode
                    ? 'Environnement Sandbox / Test actif · Moyens affichés selon activation FedaPay'
                    : 'Moyens proposés selon activation vérifiée sur FedaPay'
                  : 'Moyens disponibles selon l’activation sur le compte FedaPay'}
              </span>
            </div>

            {/* Scalable i18n language selector */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Architecture sécurisée</span>
              </div>

              <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
                <button
                  onClick={() => setLanguage('fr')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    language === 'fr' ? 'bg-[#D4AF37] text-zinc-950' : 'text-zinc-400'
                  }`}
                >
                  FR
                </button>
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    language === 'en' ? 'bg-[#D4AF37] text-zinc-950' : 'text-zinc-400'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Legal & Copyright Bar */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-400">
          <div>
            © {new Date().getFullYear()} {siteSettings.academyName} — Une marque de {siteSettings.parentAgencyName}. Tous droits réservés.
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => navigateTo('legal-cgv')} className="hover:text-[#D4AF37] cursor-pointer">
              Conditions Générales de Vente
            </button>
            <button onClick={() => navigateTo('legal-mentions')} className="hover:text-[#D4AF37] cursor-pointer">
              Mentions Légales
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
