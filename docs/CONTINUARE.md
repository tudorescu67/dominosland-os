<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Prompt pentru continuarea proiectului

Copiază blocul de mai jos într-o sesiune nouă de Claude Code, deschisă pe repository-ul
`tudorescu67/dominosland-os`. Prompt-ul e scris ca să meargă și dacă starea s-a schimbat între timp:
noua sesiune își citește singură starea din repository și de pe GitHub.

---

```text
Continuăm proiectul DominosLand din repository-ul public tudorescu67/dominosland-os.

Pas 1 — orientare (nu schimba nimic încă):
- Citește CLAUDE.md, docs/MEMORIE.md (ce s-a făcut și s-a decis), docs/STATUS.md și os/README.md.
- Verifică pe GitHub: pull request-urile deschise (în special #1, din branch-ul
  claude/hopeful-sagan-oa0dod în main), CI-ul pe ultimul commit, inclusiv workflow-ul
  „OS image” care construiește ISO-ul, și comentariile de review nerezolvate.
- Rulează local: cd os && ./build.sh && ./build.sh test-image

Pas 2 — repară ce e roșu, înainte de orice extindere:
- Dacă workflow-ul „OS image” a picat, citește log-ul job-ului „ISO standard”, găsește
  cauza (pachet lipsă, hook care eșuează, etc.), repară și împinge. ISO-ul trebuie să iasă verde.
- Rezolvă comentariile de review rămase (verifică fiecare; repară ce e real; răspunde pe fir).

Pas 3 — continuă extinderile, în ordinea din docs/STATUS.md, secțiunea
„Recomandări de extindere”. Pentru fiecare:
- implementare cu teste (Rust: cargo test + clippy, și cargo +1.85.1 test pentru Debian 13;
  JS: node --test; Python: unittest; C++: ctest; scripturile imaginii: ./build.sh test-image);
- acțiunile noi din dominosd urmează modelul existent: POST /api/actions/*, aceleași verificări
  (UID-ul sesiunii, Host, Origin, antetul X-DominosLand-Action, JSON), comenzi ca argv fără shell,
  cu timeout; ce cere root trece printr-un unit systemd permis de polkit doar pentru acel unit;
- bifează în docs/STATUS.md, commit cu mesaj clar, push pe branch-ul de lucru, verifică CI.

Reguli: repository-ul e public (fără secrete, IP-uri, ID-uri personale); fiecare fișier nou are
antetul de copyright; interfața e în română; DominosLand OS e bazat pe Linux (Debian 13), fără
nucleu propriu; launcherul NU este DominosLand OS.

La final: actualizează docs/STATUS.md și acest fișier (docs/CONTINUARE.md) cu starea nouă și
cu următorii pași, ca următoarea sesiune să poată continua la fel.
```

---

## Planul extinderilor, cu designul deja decis

Ordinea de lucru. Pentru fiecare, designul de mai jos e deja verificat ca fezabil; sesiunea nouă îl poate implementa direct.
Toate acțiunile noi din `dominosd` folosesc modelul existent (`POST /api/actions/*`, aceleași verificări, argv fără shell, timeout)
și primesc teste de integrare cu programe false puse în `PATH`, ca testele existente din `os/services/tests/server.rs`.

### 1. Setări: Wi-Fi și sunet (placa „Setări”)

- `GET /api/settings/wifi` → `nmcli -t -f ACTIVE,SSID,SIGNAL,SECURITY dev wifi list`.
  Ieșirea `-t` scapă `:` din SSID ca `\:` — parserul trebuie să țină cont.
- `POST /api/actions/wifi` `{ssid, password?}` → `nmcli --ask dev wifi connect <ssid>`, cu **parola pe stdin**, nu în argv:
  argumentele proceselor sunt vizibile altor utilizatori în `/proc`. `run_with_timeout` primește o variantă cu date pe stdin.
  NetworkManager permite implicit utilizatorului din sesiunea activă să se conecteze, deci nu e nevoie de polkit nou.
