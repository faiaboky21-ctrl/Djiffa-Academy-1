/**
 * DJIFFA ACADEMY - Official Luxury Certificate Modal & Print System
 * Only issued when course completion criteria are genuinely met
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { X, Printer, Award, ShieldCheck } from 'lucide-react';

interface CertificateModalProps {
  courseId: string;
  onClose: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({ courseId, onClose }) => {
  const { courses, currentUser, claimCertificate, siteSettings } = useApp();

  const course = courses.find((c) => c.id === courseId) || courses[0];
  const cert = currentUser?.certificates.find((c) => c.courseId === courseId) || claimCertificate(course.id);

  if (!cert) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-6 text-center space-y-4">
          <Award className="w-10 h-10 text-[#D4AF37] mx-auto" />
          <h3 className="font-brand text-lg font-bold text-slate-100">
            Conditions de réussite non encore remplies
          </h3>
          <p className="text-xs text-zinc-400">
            Pour recevoir votre certificat officiel signé par Faith Ariola, vous devez compléter 100% des leçons et valider les évaluations de la formation « {course.title} ».
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-zinc-950 font-bold text-xs cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-8">
        
        {/* Top Control Bar */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60 print:hidden">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Award className="w-4 h-4 text-[#D4AF37]" />
            <span className="font-semibold">Certificat Officiel d’Aptitude DJIFFA ACADEMY</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer / Exporter PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate */}
        <div
          id="printable-certificate"
          className="p-8 sm:p-14 bg-[#08080A] text-slate-100 border-8 border-double border-[#D4AF37]/50 m-4 rounded-xl relative shadow-2xl"
          style={{ minHeight: '560px' }}
        >
          <div className="text-center space-y-3 relative z-10">
            {siteSettings.agencyLogoDataUrl ? (
              <img
                src={siteSettings.agencyLogoDataUrl}
                alt="DJIFFA DESIGN AGENCY"
                className="w-16 h-16 mx-auto rounded-xl object-contain bg-zinc-900 border-2 border-[#D4AF37] p-1 mb-2"
              />
            ) : (
              <div className="w-16 h-16 mx-auto rounded-xl bg-zinc-900 border-2 border-[#D4AF37] flex items-center justify-center text-[#D4AF37] shadow-lg mb-2">
                <span className="font-brand text-3xl font-extrabold tracking-wider">D</span>
              </div>
            )}

            <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold block">
              DJIFFA DESIGN AGENCY PRÉSENTE
            </span>

            <h1 className="font-brand text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-wider text-[#F3E5AB]">
              CERTIFICAT D’ACCOMPLISSEMENT
            </h1>

            <p className="text-xs text-zinc-400 uppercase tracking-widest">
              Délivré par DJIFFA ACADEMY en reconnaissance de l’excellence pratique
            </p>
          </div>

          <div className="my-10 text-center space-y-4 relative z-10">
            <span className="text-xs text-zinc-400 italic">Ce certificat atteste que</span>

            <div className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-wide border-b border-[#D4AF37]/40 pb-2 inline-block px-8">
              {cert.studentName}
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-xl mx-auto leading-relaxed pt-2">
              a suivi avec succès l’intégralité des modules théoriques, techniques et pratiques du programme d’excellence :
            </p>

            <div className="font-brand text-lg sm:text-xl font-bold text-[#D4AF37] px-4 py-2 rounded-lg bg-zinc-900/60 border border-[#D4AF37]/20 inline-block">
              « {course.title} »
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end relative z-10 text-xs">
            <div className="space-y-1 text-left text-zinc-400">
              <span className="text-[10px] uppercase tracking-wider block text-zinc-500">
                Date de délivrance
              </span>
              <span className="text-slate-200 font-semibold block">{cert.issuedDate}</span>
              <span className="text-[10px] uppercase tracking-wider block text-zinc-500 mt-2">
                Identifiant de vérification
              </span>
              <span className="font-mono text-[#D4AF37] font-bold block">{cert.verificationCode}</span>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E6C658] via-[#D4AF37] to-[#8C701E] p-1 shadow-2xl flex items-center justify-center">
                <div className="w-full h-full rounded-full border-2 border-dashed border-zinc-950 flex flex-col items-center justify-center text-zinc-950 text-center">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                  <span className="font-brand text-[8px] font-black uppercase tracking-tighter">
                    SCEAU D’OR
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="text-[10px] uppercase tracking-wider block text-zinc-500">
                Direction Générale
              </span>
              <div className="font-serif italic text-xl text-[#F3E5AB] font-bold py-1">
                {cert.directorName}
              </div>
              <span className="text-slate-300 font-medium block">Directrice & Fondatrice</span>
              <span className="text-[10px] text-zinc-500 block">DJIFFA DESIGN AGENCY</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
