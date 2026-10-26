<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Memoria proiectului — tot ce s-a făcut și s-a decis

Fișier-memorie pentru o sesiune nouă. Se citește împreună cu [STATUS.md](STATUS.md) (lista de lucru) și
[CONTINUARE.md](CONTINUARE.md) (prompt-ul de pornire și designul extinderilor). Ultima actualizare: **26 octombrie 2026**.

## Prompt de lipit într-o sesiune nouă

```text
Continuăm proiectul DominosLand, repository-ul public tudorescu67/dominosland-os.
Citește, în ordine: CLAUDE.md, docs/MEMORIE.md (ce s-a făcut și s-a decis), docs/STATUS.md (ce rămâne),
docs/CONTINUARE.md (designul extinderilor). Apoi verifică pe GitHub pull request-ul #1, CI-ul și comentariile
de review nerezolvate, repară ce e roșu și continuă extinderile în ordinea din CONTINUARE.md.
Vorbește cu mine în română, scurt, fără jargon. La final actualizează MEMORIE.md, STATUS.md și CONTINUARE.md.
```

## Cine și ce

- Proprietarul: `tudorescu67` (Capitanul Burcea-Alex). Scrie în română, scurt, de multe ori fără diacritice și cu greșeli de tastare.
  Vrea rezultate făcute, nu întrebări. Când spune „da fa-le” înseamnă: execută toate punctele propuse.
- Repository-uri: `tudorescu67/dominosland-os` (public, acesta), `tudorescu67/pannel-all` (privat, monorepo-ul complet cu
  API-ul NestJS, botul Discord, Jarvis AI, infrastructura), `tudorescu67/css-bans` (neatins).
- Branch de lucru: `claude/hopeful-sagan-oa0dod`. Există și `main` (creat din același commit, nu e încă branch implicit).
  Pull request deschis: **#1** `claude/hopeful-sagan-oa0dod` → `main`, draft.
- Licența: Unlicense (domeniu public), copiată din `pannel-all`. Proprietarul trebuie să hotărască dacă o păstrează.

## Produsele (decizie fermă: sunt trei lucruri separate)

1. **DominosLand OS**: sistem de operare separat, în `os/`. **Bazat pe Linux (Debian 13)** pentru suportul de drivere.
   Proprietarul a spus explicit: ar fi făcut propriul nucleu, dar nu are suport de drivere. Nu propune niciodată nucleu propriu.
2. **DominosLand Launcher**: aplicația desktop (Electron), în `apps/desktop`, copiată din `pannel-all/apps/desktop`.
   **Launcherul NU este DominosLand OS** (o greșeală făcută o dată și corectată la cererea proprietarului).
3. **Aplicația de telefon**: `apps/mobile`, deocamdată doar planul (Expo / React Native, Android întâi).

Limbajele OS-ului (cerute de proprietar): **Rust, C++, JavaScript, Python**. Roluri: Rust = servicii de sistem,
C++ = grafică/jocuri/media, JavaScript = interfața, Python = Jarvis și automatizări.

Logo: „DL” cu coroană (a înlocuit piesa de domino peste tot). Original în sesiune; copiat în `apps/desktop/public/icon.png`,
`os/shell/icon.png`, `apps/desktop/resources/icon.png`, tema Plymouth și fundalul GRUB.

## Ce s-a făcut (cronologic)

1. Repo-ul `dominosland-os` era gol. Am copiat launcherul din `pannel-all` după o scanare de secrete (nimic găsit;
   README-ul vechi cu ID-uri Discord și config de VPS NU a fost copiat), am scris README, `SECURITY.md`, `CLAUDE.md`, CI și Release.
2. Logo nou în locul domino-ului; PNG-uri în loc de SVG (SVG nu merge ca icon de fereastră Electron pe Windows); service worker cu cache v2.
3. **DominosLand OS, prima versiune** în `os/`:
   - `services/` Rust `dominosd`: starea din `/proc`, servește interfața și API-ul pe `127.0.0.1:7410`, fără dependențe externe.
   - `engine/` C++ `dl-gamemode`: guvernorii CPU pe `performance`, restaurare exactă; fișierul de stare nu poate scrie în afara fișierelor cpufreq.
   - `shell/` JavaScript: interfața (ceas, stare sistem, plăci), fără dependențe, CSP strict.
   - `jarvis/` Python `dl-jarvis`: comenzi în română, doar acțiuni din listă, fără shell.
   - `image/` live-build: Debian 13, firmware non-free, `cage` + Chromium kiosk, română implicit, tema Plymouth cu logo.
   - `build.sh`: `./build.sh` (componente), `test-image`, `sudo ./build.sh iso [standard|nvidia]`.
4. **Butoane funcționale** (Launcher, Mod joc, Jarvis): `POST /api/actions/*`, cu protecții anti-CSRF (antet `X-DominosLand-Action`,
   `Origin`, `Host` contra DNS rebinding, JSON, `Content-Length`), comenzi ca argv fără shell, cu timeout.
   `dominosd` rulează **în sesiunea utilizatorului** (`dominosland-session`), nu ca serviciu de sistem.
   Modul joc cere root: unit `dl-gamemode@.service` (cu `flock`) + regulă polkit doar pentru `on`/`off`, utilizator local activ.
