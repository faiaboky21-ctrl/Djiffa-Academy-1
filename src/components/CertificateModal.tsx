/**
 * DJIFFA ACADEMY - Official Luxury Certificate Modal, A4 PDF Download & Print System
 * Only issued when course completion & mandatory final exam criteria are genuinely met
 */

import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Printer, Award, ShieldCheck, Download, Loader2, AlertCircle } from 'lucide-react';

interface CertificateModalProps {
  courseId: string;
  onClose: () => void;
}

function formatDisplayDate(rawDate: string): string {
  const trimmed = String(rawDate || '').trim();
  if (!trimmed) return '';
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? new Date(`${trimmed}T12:00:00Z`) : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export const CertificateModal: React.FC<CertificateModalProps> = ({ courseId, onClose }) => {
  const {
    courses,
    currentUser,
    claimCertificate,
    downloadCertificatePdf,
    siteSettings,
    supabaseReady
  } = useApp();

  const course = courses.find((c) => c.id === courseId);
  const existingCert = currentUser?.certificates.find((c) => c.courseId === courseId);

  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfFeedback, setPdfFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    if (!currentUser || !courseId || existingCert) {
      setClaimError(null);
      return;
    }

    setClaiming(true);
    setClaimError(null);
    claimCertificate(courseId)
      .then((res) => {
        if (!active) return;
        if (!res.ok && res.error) {
          setClaimError(res.error);
        }
      })
      .finally(() => {
        if (active) setClaiming(false);
      });

    return () => {
      active = false;
    };
  }, [currentUser?.id, courseId, existingCert?.id]);

  const cert = existingCert;

  const handleDownloadPdf = async () => {
    if (!cert || downloadingPdf) return;
    setDownloadingPdf(true);
    setPdfFeedback(null);

    const res = await downloadCertificatePdf(cert.id, cert.verificationCode);
    setDownloadingPdf(false);

    if (res.ok) {
      setPdfFeedback({
        type: 'ok',
        message: 'Certificat PDF A4 paysage téléchargé avec succès.'
      });
    } else if (!supabaseReady) {
      setPdfFeedback({
        type: 'error',
        message:
          'Mode démonstration hors ligne : utilisez le bouton « Imprimer » pour enregistrer un PDF via votre navigateur.'
      });
    } else {
      setPdfFeedback({
        type: 'error',
        message: res.error || 'Impossible de télécharger le fichier PDF.'
      });
    }
  };

  if (claiming && !cert) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#D4AF37] mx-auto animate-spin" />
          <h3 className="font-brand text-lg font-bold text-slate-100">
            Vérification officielle de votre éligibilité...
          </h3>
          <p className="text-xs text-zinc-400">
            Contrôle de votre inscription, de votre progression à 100 % et de la validation des évaluations.
          </p>
        </div>
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-6 text-center space-y-4">
          <Award className="w-10 h-10 text-[#D4AF37] mx-auto" />
          <h3 className="font-brand text-lg font-bold text-slate-100">
            Conditions de réussite non encore remplies
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {claimError ||
              `Pour recevoir votre certificat officiel signé par Faith Ariola, vous devez compléter 100 % des leçons et valider l’examen final de la formation « ${course?.title || 'sélectionnée'} ».`}
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

  const displayCourseTitle = cert.courseTitle || course?.title || 'Formation DJIFFA ACADEMY';
  const displayLogoSrc = siteSettings.agencyLogoDataUrl || '/pwa-512x512.png';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden my-6">
        
        {/* Top Control Bar */}
        <div className="p-3.5 sm:p-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 print:hidden">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Award className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span className="font-semibold">Certificat Officiel · Format PDF A4 Paysage</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-3.5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E5C158] text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-60"
            >
              {downloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloadingPdf ? 'Génération PDF...' : 'Télécharger PDF (A4)'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold text-xs items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {pdfFeedback && (
          <div
            className={`mx-4 mt-4 p-3 rounded-xl border text-xs flex items-start gap-2 print:hidden ${
              pdfFeedback.type === 'ok'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                : 'bg-amber-950/60 border-amber-700 text-amber-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{pdfFeedback.message}</span>
          </div>
        )}

        {/* Printable / Preview Certificate (A4 Landscape Proportions) */}
        <div
          id="printable-certificate"
          className="p-6 sm:p-12 bg-[#08080A] text-slate-100 border-8 border-double border-[#D4AF37]/60 m-4 rounded-xl relative shadow-2xl"
          style={{ minHeight: '540px' }}
        >
          <div className="text-center space-y-3 relative z-10">
            <img
              src={displayLogoSrc}
              alt="Logo officiel DJIFFA ACADEMY"
              className="w-16 h-16 mx-auto rounded-xl object-contain bg-zinc-900 border-2 border-[#D4AF37] p-1 mb-2 shadow-lg"
            />

            <span className="text-[11px] sm:text-xs uppercase tracking-widest text-[#D4AF37] font-semibold block">
              {siteSettings.parentAgencyName} · {siteSettings.academyName}
            </span>

            <h1 className="font-brand text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-wider text-[#F3E5AB]">
              CERTIFICAT D’ACCOMPLISSEMENT
            </h1>

            <p className="text-[11px] sm:text-xs text-zinc-400 uppercase tracking-widest">
              Délivré officiellement par {siteSettings.academyName} en reconnaissance de l’excellence pratique
            </p>
          </div>

          <div className="my-8 sm:my-10 text-center space-y-4 relative z-10">
            <span className="text-xs text-zinc-400 italic">Ce certificat officiel atteste que</span>

            <div className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-wide border-b border-[#D4AF37]/50 pb-2 inline-block px-6 sm:px-10">
              {cert.studentName}
            </div>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-xl mx-auto leading-relaxed pt-2">
              a suivi avec succès l’intégralité des modules pédagogiques, travaux pratiques et évaluations certifiantes du programme :
            </p>

            <div className="font-brand text-base sm:text-xl font-bold text-[#D4AF37] px-4 py-2.5 rounded-lg bg-zinc-900/80 border border-[#D4AF37]/30 inline-block max-w-full">
              « {displayCourseTitle} »
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end relative z-10 text-xs">
            <div className="space-y-1 text-center sm:text-left text-zinc-400">
              <span className="text-[10px] uppercase tracking-wider block text-zinc-500">
                Date de délivrance
              </span>
              <span className="text-slate-200 font-semibold block">{formatDisplayDate(cert.issuedDate)}</span>
              <span className="text-[10px] uppercase tracking-wider block text-zinc-500 mt-2">
                Numéro unique de vérification
              </span>
              <span className="font-mono text-[#D4AF37] font-bold block">{cert.verificationCode}</span>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E6C658] via-[#D4AF37] to-[#8C701E] p-1 shadow-2xl flex items-center justify-center">
                <div className="w-full h-full rounded-full border-2 border-dashed border-zinc-950 flex flex-col items-center justify-center text-zinc-950 text-center">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                  <span className="font-brand text-[7.5px] font-black uppercase tracking-tighter leading-tight">
                    SCEAU OFFICIEL
                  </span>
                </div>
              </div>
            </div>

            <div className="text-center sm:text-right space-y-1">
              <span className="text-[10px] uppercase tracking-wider block text-zinc-500">
                Direction Générale
              </span>
              <div className="flex justify-center sm:justify-end pt-1">
                <svg
                  viewBox="0 0 180 42"
                  className="w-36 h-9 text-[#F3E5AB]"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 28 C 24 6, 44 6, 40 28 C 52 14, 70 16, 74 27 C 84 12, 102 18, 110 26 C 122 30, 138 18, 152 22"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M8 35 C 58 38, 112 32, 160 34"
                    stroke="#D4AF37"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="font-serif italic text-base sm:text-lg text-[#F3E5AB] font-bold">
                {cert.directorName || siteSettings.directorName}
              </div>
              <span className="text-slate-300 font-medium block">Directrice & Fondatrice</span>
              <span className="text-[10px] text-zinc-500 block">{siteSettings.parentAgencyName}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
