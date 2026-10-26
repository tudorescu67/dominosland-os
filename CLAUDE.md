# DominosLand (repository public) — ghid pentru Claude Code

Repository **public** cu aplicațiile client ale ecosistemului DominosLand.

**DominosLand OS** este un produs separat: un sistem de operare, nu o aplicație. Launcherul NU este DominosLand OS;
nu le amesteca în nume, texte sau documentație.
Limbajele DominosLand OS: Rust (servicii de sistem), C++ (grafică, jocuri, media), JavaScript (interfața), Python (Jarvis, automatizări).
Rolurile sunt propunerea de pornire din README; confirmă cu proprietarul înainte de a le schimba.

| Folder | Ce este | Stack |
| --- | --- | --- |
| `os/` | DominosLand OS, bazat pe Debian 13 + Linux (drivere) | Rust `services/`, C++ `engine/`, JS `shell/`, Python `jarvis/`, live-build `image/` |
| `apps/desktop` | DominosLand Launcher (Windows / Linux) | Electron + React + Vite; FFmpeg în `electron/media-engine.cjs` |
| `apps/mobile` | varianta pentru telefon (în lucru) | Expo / React Native |

API-ul, botul Discord, Jarvis și infrastructura sunt în repository-ul privat `pannel-all`.
Codul desktop vine de acolo (`apps/desktop`); schimbările se țin sincronizate în ambele locuri.

## Comenzi

```bash
cd apps/desktop && npm ci && npm run build && for f in electron/*.cjs; do node --check "$f"; done
cd os && ./build.sh            # Rust + C++ + JS + Python: compilare și teste
cd os && sudo ./build.sh iso   # ISO-ul, doar pe Debian 13 cu live-build
```

DominosLand OS nu are nucleu propriu: e bazat pe Linux pentru suportul de drivere. Nu propune un kernel propriu.

**Memoria proiectului: [docs/MEMORIE.md](docs/MEMORIE.md)** (ce s-a făcut și decis), **starea și ce urmează: [docs/STATUS.md](docs/STATUS.md)**,
**designul extinderilor: [docs/CONTINUARE.md](docs/CONTINUARE.md)**. Citește-le la începutul fiecărei sesiuni
și actualizează-le (bifează, mută în „Făcut”, schimbă data) la finalul fiecărui pas important.

## Reguli

- Repository-ul este public: **niciun secret** (token-uri, chei, parole, IP-uri de servere, ID-uri Discord personale).
- Fiecare fișier nou începe cu `Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex.` în comentariul potrivit limbajului.
- Textele din interfață sunt în română. Comentariile explică „de ce”, nu „ce”.
- Clientul nu execută nimic pe servere direct; acțiunile trec prin API, care verifică rolul.
- Release: tag `v*` → GitHub Actions publică installer-ul (și APK-ul, când există `apps/mobile/app.json`).
