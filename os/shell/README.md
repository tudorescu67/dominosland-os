<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Shell DominosLand OS

Interfața desktop afișată pe tot ecranul de un browser kiosk la pornire. HTML/CSS/JS pur (module ES),
fără dependențe npm și fără pas de build. Deocamdată este doar pentru citire: dale „în curând” și cardul „Sistem”.

## Servire

Fișierele sunt servite de serviciul Rust `dominosd` pe același origin (`http://127.0.0.1:7410`),
de aceea `app.js` apelează `/api/status` cu URL relativ. CSP-ul din `index.html` interzice orice resursă externă.

## Previzualizare locală

```bash
cd os/shell && python3 -m http.server 8765
```

Apelurile `/api` vor eșua, iar linia de stare va afișa „Serviciul de sistem nu răspunde”.

## Teste

```bash
cd os/shell && node --test
```