- `GET /api/settings/sound` → `wpctl get-volume @DEFAULT_AUDIO_SINK@` (ex. `Volume: 0.40 [MUTED]`).
- `POST /api/actions/volume` `{level: 0..100}` și `{mute: true|false}` → `wpctl set-volume` / `wpctl set-mute`.
  PipeWire rulează în sesiunea utilizatorului (pornită de `PAMName=login`), deci `wpctl` merge din `dominosd`.

### 2. Actualizări din interfață

- Unit `dl-update.service` (root, `Type=oneshot`): `apt-get update` apoi `apt-get -y upgrade`, cu `DEBIAN_FRONTEND=noninteractive`.
- Regulă polkit ca la modul joc: utilizatorul local activ poate porni **doar** `dl-update.service`.
- `POST /api/actions/update` → `systemctl start --no-block dl-update.service` (durează minute; nu ținem cererea deschisă).
- `GET /api/updates` → `systemctl show dl-update.service -p ActiveState,Result,ExecMainExitTimestamp`; interfața arată „rulează / reușit / eșuat”.

### 3. Jarvis conectat la Jarvis AI (cercetat în `pannel-all`)

- Endpoint public: `POST https://api.dominosland.com/api/control/jarvis/ask`, corp `{"question": "..."}` (1–800 caractere),
  antet `Authorization: Bearer <token>`. Răspuns `{ok, answer, model}`. Când Jarvis e oprit, vine HTTP 200 cu `ok: false`,
  deci clientul verifică `ok`. Limită: 10 întrebări pe minut per cont. Orice membru logat are acces, nu doar staff-ul.
- Login: `POST /api/auth/login` `{username, password}` → `{access_token, user}`. Token-ul expiră după 24 h.
  Dacă serverul are doar login prin Discord (`DISCORD_AUTH_ONLY`), login-ul cu parolă e refuzat; mesajul trebuie să spună asta.
- `dominosd` nu are TLS (std fără dependențe), deci **Python face apelurile HTTPS**:
  - `dl-jarvis --login` citește `{"username", "password"}` ca JSON de pe **stdin**. Salvează token-ul în
    `~/.config/dominosland/token` cu permisiuni `0600` și nu scrie parola nicăieri.
  - `dl-jarvis --logout` șterge fișierul.
  - O întrebare pe care regulile locale nu o recunosc merge la Jarvis AI dacă există token. Fără token,
    răspunsul spune cum te conectezi.
- `dominosd`: `POST /api/actions/account/login` (pasează JSON-ul pe stdin către `dl-jarvis --login`) și `POST /api/actions/account/logout`.
- Interfața are o secțiune „Cont DominosLand” în Setări, cu formular de login și starea „conectat ca X / neconectat”.

### 4. Magazin: aplicații și jocuri (Flatpak)

- Pachetul `flatpak` în imagine.
- Instalările se fac **per utilizator**, fără root: `flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo`,
  apoi `flatpak install --user -y --noninteractive flathub <id>`.
- O listă fixă de aplicații recomandate în `dominosd`, nu id-uri primite din cerere: Steam (`com.valvesoftware.Steam`, include Proton),
  Discord (`com.discordapp.Discord`), Lutris, Heroic, OBS Studio.
- Instalarea durează minute: `dominosd` pornește procesul detașat, ține PID-ul în memorie, iar `GET /api/store` arată
  „instalat / se instalează / neinstalat” (`flatpak info --user <id>`).
- `POST /api/actions/store/launch {id}` → `flatpak run <id>`.

### 4b. Jocuri cu anti-cheat (Easy Anti-Cheat, BattlEye)

Ce e posibil, spus cinstit:
- **Easy Anti-Cheat și BattlEye merg pe Linux prin Proton numai dacă dezvoltatorul jocului a activat suportul
  pentru Linux/Proton.** Atunci Steam instalează singur „Proton EasyAntiCheat Runtime” / „Proton BattlEye Runtime”, iar jocul merge.
