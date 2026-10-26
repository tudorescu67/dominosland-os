<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# Securitate

Ai găsit o problemă de securitate în aplicațiile DominosLand? Te rugăm **să nu deschizi un issue public**.

Raporteaz-o privat din tab-ul **Security → Report a vulnerability** al acestui repository. Alternativ, deschide un tichet în serverul Discord DominosLand.

Spune-ne ce ai găsit, cum se reproduce și ce versiune a aplicației folosești. Îți răspundem cât de repede putem și te ținem la curent până la rezolvare.

## Reguli pentru cod

- Repository-ul este **public**. Token-uri, chei API, parole, IP-uri de servere sau ID-uri personale nu intră niciodată în git.
- Aplicațiile client nu au voie să execute acțiuni pe servere direct. Totul trece prin API, care verifică rolul contului.
