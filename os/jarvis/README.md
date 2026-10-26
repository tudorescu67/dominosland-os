<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# dl-jarvis

Asistentul local DominosLand OS: înțelege comenzi scurte în română și rulează doar acțiuni dintr-o listă fixă.

## Exemple

```bash
dl-jarvis stare
dl-jarvis pornește modul joc
dl-jarvis oprește modul joc
dl-jarvis deschide launcherul
dl-jarvis            # mod interactiv; "ieșire" pentru a închide
```

## Variabile de mediu

| Variabilă | Implicit |
| --- | --- |
| `DOMINOSD_URL` | `http://127.0.0.1:7410` |
| `DL_GAMEMODE_BIN` | `dl-gamemode` |
| `DL_LAUNCHER_CMD` | `dominosland-launcher` |

## Securitate

Textul nu ajunge niciodată într-o comandă: este clasificat într-o intenție, iar fiecare intenție
are o listă argv fixă (fără `shell=True`). Fără intenție cunoscută, nu se execută nimic.

## Teste

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```
