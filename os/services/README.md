<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# dominosd

Serviciul de sistem al DominosLand OS (Debian 13). Citeste starea sistemului din `/proc`
si serveste shell-ul desktop (fisiere statice) plus un API JSON doar-citire, pe loopback.
Fara dependente externe (doar std), deci se compileaza offline.

## Comenzi

```bash
dominosd status [--compact]     # afiseaza starea ca JSON
dominosd serve [--addr 127.0.0.1:7410] [--shell-dir /usr/share/dominosland/shell]
dominosd --version | --help
```

Implicit: `DOMINOSD_ADDR` si `DOMINOSD_SHELL_DIR`, altfel valorile de mai sus.
Comanda necunoscuta: utilizare pe stderr, cod de iesire 2.

## Rute (doar GET si HEAD; restul primesc 405)

- `/api/health` - `{"ok":true}`
- `/api/status` - `os`, `hostname`, `kernel`, `uptime_seconds`, `load`, `memory`, `cpus`
  (`null` daca o sursa nu poate fi citita)
- orice altceva - fisier static din directorul shell (`/` = `index.html`)

## Securitate

- API-ul nu are autentificare, de aceea asculta implicit doar pe `127.0.0.1`. Nu-l expune pe o interfata publica.
- Nu se trimite `Access-Control-Allow-Origin`: shell-ul e same-origin, iar site-urile externe nu trebuie sa citeasca API-ul.
- Cai statice: decodare procent, respingere `..`, `\` si NUL, apoi `canonicalize` si verificare ca ramane in directorul shell (altfel 404).
- Antetele cererii: maximum 8 KiB; cerere malformata primeste 400.

## Verificare

```bash
cargo build --release && cargo test && cargo clippy --all-targets -- -D warnings
```
