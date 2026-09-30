# Planung Sync (iOS)

Kleine iPhone-App, die deine Planung-Tasks in beide Richtungen mit Apple Erinnerungen und Apple Kalender synchronisiert.

- Alle offenen Tasks landen in der Erinnerungen-Liste **„Planung“**.
- Tasks mit Uhrzeit erscheinen zusätzlich als Termin im Kalender **„Planung“**.
- Abhaken, Umbenennen und Verschieben funktionieren in beide Richtungen. Neue Erinnerungen und Termine in „Planung“ werden zu Tasks.
- Eine gelöschte Erinnerung löscht den Task. Ein gelöschter Termin entfernt nur die Uhrzeit.
- Synchronisiert wird beim Öffnen der App, beim Herunterziehen der Liste, bei Änderungen in Erinnerungen/Kalender (solange die App offen ist) und im Hintergrund, wenn iOS es zulässt.

## Installation (kostenlose Apple-ID)

1. Die Web-App muss mit den neuen `/api/mobile/*`-Routen deployed sein.
2. `ios/PlanungSync.xcodeproj` in Xcode öffnen.
3. Target **PlanungSync** → **Signing & Capabilities** → Team: deine Apple-ID („Personal Team“) auswählen.
   Falls die Bundle-ID schon vergeben ist, `com.noelamborelle.planungsync` leicht ändern.
4. Xcode → Settings → Components: die iOS-Plattform installieren, falls sie fehlt.
5. iPhone per Kabel verbinden, auf dem iPhone den Entwicklermodus aktivieren (Einstellungen → Datenschutz & Sicherheit → Entwicklermodus) und in Xcode auf **Run** klicken.
6. Auf dem iPhone: Einstellungen → Allgemein → VPN & Geräteverwaltung → deinem Entwicklerzertifikat vertrauen.
7. App öffnen, Server-Adresse (z. B. `https://…vercel.app`) und deinen Login eingeben und den Zugriff auf Erinnerungen und Kalender erlauben.

## 7-Tage-Erneuerung

Mit einer kostenlosen Apple-ID läuft die Signatur nach 7 Tagen ab. Die Daten bleiben erhalten, die App startet dann aber nicht mehr, bis sie neu signiert ist. Dafür gibt es zwei Wege:

- in Xcode erneut auf **Run** klicken, oder
- die gebaute App mit **SideStore** installieren. SideStore erneuert sie direkt auf dem iPhone, und mit einer Kurzbefehle-Automation („SideStore → Apps aktualisieren“, täglich) läuft das automatisch.
