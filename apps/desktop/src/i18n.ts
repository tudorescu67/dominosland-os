/* Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. */
export type Language = 'ro' | 'en' | 'es' | 'fr' | 'de' | 'it';

export const languageOptions: Array<{ id: Language; label: string }> = [
  { id: 'ro', label: 'Romana' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Espanol' },
  { id: 'fr', label: 'Francais' },
  { id: 'de', label: 'Deutsch' },
  { id: 'it', label: 'Italiano' },
];

const translations: Record<Language, Record<string, string>> = {
  ro: {
    Overview: 'Prezentare',
    'DominosLand Hub': 'Hub DominosLand',
    'Jarvis Bots': 'Boți Jarvis',
    Discord: 'Discord',
    'Game Panel': 'Panel jocuri',
    'Music Lab': 'Laborator muzică',
    Weather: 'Vreme',
    'Creator Studio': 'Studio creator',
    Community: 'Comunitate',
    'Live Logs': 'Loguri live',
    Terminal: 'Terminal',
    Jarvis: 'Jarvis',
    'VPS Metrics': 'Metrici VPS',
    Domains: 'Domenii',
    Security: 'Securitate',
    'ALL SYSTEMS': 'TOATE SISTEMELE',
    Live: 'Live',
    Offline: 'Offline',
    Refresh: 'Reîmprospătare',
    '2FA required': '2FA necesar',
    'API URL': 'URL API',
    Login: 'Autentificare',
    Username: 'Utilizator',
    Password: 'Parolă',
    'Sign in': 'Intră în cont',
    Language: 'Limbă',
  },
  en: {
    Overview: 'Overview',
    'DominosLand Hub': 'DominosLand Hub',
    'Jarvis Bots': 'Jarvis Bots',
    Discord: 'Discord',
    'Game Panel': 'Game Panel',
    'Music Lab': 'Music Lab',
    Weather: 'Weather',
    'Creator Studio': 'Creator Studio',
    Community: 'Community',
    'Live Logs': 'Live Logs',
    Terminal: 'Terminal',
    Jarvis: 'Jarvis',
    'VPS Metrics': 'VPS Metrics',
    Domains: 'Domains',
    Security: 'Security',
    'ALL SYSTEMS': 'ALL SYSTEMS',
    Live: 'Live',
    Offline: 'Offline',
    Refresh: 'Refresh',
    '2FA required': '2FA required',
    'API URL': 'API URL',
    Login: 'Login',
    Username: 'Username',
    Password: 'Password',
    'Sign in': 'Sign in',
    Language: 'Language',
  },
  es: {
    Overview: 'Resumen',
    'DominosLand Hub': 'Hub DominosLand',
    'Jarvis Bots': 'Bots Jarvis',
    Discord: 'Discord',
    'Game Panel': 'Panel de juegos',
    'Music Lab': 'Laboratorio musical',
    Weather: 'Clima',
    'Creator Studio': 'Estudio creativo',
    Community: 'Comunidad',
    'Live Logs': 'Registros en vivo',
    Terminal: 'Terminal',
    Jarvis: 'Jarvis',
    'VPS Metrics': 'Metricas VPS',
    Domains: 'Dominios',
    Security: 'Seguridad',
    'ALL SYSTEMS': 'TODOS LOS SISTEMAS',
    Live: 'En vivo',
    Offline: 'Sin conexion',
    Refresh: 'Actualizar',
    '2FA required': '2FA requerido',
    'API URL': 'URL de API',
    Login: 'Inicio de sesion',
    Username: 'Usuario',
    Password: 'Contrasena',
    'Sign in': 'Iniciar sesion',
    Language: 'Idioma',
  },
  fr: {
    Overview: 'Vue d ensemble', 'DominosLand Hub': 'Hub DominosLand', 'Jarvis Bots': 'Bots Jarvis', Discord: 'Discord', 'Game Panel': 'Panel de jeux', 'Music Lab': 'Laboratoire musical', Weather: 'Meteo', 'Creator Studio': 'Studio createur', Community: 'Communaute', 'Live Logs': 'Journaux en direct', Terminal: 'Terminal', Jarvis: 'Jarvis', 'VPS Metrics': 'Metriques VPS', Domains: 'Domaines', Security: 'Securite', 'ALL SYSTEMS': 'TOUS LES SYSTEMES', Live: 'En direct', Offline: 'Hors ligne', Refresh: 'Actualiser', '2FA required': '2FA requis', 'API URL': 'URL API', Login: 'Connexion', Username: 'Utilisateur', Password: 'Mot de passe', 'Sign in': 'Se connecter', Language: 'Langue',
  },
  de: {
    Overview: 'Ubersicht', 'DominosLand Hub': 'DominosLand Hub', 'Jarvis Bots': 'Jarvis Bots', Discord: 'Discord', 'Game Panel': 'Game-Panel', 'Music Lab': 'Musiklabor', Weather: 'Wetter', 'Creator Studio': 'Creator Studio', Community: 'Community', 'Live Logs': 'Live-Protokolle', Terminal: 'Terminal', Jarvis: 'Jarvis', 'VPS Metrics': 'VPS-Metriken', Domains: 'Domains', Security: 'Sicherheit', 'ALL SYSTEMS': 'ALLE SYSTEME', Live: 'Live', Offline: 'Offline', Refresh: 'Aktualisieren', '2FA required': '2FA erforderlich', 'API URL': 'API-URL', Login: 'Anmelden', Username: 'Benutzername', Password: 'Passwort', 'Sign in': 'Einloggen', Language: 'Sprache',
  },
  it: {
    Overview: 'Panoramica', 'DominosLand Hub': 'Hub DominosLand', 'Jarvis Bots': 'Bot Jarvis', Discord: 'Discord', 'Game Panel': 'Pannello giochi', 'Music Lab': 'Laboratorio musicale', Weather: 'Meteo', 'Creator Studio': 'Studio creativo', Community: 'Comunita', 'Live Logs': 'Log live', Terminal: 'Terminale', Jarvis: 'Jarvis', 'VPS Metrics': 'Metriche VPS', Domains: 'Domini', Security: 'Sicurezza', 'ALL SYSTEMS': 'TUTTI I SISTEMI', Live: 'Live', Offline: 'Offline', Refresh: 'Aggiorna', '2FA required': '2FA richiesto', 'API URL': 'URL API', Login: 'Accesso', Username: 'Nome utente', Password: 'Password', 'Sign in': 'Accedi', Language: 'Lingua',
  },
};

export function detectLanguage(): Language {
  const saved = localStorage.getItem('dominosLanguage');
  if (languageOptions.some((option) => option.id === saved)) return saved as Language;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('ro')) return 'ro';
  if (browser.startsWith('es')) return 'es';
  if (browser.startsWith('fr')) return 'fr';
  if (browser.startsWith('de')) return 'de';
  if (browser.startsWith('it')) return 'it';
  return 'en';
}

export function translate(language: Language, key: string): string {
  return translations[language][key] || translations.en[key] || key;
}

export function saveLanguage(language: Language) {
  localStorage.setItem('dominosLanguage', language);
  document.documentElement.lang = language;
}
