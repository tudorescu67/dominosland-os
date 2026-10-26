<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Shell DominosLand OS

Interfața desktop afișată pe tot ecranul de un browser kiosk la pornire. HTML/CSS/JS pur (module ES),
fără dependențe npm și fără pas de build. Conține cardul „Sistem”, trei dale cu acțiuni și trei dale „în curând”.

## Servire

Fișierele sunt servite de serviciul Rust `dominosd` pe același origin (`http://127.0.0.1:7410`),
de aceea `app.js` apelează `/api/status` cu URL relativ. CSP-ul din `index.html` interzice orice resursă externă.

## Acțiuni

- **Launcher**: `POST /api/actions/launcher` pornește launcherul.
- **Mod joc**: arată starea (Pornit / Oprit / Necunoscut) din `GET /api/gamemode`, reîmprospătată odată cu starea sistemului; click comută prin `POST /api/actions/gamemode` cu `{"on": bool}`. Dala e dezactivată cât starea e necunoscută sau o cerere e în curs.
- **Jarvis**: deschide un dialog (Enter trimite, Escape închide, focusul revine pe dală); `POST /api/actions/jarvis` cu `{"text": "..."}`, 1–500 de caractere.

Protecție CSRF: orice POST trebuie să trimită `Content-Type: application/json` și `X-DominosLand-Action: 1`;
`dominosd` respinge cererile fără ele și verifică Origin/Host. `actions.js` le adaugă automat.

## Previzualizare locală

```bash
cd os/shell && python3 -m http.server 8765
```

Apelurile `/api` vor eșua, iar linia de stare va afișa „Serviciul de sistem nu răspunde”.

## Teste

```bash
cd os/shell && node --test
```
