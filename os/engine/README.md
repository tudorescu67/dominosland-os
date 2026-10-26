<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# DominosLand Engine

Unelte native pentru DominosLand OS (baza Debian 13). Momentan: `dl-gamemode`.

## dl-gamemode

Modul de joc muta guvernatorul cpufreq al fiecarui procesor pe `performance` si, la oprire,
restaureaza exact guvernatorii de dinainte. Starea anterioara se salveaza in
`/run/dominosland/gamemode.state` inainte de orice modificare.

```bash
dl-gamemode status                 # afiseaza pornit / oprit
sudo dl-gamemode on                # porneste modul de joc
sudo dl-gamemode off               # restaureaza guvernatorii
dl-gamemode on --dry-run           # arata ce s-ar face, fara sa scrie nimic
# optiuni: --sysfs-root CALE (implicit /sys), --state-file CALE
```

Scrierea in sysfs cere root (sau rularea prin serviciul DominosLand).

## Compilare si teste

```bash
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build
ctest --test-dir build --output-on-failure
```
