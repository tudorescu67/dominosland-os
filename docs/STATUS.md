<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Starea proiectului — pentru continuare

Lista de lucru a repository-ului public DominosLand. Se actualizează la fiecare pas important:
bifează ce s-a terminat, mută în „Făcut” și adaugă data.

Ultima actualizare: **26 octombrie 2026**.

---

## 1. DominosLand OS (`os/`)

Sistem de operare separat, bazat pe **Debian 13 + nucleul Linux** pentru suportul de drivere.
Fără nucleu propriu: driverele pentru plăci video, Wi-Fi, rețea și periferice vin din Linux.

### Făcut

- [x] Structura pe limbaje: Rust (`services/`), C++ (`engine/`), JavaScript (`shell/`), Python (`jarvis/`), live-build (`image/`).
- [x] **dominosd** (Rust): starea sistemului din `/proc`, servește interfața și API-ul doar pe `127.0.0.1:7410`.
- [x] dominosd: acțiuni din interfață (launcher, mod joc, Jarvis), protejate de cereri venite din alte pagini:
      antet `X-DominosLand-Action`, verificare `Origin` și `Host` (și împotriva DNS rebinding), fără CORS.
- [x] **dl-gamemode** (C++): procesorul pe `performance` și înapoi exact cum era; fișierul de stare nu poate scrie în altă parte.
- [x] Modul joc fără parolă pentru utilizatorul din fața calculatorului: unit `dl-gamemode@.service` + regulă polkit doar pentru `on`/`off`.
- [x] **Interfața** (JavaScript): ceas, starea sistemului, butoane funcționale pentru Launcher, Mod joc și Jarvis.
- [x] **dl-jarvis** (Python): comenzi scurte în română, doar acțiuni din listă, fără shell.
- [x] **Imaginea** (live-build): Debian 13, firmware non-free, cage + Chromium pe tot ecranul, română implicit.
- [x] Utilizatorul interfeței se alege singur la pornire (live: `dominos`; instalat: utilizatorul din installer).
- [x] Varianta **NVIDIA** a ISO-ului (`sudo ./build.sh iso nvidia`), separată de cea standard.
- [x] Teste pentru fiecare componentă și job-uri CI separate.
- [x] Review automat (Copilot) rezolvat: blocare comună pentru modul joc, timeout respectat, stare nesigură = necunoscută, răspunsuri vechi ignorate în interfață.
- [x] **ISO construit pe GitHub** (workflow „OS image”): container Debian 13 privilegiat; la pull request (standard), manual (standard / nvidia), la tag `os-v*` (ambele, în Releases).
- [x] **Launcherul în imagine**: `.deb`-ul construit de electron-builder intră în `config/packages.chroot`; executabilul se numește `dominosland-launcher`, exact comanda pornită de butonul „Launcher”.
- [x] **Ecran de pornire DominosLand** (Plymouth): logo-ul DL pe fundalul întunecat al interfeței.
- [x] Al doilea review automat (Copilot) rezolvat: doar UID-ul utilizatorului sesiunii poate folosi dominosd (alt cont local sau root primește 403), iar răspunsurile au antete anti-încadrare (`X-Frame-Options`, `frame-ancestors`).

### De făcut (în ordinea recomandată)

1. [ ] **Pornit ISO-ul într-o mașină virtuală** (QEMU / VirtualBox) și verificat: interfața apare, butoanele merg, instalarea merge.
       Comandă rapidă: `qemu-system-x86_64 -enable-kvm -m 4096 -cdrom dominosland-os-amd64.hybrid.iso`.
2. [ ] Testat pe hardware real: AMD, Intel, NVIDIA (varianta nvidia), laptop cu Wi-Fi.
3. [ ] Primul release al sistemului: `git tag os-v0.1.0 && git push origin os-v0.1.0`.

## Recomandări de extindere

Ordinea propusă după primul ISO verificat. Fiecare are un singur scop și se poate testa separat.

