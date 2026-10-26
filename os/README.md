<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# DominosLand OS

Sistemul de operare DominosLand, separat de launcher și de aplicația de telefon.

> 🚧 **Versiune de lucru.** Componentele se compilează și au teste. ISO-ul se construiește pe Debian 13 și nu a fost încă pornit pe un calculator real.

## De ce Linux

DominosLand OS pornește de la **Debian 13 cu nucleul Linux**. Un nucleu propriu ar însemna să scriem de la zero driverele pentru fiecare placă video, placă de rețea, Wi-Fi și periferic. Linux le are deja, inclusiv firmware-ul din `non-free-firmware`, deci DominosLand OS pornește pe hardware real din prima zi. Ce este al nostru stă deasupra nucleului.

## Cum e construit

```text
┌───────────────────────────────────────────────────────────────┐
│ Interfața (JavaScript)  ·  shell/      afișată pe tot ecranul │
├───────────────────────────────────────────────────────────────┤
│ Jarvis (Python)         ·  jarvis/     comenzi în română      │
│ Mod joc (C++)           ·  engine/     procesor la maximum    │
│ dominosd (Rust)         ·  services/   stare + servește UI    │
├───────────────────────────────────────────────────────────────┤
│ Debian 13 + nucleul Linux + drivere și firmware   ·  image/   │
└───────────────────────────────────────────────────────────────┘
```

| Folder | Limbaj | Ce face |
| --- | --- | --- |
| [`services/`](services) | Rust | `dominosd`: citește starea sistemului, servește interfața și un API local doar pe `127.0.0.1:7410`, și execută acțiunile din interfață. |
| [`engine/`](engine) | C++ | `dl-gamemode`: pune procesorul în modul `performance` pentru jocuri și îl readuce exact cum era. |
| [`shell/`](shell) | JavaScript | Interfața de pe ecran: ceas, starea sistemului, butoanele Launcher, Mod joc și Jarvis. |
| [`jarvis/`](jarvis) | Python | `dl-jarvis`: înțelege comenzi scurte în română și rulează doar acțiuni permise dinainte. |
| [`image/`](image) | live-build | Configurația ISO-ului: pachete, drivere, sesiunea grafică, modul joc, numele sistemului. |

La pornire, systemd deschide pe `tty1` sesiunea utilizatorului. În ea, `cage` (un compozitor Wayland pentru un singur program) pornește `dominosland-session`, care lansează `dominosd` și apoi Chromium pe tot ecranul.

```text
tty1 → dominosland-shell.service (utilizatorul ales automat)
        └─ cage → dominosland-session
                   ├─ dominosd  ─── /api/actions/launcher  → pornește launcherul pe ecran
                   │            ├── /api/actions/jarvis    → dl-jarvis -- "<text>"
                   │            └── /api/actions/gamemode  → systemctl start dl-gamemode@on|off.service
                   │                                          (rulează ca root, permis de polkit)
                   └─ chromium --kiosk http://127.0.0.1:7410/
```

`dominosd` rulează în sesiunea utilizatorului, nu ca serviciu de sistem, pentru că launcherul și Jarvis trebuie să pornească pe ecranul lui. Singura acțiune care cere root, modul joc, trece printr-un unit systemd pe care polkit îl permite fără parolă doar pentru `on` și `off`.

Utilizatorul sesiunii se alege la fiecare pornire: primul utilizator obișnuit din sistem (cel creat în installer) sau `dominos` pe imaginea live.

## Construire

```bash
cd os
./build.sh                   # compilează și testează cele patru componente
./build.sh test-image        # testează scripturile imaginii
sudo ./build.sh iso          # pe Debian 13, cu live-build: ISO-ul standard în os/out/image
sudo ./build.sh iso nvidia   # varianta cu driverul NVIDIA proprietar
```

ISO-ul rezultat pornește în modul live și are și instalatorul Debian. Se poate încerca într-o mașină virtuală (VirtualBox, QEMU) înainte de un calculator real.

| Varianta | Pentru cine |
| --- | --- |
| **standard** | AMD, Intel și NVIDIA prin driverul deschis (nouveau). Merge pe aproape orice calculator. |
| **nvidia** | Plăci GeForce recente, cu driverul proprietar pentru performanță maximă în jocuri. |

Varianta NVIDIA e separată pentru că driverul proprietar dezactivează nouveau, iar plăcile NVIDIA foarte vechi ar rămâne fără imagine.

Ce s-a făcut și ce urmează: [docs/STATUS.md](../docs/STATUS.md).

## Securitate

- API-ul `dominosd` ascultă doar pe `127.0.0.1` și nu trimite antete CORS, ca site-urile deschise în browser să nu-l poată citi.
- Acțiunile (`POST /api/actions/*`) cer antetul `X-DominosLand-Action: 1` și un `Origin` egal cu adresa locală. O pagină din alt site nu poate trimite antetul fără CORS, pe care `dominosd` nu îl acceptă.
- Orice cerere cu alt `Host` decât `127.0.0.1` sau `localhost` este respinsă, ca un domeniu care se rezolvă la `127.0.0.1` (DNS rebinding) să nu poată folosi API-ul.
- `dl-jarvis` nu rulează comenzi scrise liber, ci doar acțiunile din lista lui. `dominosd` îi dă textul ca un singur argument, fără shell.
- `dominosd` rulează ca utilizatorul sesiunii, fără root. Modul joc primește root doar prin unit-ul `dl-gamemode@on|off.service`.
