import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-2.5 bg-amber-950/95 border-b border-[#D4AF37]/40 text-[#F3E5AB] text-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center">
        <WifiOff className="w-4 h-4 text-[#D4AF37] shrink-0" />
        <span>
          Connexion internet interrompue — Navigation locale active. Les paiements, vidéos et
          synchronisations cloud reprendront automatiquement dès le retour du réseau.
        </span>
      </div>
    </div>
  );
};
