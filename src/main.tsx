import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.warn('PWA Service Worker registration warning:', error);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
