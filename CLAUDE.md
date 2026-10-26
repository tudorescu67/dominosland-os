# DominosLand (repository public) — ghid pentru Claude Code

Repository **public** cu aplicațiile client ale ecosistemului DominosLand.

**DominosLand OS** este un produs separat: un sistem de operare, nu o aplicație. Launcherul NU este DominosLand OS;
nu le amesteca în nume, texte sau documentație.

| Folder | Ce este | Stack |
| --- | --- | --- |
| `apps/desktop` | DominosLand Launcher (Windows / Linux) | Electron + React + Vite; FFmpeg în `electron/media-engine.cjs` |
| `apps/mobile` | varianta pentru telefon (în lucru) | Expo / React Native |

API-ul, botul Discord, Jarvis și infrastructura sunt în repository-ul privat `pannel-all`.
Codul desktop vine de acolo (`apps/desktop`); schimbările se țin sincronizate în ambele locuri.

## Comenzi

```bash
cd apps/desktop && npm ci && npm run build && for f in electron/*.cjs; do node --check "$f"; done
```

## Reguli

- Repository-ul este public: **niciun secret** (token-uri, chei, parole, IP-uri de servere, ID-uri Discord personale).
- Fiecare fișier nou începe cu `Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.` în comentariul potrivit limbajului.
- Textele din interfață sunt în română. Comentariile explică „de ce”, nu „ce”.
- Clientul nu execută nimic pe servere direct; acțiunile trec prin API, care verifică rolul.
- Release: tag `v*` → GitHub Actions publică installer-ul (și APK-ul, când există `apps/mobile/app.json`).
