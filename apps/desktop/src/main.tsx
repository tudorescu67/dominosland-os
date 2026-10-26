/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import 'xterm/css/xterm.css';
import './styles.css';
import './launcher/shell.css';
import App from './App';
import Overlay from './launcher/Overlay';
import { initializeAuth } from './api';

async function mount() {
  await initializeAuth();
  // Fereastra de overlay (Alt+J) incarca aceeasi aplicatie cu ruta #/overlay.
  const isOverlay = window.location.hash === '#/overlay';
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {isOverlay ? <Overlay /> : <App />}
    </React.StrictMode>,
  );
}

void mount();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
