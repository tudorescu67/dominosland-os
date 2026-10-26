<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# DominosLand OS

Sistemul de operare DominosLand, separat de launcher și de aplicația de telefon.

> 🚧 **Prima versiune de lucru.** Componentele se compilează și au teste. ISO-ul se construiește pe Debian 13 și nu a fost încă pornit pe un calculator real.

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
| [`services/`](services) | Rust | `dominosd`: citește starea sistemului și servește interfața și un API local, doar pe `127.0.0.1:7410`. |
| [`engine/`](engine) | C++ | `dl-gamemode`: pune procesorul în modul `performance` pentru jocuri și îl readuce exact cum era. |
| [`shell/`](shell) | JavaScript | Interfața de pe ecran: ceas, plăcile DominosLand, starea sistemului. |
| [`jarvis/`](jarvis) | Python | `dl-jarvis`: înțelege comenzi scurte în română și rulează doar acțiuni permise dinainte. |
| [`image/`](image) | live-build | Configurația ISO-ului: pachete, drivere, servicii systemd, numele sistemului. |

La pornire, `dominosd` servește interfața, iar `cage` (un compozitor Wayland pentru un singur program) o afișează pe tot ecranul cu Chromium.

## Construire

```bash
cd os
./build.sh          # compilează și testează cele patru componente
sudo ./build.sh iso # pe Debian 13, cu live-build: construiește ISO-ul în os/out/image
```

ISO-ul rezultat pornește în modul live și are și instalatorul Debian. Se poate încerca într-o mașină virtuală (VirtualBox, QEMU) înainte de un calculator real.

## Securitate

- API-ul `dominosd` ascultă doar pe `127.0.0.1` și nu trimite antete CORS, ca site-urile deschise în browser să nu-l poată citi.
- Interfața este deocamdată doar de citire. Butoanele care pornesc acțiuni vor avea nevoie de protecție împotriva cererilor venite din alte pagini.
- `dl-jarvis` nu rulează comenzi scrise liber, ci doar acțiunile din lista lui.
- `dominosd` rulează fără root, cu un utilizator temporar și acces doar de citire la sistem.
