import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'drawer';
  onAfterAction?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  onAfterAction,
}) => {
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  if (isInstalled) return null;
  if (!isInstallable && !isIOS) return null;

  const handleClick = async () => {
    if (isIOS && !isInstallable) {
      setShowIOSModal(true);
      return;
    }
    await promptInstall();
    onAfterAction?.();
  };

  return (
    <>
      {variant === 'drawer' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full py-2.5 px-4 text-xs font-semibold text-[#F3E5AB] bg-zinc-900 hover:bg-zinc-800 border border-[#D4AF37]/40 rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#D4AF37]" />
          <span>Installer l’application</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          title="Installer DJIFFA ACADEMY sur votre appareil"
          aria-label="Installer DJIFFA ACADEMY"
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#F3E5AB] bg-zinc-900/90 hover:bg-zinc-800 rounded-md border border-[#D4AF37]/40 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>Installer</span>
        </button>
      )}

      {showIOSModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-ios-install-title"
          onClick={() => setShowIOSModal(false)}
        >
          <div
            className="w-full max-w-sm bg-zinc-950 border border-[#D4AF37]/40 rounded-2xl p-6 shadow-2xl space-y-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-[#D4AF37]/40 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-[#D4AF37]" />
                </div>
                <div>
                  <h3
                    id="pwa-ios-install-title"
                    className="font-brand text-sm font-bold text-slate-100"
                  >
                    Installer DJIFFA ACADEMY
                  </h3>
                  <p className="text-[11px] text-zinc-400">iPhone &amp; iPad (Safari)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="text-xs text-zinc-300 space-y-2.5 list-decimal list-inside leading-relaxed">
              <li>
                Appuyez sur le bouton{' '}
                <span className="inline-flex items-center gap-1 text-[#F3E5AB] font-semibold">
                  Partager <Share className="w-3.5 h-3.5 text-[#D4AF37]" />
                </span>{' '}
                dans la barre Safari.
              </li>
              <li>
                Faites défiler et sélectionnez{' '}
                <strong className="text-slate-100">« Sur l’écran d’accueil »</strong>.
              </li>
              <li>
                Appuyez sur <strong className="text-[#D4AF37]">Ajouter</strong> pour lancer
                l’académie en plein écran.
              </li>
            </ol>

            <button
              type="button"
              onClick={() => {
                setShowIOSModal(false);
                onAfterAction?.();
              }}
              className="w-full py-2.5 px-4 text-xs font-semibold text-zinc-950 bg-[#D4AF37] hover:bg-[#E5C158] rounded-lg transition-colors cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
