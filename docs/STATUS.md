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

### De făcut (în ordinea recomandată)

1. [ ] **Primul ISO construit** pe un Debian 13 real: `sudo ./build.sh iso`, apoi pornit într-o mașină virtuală (QEMU / VirtualBox).
       Pașii neverificați încă: lista de pachete, hook-ul, generatorul de utilizator, sesiunea cage + Chromium, regula polkit.
2. [ ] Workflow GitHub Actions care construiește ISO-ul și îl pune în Releases (cere un runner cu Debian 13 și drepturi de root/privileged).
3. [ ] Pachetul Linux al **launcherului** (`.deb`) inclus în imagine, ca butonul „Launcher” să pornească ceva real.
       Comanda implicită este `dominosland-launcher` (se poate schimba prin `DL_LAUNCHER_CMD`).
4. [ ] Plăcile „Setări”, „Fișiere”, „Magazin” din interfață (acum „în curând”).
5. [ ] Wi-Fi și sunet din interfață (NetworkManager și PipeWire sunt deja instalate).
6. [ ] Actualizări de sistem din interfață (`apt` printr-un unit systemd, ca la modul joc).
7. [ ] Branding la pornire: ecran de boot (Plymouth) și GRUB cu logo-ul DominosLand.
8. [ ] Jarvis conectat la Jarvis AI din ecosistem (acum răspunde doar local).
9. [ ] Testat pe hardware real: AMD, Intel, NVIDIA (varianta nvidia), laptop cu Wi-Fi.

---

## 2. DominosLand Launcher (`apps/desktop`)

### Făcut

- [x] Codul copiat din repository-ul privat `pannel-all`, verificat să nu conțină secrete.
- [x] Logo-ul nou (DL cu coroană) peste tot: aplicație, installer, overlay, PWA.
- [x] CI: build la fiecare push. Release: installer Windows la fiecare tag `v*`.

### De făcut

1. [ ] Primul release: `git tag v1.0.0 && git push origin v1.0.0` (butoanele de descărcare din README depind de el).
2. [ ] Ținut sincronizat cu `pannel-all/apps/desktop` (aceeași aplicație în două locuri).
3. [ ] Build Linux (`.deb` / AppImage) publicat și în Releases, pentru DominosLand OS.

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
3. [ ] Hotărăște licența: acum este Unlicense (domeniu public, oricine poate copia și vinde codul).
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
