<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Prompt pentru continuarea proiectului

Copiază blocul de mai jos într-o sesiune nouă de Claude Code, deschisă pe repository-ul
`tudorescu67/dominosland-os`. Prompt-ul e scris ca să meargă și dacă starea s-a schimbat între timp:
noua sesiune își citește singură starea din repository și de pe GitHub.

---

```text
Continuăm proiectul DominosLand din repository-ul public tudorescu67/dominosland-os.

Pas 1 — orientare (nu schimba nimic încă):
- Citește CLAUDE.md, docs/STATUS.md și os/README.md.
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

## Starea la momentul scrierii (26 octombrie 2026)

- Pull request deschis: `claude/hopeful-sagan-oa0dod` → `main` (#1). `main` nu e încă branch-ul implicit pe GitHub.
- Primul build al ISO-ului pe GitHub („OS image”) era în desfășurare; rezultatul se vede în tab-ul Actions.
- În lucru: protecția `dominosd` pentru conexiunile altor utilizatori locali (verificarea UID-ului
  conexiunii prin `/proc/net/tcp`) și antetele împotriva încadrării interfeței în alte pagini.
- Ordinea extinderilor și ce e făcut: [STATUS.md](STATUS.md).