| # | Extindere | De ce | Cum |
| --- | --- | --- | --- |
| 1 | **Setări: Wi-Fi și sunet** | Fără ele, pe un laptop sistemul e greu de folosit. | Acțiuni noi în dominosd peste `nmcli` și `wpctl`, cu aceeași protecție CSRF; placa „Setări” devine reală. |
| 2 | **Actualizări din interfață** | Sistemul trebuie să primească patch-uri de securitate fără terminal. | Unit `dl-update.service` (`apt-get upgrade`) permis de polkit, ca la modul joc; progresul afișat în interfață. |
| 3 | **Jarvis conectat la Jarvis AI** | Acum înțelege doar comenzile locale. | Întrebările necunoscute merg la API-ul DominosLand, cu contul din launcher; comenzile locale rămân pe calculator. |
| 4 | **Magazin = biblioteca de jocuri** | Placa „Magazin” e goală. | Lista serverelor și jocurilor din API-ul DominosLand, cu instalare Steam / Flatpak. |
| 5 | **Fișiere** | Utilizatorul are nevoie de capturi, clipuri și descărcări. | Un manager de fișiere simplu în interfață, doar în `/home`. |
| 6 | **GRUB / meniul de boot cu logo** | Ultimul ecran care încă arată Debian. | Temă GRUB și isolinux cu culorile DominosLand. |
| 7 | **Proton / Steam în imagine** | Majoritatea jocurilor de PC sunt pentru Windows. | `steam-installer` + Proton din `contrib`/`non-free`, pornite din Magazin. |
| 8 | **Actualizare a imaginii prin rețea** | Fără reinstalare la fiecare versiune. | Pachete DominosLand într-un depozit apt propriu, semnat. |

---

## 2. DominosLand Launcher (`apps/desktop`)

### Făcut

- [x] Codul copiat din repository-ul privat `pannel-all`, verificat să nu conțină secrete.
- [x] Logo-ul nou (DL cu coroană) peste tot: aplicație, installer, overlay, PWA.
- [x] CI: build la fiecare push. Release: installer Windows la fiecare tag `v*`.

### De făcut

1. [ ] Primul release: `git tag v1.0.0 && git push origin v1.0.0` (butoanele de descărcare din README depind de el).
2. [ ] Ținut sincronizat cu `pannel-all/apps/desktop` (aceeași aplicație în două locuri).
       Diferență cunoscută: aici `package.json` are `linux.executableName = dominosland-launcher` (pentru DominosLand OS).
3. [ ] Build Linux (AppImage) publicat și în Releases; `.deb`-ul se construiește deja pentru imaginea OS.

---

## 3. Aplicația de telefon (`apps/mobile`)

### Făcut

- [x] Planul: funcții pentru jucători și staff, tehnologie (Expo / React Native), etape.
- [x] CI și Release o detectează automat când apare `apps/mobile/app.json`.

### De făcut

1. [ ] Proiectul Expo în `apps/mobile` (login, servere live, Jarvis, notificări).
2. [ ] Primul APK Android în Releases.
3. [ ] Remote Link: telefonul controlează launcherul de pe PC.
4. [ ] Zona staff (tichete, servere, aprobări) cu 2FA.
5. [ ] iOS prin EAS.

---

## 4. Repository și GitHub

### Făcut

- [x] Repository public `tudorescu67/dominosland-os`, cu README, licență, `SECURITY.md`, `CLAUDE.md`.
- [x] Branch-ul `main` creat.

### De făcut (le face proprietarul, din Settings pe GitHub)

1. [ ] Setează `main` ca branch implicit (Settings → Branches), apoi șterge `claude/hopeful-sagan-oa0dod` după merge.
2. [ ] Pornește raportarea privată a vulnerabilităților (Settings → Security).
3. [x] Licența: proprietară, hotărâtă de proprietar (commit `21b3a4b`). Codul e vizibil, dar fără drept de folosire fără permisiune scrisă.
4. [ ] Protecție pe `main`: merge doar prin pull request, cu CI verde.

---

## Comenzi utile

```bash
cd os && ./build.sh              # compilează și testează Rust, C++, JavaScript, Python
cd os && ./build.sh test-image   # testează scripturile imaginii
cd os && sudo ./build.sh iso     # ISO standard (doar pe Debian 13 cu live-build)
cd os && sudo ./build.sh iso nvidia
cd apps/desktop && npm ci && npm run build
```

Pe GitHub: tab-ul **Actions → OS image → Run workflow** construiește ISO-ul fără un calculator cu Debian;
fișierul apare la „Artifacts” în pagina rulării (păstrat 7 zile).
