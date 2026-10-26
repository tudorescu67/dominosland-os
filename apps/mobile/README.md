<!-- Copyright (c) 2026-2027 DominosLand by Capitanul Burcea-Alex. -->
# DominosLand pentru telefon

> 🚧 **În lucru.** Aici va fi varianta mobilă a DominosLand OS. Folderul conține deocamdată planul.

## Ce va face

| Pentru jucători | Pentru staff |
| --- | --- |
| Serverele DominosLand live, cu jucători și ping | Notificări pentru incidente și servere căzute |
| Jarvis AI în buzunar | Tichete Discord: răspuns, preluare, închidere |
| Notificări pentru evenimente și tichete | Restart și status pentru servere, cu confirmare |
| Contul DominosLand: profil, Dominos Coins | Aprobări Jarvis și audit |
| Remote Link: controlezi launcherul de pe PC | |

## Tehnologie

- **Expo / React Native + TypeScript**, ca un singur cod să meargă pe Android și iOS.
- **Expo SecureStore** pentru token, niciodată AsyncStorage.
- Același API ca launcherul (`api.dominosland.com`) și același cont.
- Notificările push nu conțin date sensibile.

## Etape

1. **Android**: login, servere live, Jarvis, notificări. Se publică `DominosLand.apk` în Releases.
2. **Remote Link**: telefonul pornește clipuri, live și Game Booster pe launcherul de pe PC.
3. **Staff**: tichete, servere și aprobări, cu 2FA și confirmare pentru acțiunile sensibile.
4. **iOS**: build prin EAS și publicare în App Store.

## Când pornește codul

Proiectul Expo se creează aici, în `apps/mobile`, cu `app.json` la rădăcina folderului. Workflow-ul de release detectează automat `app.json` și construiește APK-ul alături de installer-ul de Windows.
