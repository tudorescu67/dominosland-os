<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# DominosLand Launcher (desktop)

Launcherul DominosLand pentru Windows și Linux. Este o aplicație; DominosLand OS, sistemul de operare, este un produs separat.

## Structură

| Cale | Rol |
| --- | --- |
| `electron/main.cjs` | Procesul principal: fereastra, stocarea criptată (DPAPI / keyring), descărcări, Game Booster. |
| `electron/media-engine.cjs` | Motorul media pe FFmpeg: multi-stream RTMP și replay buffer pentru clipuri. |
| `electron/media-ipc.cjs` | Scurtăturile globale (Alt+F10 clip, Alt+J overlay) și fereastra de overlay. |
| `electron/preload.cjs` | Puntea sigură dintre interfață și Electron (`window.dominosDesktop`). |
| `src/launcher/` | Launcherul: Acasă, Streaming, Clipuri, Performanță, Cinema, Overlay. |
| `src/App.tsx` | Navigarea, autentificarea și zona Administrare pentru staff. |
| `src/api.ts` | Clientul HTTP / WebSocket către API-ul DominosLand. |
| `src/i18n.ts` | Traducerile: română, engleză, spaniolă, franceză, germană, italiană. |

## Comenzi

```bash
npm install
npm run dev     # Vite pe 127.0.0.1:5178 + Electron
npm run build   # tsc + vite build
npm run pack    # aplicația împachetată, fără installer
npm run dist    # installer NSIS (Windows) sau AppImage / deb (Linux)
```

## Configurare

`.env` este opțional și se folosește doar în dezvoltare. Pornește de la `.env.example`:

| Variabilă | Rol |
| --- | --- |
| `VITE_DOMINOS_API_URL` | Adresa API-ului. Implicit `https://api.dominosland.com`. |
| `VITE_DOMINOS_WS_URL` | Adresa WebSocket. Implicit aceeași cu API-ul. |
| `DESKTOP_DEV_URL` | Adresa serverului Vite în dezvoltare. |

## Securitate

- Token-ul de login și cheile de stream se salvează criptat prin `safeStorage` din Electron. Pe Linux fără keyring, rămân doar în memorie.
- Aplicația nu conține chei sau parole. Zona Administrare cere un cont cu rol de staff, iar API-ul verifică rolul la fiecare acțiune.
- Nu adăuga niciodată token-uri, chei API sau parole în cod sau în `.env.example`.
