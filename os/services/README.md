<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# dominosd

Daemonul DominosLand OS (Debian 13). Citeste starea sistemului din `/proc`
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

## Rulare

`dominosd` ruleaza **in sesiunea grafica a utilizatorului** (pornit de scriptul de sesiune, cu acelasi
utilizator ca browserul kiosk), nu ca serviciu de sistem intarit. Asculta doar pe `127.0.0.1:7410`
si serveste shell-ul plus API-ul doar acelui utilizator. Fiindca orice pagina din browser si orice alt
cont local pot trimite cereri catre `127.0.0.1`, fiecare conexiune si fiecare cerere sunt verificate (vezi Securitate).

## Rute

GET/HEAD:

- `/api/health` - `{"ok":true}`
- `/api/status` - `os`, `hostname`, `kernel`, `uptime_seconds`, `load`, `memory`, `cpus`
  (`null` daca o sursa nu poate fi citita)
- `/api/gamemode` - `{"active":true|false|null}` din `<DL_GAMEMODE_BIN> status` (`pornit`/`oprit`;
  orice altceva, eroare sau lipsa programului = `null`; timeout 5 s)
- orice altceva - fisier static din directorul shell (`/` = `index.html`)

POST, doar pe `/api/actions/*` (corp JSON obiect plat, maximum 4096 octeti):

- `/api/actions/launcher` (`{}`) - porneste `DL_LAUNCHER_CMD`, fara argumente, in grup propriu de procese
- `/api/actions/gamemode` (`{"on":true|false}`) - `systemctl start dl-gamemode@on.service` / `@off.service` (timeout 15 s)
- `/api/actions/jarvis` (`{"text":"..."}`, 1-500 caractere dupa trim) - `dl-jarvis -- <text>`, text ca UN argument, fara shell (timeout 20 s)
- alta actiune: 404 JSON

Coduri: 400 JSON/camp invalid, 403 cerere respinsa sau conexiune nepermisa, 411/413 lungime, 405 metoda gresita,
421 Host nepermis, 503 program neinstalat, 504 timeout.

## Variabile de mediu

`DOMINOSD_ADDR`, `DOMINOSD_SHELL_DIR`, `DL_LAUNCHER_CMD` (`dominosland-launcher`), `DL_SYSTEMCTL` (`systemctl`),
`DL_JARVIS_BIN` (`dl-jarvis`), `DL_GAMEMODE_BIN` (`dl-gamemode`), `DOMINOSD_ALLOWED_UID` (doar pentru teste, vezi Securitate).

## Securitate

- Nu exista parole; protectia se bazeaza pe loopback, pe UID-ul clientului si pe verificarile de mai jos.
- **UID-ul clientului (orice conexiune, inainte de a citi cererea)**: dominosd cauta socket-ul clientului in
  `/proc/net/tcp` si `/proc/net/tcp6` (adresa locala = adresa clientului, adresa de la distanta = adresa
  serverului, ambele cu port, doar starea ESTABLISHED) si accepta conexiunea doar daca proprietarul e UID-ul
  efectiv al lui dominosd (din `/proc/self/status`). Altfel 403 `{"ok":false,"error":"Conexiune nepermisa"}`,
  motivul doar pe stderr. De ce: un alt cont local (sau un serviciu ca root) poate trimite exact Host-ul,
  Origin-ul si antetul shell-ului, deci ar putea porni actiuni ca utilizatorul sesiunii si ar imprumuta
  autorizarea polkit a sesiunii active (modul joc); proprietarul socket-ului nu il poate falsifica.
- **Fail closed**: daca proprietarul nu poate fi aflat (intrare lipsa dupa 3 reincercari la 10 ms, `/proc`
  necitibil, linie invalida, potriviri contradictorii) raspunsul e tot 403. Daca UID-ul permis nu poate fi
  aflat la pornire, `dominosd serve` nu porneste (cod 1). Un client care si-a inchis deja scrierea (half-close)
  nu mai e ESTABLISHED si e refuzat; browserul si `curl` nu fac asta.
- **`DOMINOSD_ALLOWED_UID`** (numar zecimal) inlocuieste UID-ul permis; exista ca testele sa simuleze un
  apelant strain. Nu slabeste granita: cine poate seta mediul lui dominosd il controleaza deja, deci este
  chiar utilizatorul sesiunii. O valoare invalida opreste pornirea.
- **Anti-clickjacking (orice raspuns, inclusiv erori)**: `X-Frame-Options: DENY` si
  `Content-Security-Policy: frame-ancestors 'none'`, ca o pagina straina sa nu poata incadra shell-ul si
  sa pacaleasca utilizatorul sa apese butoane care trimit cereri legitime. `frame-ancestors` merge doar ca
  antet HTTP, de aceea il trimite serverul; CSP-ul din `<meta>` al `index.html` ramane.
- **Host (orice cerere, si GET)**: trebuie sa fie exact `127.0.0.1:<port>` sau `localhost:<port>`, altfel 421.
  De ce: la DNS rebinding domeniul atacatorului se rezolva la 127.0.0.1, dar Host-ul ramane al lui.
- **POST (anti-CSRF)**, in ordine, altfel 403 `Cerere respinsa` (motivul exact apare doar pe stderr):
  antetul `X-DominosLand-Action: 1` (un antet custom cere preflight CORS din alt site, la care nu raspundem niciodata);
  `Origin` egal cu `http://<Host>`; `Content-Type: application/json`; `Content-Length` obligatoriu (411) si maximum 4096 (413).
- Nu se trimite niciun antet `Access-Control-*`: shell-ul e same-origin, iar site-urile externe nu trebuie sa citeasca API-ul.
- Programele externe se ruleaza cu argv (niciodata shell); iesirea capturata e limitata la 64 KiB.
- Cai statice: decodare procent, respingere `..`, `\` si NUL, apoi `canonicalize` si verificare ca ramane in directorul shell (altfel 404).
- Antetele cererii: maximum 8 KiB; cerere malformata primeste 400; citirea are timeout de 5 s.

## Verificare

```bash
cargo build --release && cargo test && cargo clippy --all-targets -- -D warnings
```