- Jocurile la care dezvoltatorul NU l-a activat (ex. Fortnite) și cele cu anti-cheat de kernel (ex. Vanguard la Valorant) nu merg
  pe niciun Linux. **Nu încercăm ocoliri**: ar încălca termenii jocurilor și ar duce la ban.

Ce face DominosLand OS:
1. `vm.max_map_count = 2147483642` în `/etc/sysctl.d/80-dominosland-games.conf`, aceeași valoare ca SteamOS. Unele jocuri recente se
   închid cu limita implicită a nucleului. (Pregătit împreună cu GRUB.)
2. Steam din Magazin (Flatpak `com.valvesoftware.Steam`) vine cu Proton. Runtime-urile EAC/BattlEye se descarcă automat de Steam.
   Pentru jocurile non-Steam (Epic prin Heroic), Heroic folosește aceleași runtime-uri prin Proton/umu.
3. **Starea anti-cheat în Magazin**: lista publică AreWeAntiCheatYet (fișierul `games.json` din repository-ul GitHub
   `AreWeAntiCheatYet/AreWeAntiCheatYet`) arată pentru fiecare joc: „Supported” (merge), „Running” (merge parțial),
   „Broken” / „Denied” (nu merge). `dl-jarvis` (Python, are HTTPS) o descarcă și o păstrează în cache 24 h. Interfața arată starea
   lângă fiecare joc, ca utilizatorul să știe dinainte.
4. Nucleul Debian 13 (6.12) are deja `futex_waitv` (fsync), folosit de Proton pentru performanță; nu e nevoie de nucleu modificat.

### 5. Fișiere

- Doar directoarele XDG ale utilizatorului (Imagini, Videoclipuri, Descărcări), citite din `~/.config/user-dirs.dirs`, și `~/Clipuri`.
- `GET /api/files?dir=<nume din listă>` → nume, mărime, dată.
- `GET /api/files/raw?dir=&name=` servește imagini și videoclipuri pentru previzualizare în interfață. Aceeași protecție la
  path traversal ca la fișierele interfeței: `canonicalize` + `starts_with`.

### 6. GRUB cu logo (pregătit)

- Fișierele sunt gata: `/etc/default/grub.d/dominosland.cfg` (`GRUB_DISTRIBUTOR`, `GRUB_BACKGROUND`, `GRUB_TIMEOUT=3`) și un fundal
  1920×1080 cu logo-ul. Dacă nu sunt încă în `os/image/config/includes.chroot`, se refac ușor:
  fundal `#070b1a`, logo-ul de 300 px centrat sus.
- Meniul ISO-ului live (isolinux / grub-efi) are nevoie de șabloanele din `/usr/share/live/build/bootloaders`, copiate în
  `os/image/config/bootloaders/` și modificate. Se testează doar într-o mașină virtuală.

### 7. Depozit apt propriu (actualizări prin rețea)

- Pachete `.deb` pentru `dominosd`, `dl-gamemode`, `dl-jarvis` și interfață, construite în CI.
- Un depozit semnat (`reprepro` sau `aptly`) publicat pe GitHub Pages sau pe serverul DominosLand. Cheia de semnare stă **doar** în
  secretele GitHub sau pe server, niciodată în git.
- Imaginea adaugă depozitul și cheia publică, ca `dl-update.service` să aducă și versiunile DominosLand noi.

## Starea la momentul scrierii (26 octombrie 2026)

- Pull request deschis: `claude/hopeful-sagan-oa0dod` → `main` (#1). `main` nu e încă branch-ul implicit pe GitHub.
- Primul build al ISO-ului pe GitHub („OS image”) a ieșit **verde** (~15 min). ISO-ul nu a fost încă pornit într-o mașină virtuală.
- Făcut: `dominosd` acceptă doar conexiuni de la UID-ul sesiunii (`/proc/net/tcp`), plus antete anti-încadrare. Memoria completă: [MEMORIE.md](MEMORIE.md).
- Ordinea extinderilor și ce e făcut: [STATUS.md](STATUS.md).
