# Noes Planer (macOS)

Native SwiftUI-App für die Planung-Web-App. Sie arbeitet mit einer lokalen Kopie aller Daten und funktioniert deshalb auch offline.

- **Heute**: zwei Tagesspalten, Tageskalender mit Terminen und Zeitblöcken. Tasks per Drag & Drop umsortieren, auf einen anderen Tag oder in den Kalender ziehen. Doppelklick in den Kalender legt einen Termin an.
- **Woche**: 7 Tage und Wochenziele mit Fortschritt.
- **Backlog**: Diese Woche / Nächste Wochen / Irgendwann und Ordner.
- **Menüleiste**: die heutigen Tasks abhaken oder neue anlegen.

## Offline & Sync

Jede Änderung wird sofort lokal gespeichert (`~/Library/Application Support/NoesPlaner/`) und in eine Warteschlange gelegt. Sobald der Server erreichbar ist, wird sie gesendet und danach der aktuelle Stand geladen. Das passiert beim Start, bei Netzwechsel, jede Minute und mit ⌘R. Für den ersten Login ist Internet nötig.

Die App braucht auf dem Server `/api/mobile/snapshot` und dass die Erstell-Routen eine vom Client erzeugte `id` annehmen. Beides steckt in diesem Repo und muss deployed sein.

## Bauen

```
./build.sh            # → build/Noes Planer.app
./build.sh --install  # zusätzlich nach /Applications kopieren
```

## Kurzbefehle

⌘N neuer Task · ⇧⌘N neuer Termin · ⌘T heute · ⌘[ / ⌘] Tag zurück/vor · ⌘1–3 Ansichten · ⌘K Kalender · ⌘R synchronisieren