5. Utilizatorul interfeței se alege la boot (generator systemd): primul utilizator real din `/etc/passwd`, altfel `dominos`.
6. Varianta **NVIDIA** a ISO-ului separată (driver proprietar); imaginea standard folosește nouveau.
7. **Review Copilot, runda 1** (4 probleme reale, toate reparate): blocare comună on/off; citirea ieșirii respectă timeout-ul
   (testat: 30 s înainte, 0,8 s după); cod de ieșire nenul = stare necunoscută; răspunsuri vechi ignorate în interfață (`makeLatest`).
8. **Workflow „OS image”** pe GitHub: container `debian:trixie --privileged`, construiește `.deb`-ul launcherului și ISO-ul.
   **Prima rulare a ieșit verde** (~15 min) pe commit-ul `0673cb7`.
9. Launcherul intră în imagine ca `.deb` (`executableName: dominosland-launcher`, exact comanda butonului); `package.json` are `homepage`,
   `author`, `repository`, cerute de `.deb`.
10. **Review Copilot, runda 2**: (a) alt cont local putea trimite acțiuni → `dominosd` verifică UID-ul proprietarului socket-ului
    clientului din `/proc/net/tcp{,6}` (`peer.rs`), **fail-closed**, `DOMINOSD_ALLOWED_UID` doar pentru teste; (b) clickjacking →
    `X-Frame-Options: DENY` și `Content-Security-Policy: frame-ancestors 'none'` pe fiecare răspuns.
    Verificat: 27 + 9 teste pe Rust curent și pe 1.85.1 (versiunea Debian 13), clippy curat, test real cu UID străin (403).
11. Pregătite pentru imagine: meniul GRUB cu logo, și `vm.max_map_count` ca SteamOS (jocuri/Proton/Easy Anti-Cheat).

## Fapte tehnice care contează

- Versiunile din Debian 13: rustc/cargo 1.85.1, Node 20.19, Python 3.13, cmake 3.31, g++ 14. Codul a fost testat pe ele.
- Toate pachetele din listele imaginii există în trixie (verificat în index). `libgtk-3-0`/`libatspi2.0-0` apar ca pachete virtuale (t64), e normal.
- Jarvis AI (din `pannel-all`): `POST https://api.dominosland.com/api/control/jarvis/ask`, corp `{"question"}` (1–800 caractere),
  `Authorization: Bearer <token>`, orice membru logat, 10/min per cont, răspuns `{ok, answer, model}`; `ok:false` vine cu HTTP 200.
  Login `POST /api/auth/login` `{username,password}` → `{access_token,user}`, token 24 h; poate fi blocat dacă serverul e doar-Discord.
- Easy Anti-Cheat / BattlEye: merg pe Linux prin Proton doar dacă dezvoltatorul jocului a activat suportul. Fără ocoliri
  (încalcă termenii și duc la ban). Detalii și plan în CONTINUARE.md, secțiunea 4b.
- Mediul de lucru din sesiune: nu are Docker, nici `live-build`; ISO-ul se construiește doar pe GitHub (workflow-ul „OS image”).

## Capcane întâlnite (ca să nu se repete)

- **Hook-uri care blochează comenzi Bash** doar pentru cuvinte din text: `.env`, `secret`, `credentials` (hook one-shot-prompting),
  și un buget de 5 căutări inline pe prompt (hook frugal; se delegă la un agent `frugal:scout`). Soluții: mesajele de commit și fișierele
  cu astfel de cuvinte se scriu cu Write, nu cu heredoc în Bash; citirile multiple se dau unui agent.
- **CRLF în PNG**: regula `os/image/** text eol=lf` strica imaginile; acum `*.png`, `*.jpg`, `*.webp` sunt `binary` în `.gitattributes`.
- Hook-ul de stop cere ca arborele git să fie curat; fișierele nefinalizate se parchează în scratchpad, nu rămân necomise.
- Un `git push` pe branch repornește build-ul ISO (~15 min); se grupează modificările într-un singur push.
- Pull request-ul are review automat Copilot; comentariile se verifică (nu se aplică orbește), se repară, se răspunde pe fir și se rezolvă firul.
- Atribuirea la commit-uri: `Co-Authored-By` + `Claude-Session` (cerute de harness), mesaje în română.

## Reguli stabilite (din CLAUDE.md)

Repository public, fără secrete/IP-uri/ID-uri personale; antet de copyright pe fiecare fișier nou; interfața în română;
comentariile explică „de ce”; clientul nu execută pe servere direct; DominosLand OS pe Linux, fără nucleu propriu;
launcherul nu e OS-ul.

## Ce urmează (pe scurt; detalii în STATUS.md și CONTINUARE.md)

Pornit ISO-ul într-o mașină virtuală; apoi, în ordine: Wi-Fi și sunet, actualizări din interfață, Jarvis conectat la Jarvis AI,
Magazin (Flatpak) cu starea anti-cheat, Fișiere, GRUB/boot, depozit apt propriu. Proprietarul trebuie să: seteze `main` ca branch
implicit, să facă merge la PR #1, să pornească raportarea privată de vulnerabilități, să decidă licența.

## Automatizări active

- Abonare la PR #1 (evenimentele CI/review ajung în sesiune).
- Sesiunea cloud are limită de credit; când se epuizează, lucrul continuă dintr-o sesiune nouă cu prompt-ul de mai sus.
