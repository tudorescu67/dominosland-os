<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# dl-jarvis

Asistentul local DominosLand OS: înțelege comenzi scurte în română și rulează doar acțiuni dintr-o listă fixă.

## Exemple

```bash
dl-jarvis stare
dl-jarvis pornește modul joc
dl-jarvis oprește modul joc
dl-jarvis deschide launcherul
dl-jarvis -- "-text care începe cu liniuță"   # după `--` totul este text, nu opțiuni
dl-jarvis            # mod interactiv; "ieșire" pentru a închide
```

## Variabile de mediu

| Variabilă | Implicit |
| --- | --- |
| `DOMINOSD_URL` | `http://127.0.0.1:7410` |
| `DL_GAMEMODE_BIN` | `dl-gamemode` (doar pentru `status`) |
| `DL_SYSTEMCTL` | `systemctl` |
| `DL_LAUNCHER_CMD` | `dominosland-launcher` |

## Modul joc

Pornirea/oprirea rulează `systemctl start dl-gamemode@on.service` (sau `@off`), pentru că scrierea
guvernatorilor CPU cere root, iar asistentul rulează ca utilizatorul sesiunii. O regulă polkit permite
utilizatorului local activ să pornească exact aceste două unități. Starea se citește cu `dl-gamemode status`.

## Convenția `--`

`dl-jarvis -- <text...>` tratează tot ce urmează după `--` ca text, deci un text care începe cu `-`
nu este niciodată interpretat ca opțiune. Serviciul de sistem apelează `dl-jarvis -- "<text>"`
cu textul ca un singur argument. `--version` este recunoscut doar înainte de `--`.

## Securitate

Textul nu ajunge niciodată într-o comandă: este clasificat într-o intenție, iar fiecare intenție
are o listă argv fixă (fără `shell=True`). Fără intenție cunoscută, nu se execută nimic.

## Teste

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```
