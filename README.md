# Elementjäger

Gemeinsam nach neuen superschweren Elementen (119, 120) rechnen – ein
Open-Source-Browserspiel mit echten Monte-Carlo-Simulationen.

> **Das ist eine Simulation.** Sie kann vorhersagen, wo man suchen sollte.
> Eine Entdeckung ist erst das im Beschleuniger gemessene Atom.

## Grundsätze

1. Die Physik ist ehrlich. Nichts wird schöngerechnet, damit das Spiel leichter wird.
2. Jede Zahl im Code ist ein Messwert mit Quelle, eine veröffentlichte Vorhersage
   mit Quelle oder als Annahme markiert (`packages/core/src/data/`).
3. Jedes Ergebnis hat einen Fehlerbalken und ist reproduzierbar (Seed, Version).

## Stand

| Schritt | Inhalt | Stand |
|---|---|---|
| 1 | `packages/core`: Stufe 1 (Experiment nachspielen) mit Tests | fertig |
| 2 | `packages/web`: Oberfläche für Einzelspieler, GitHub Pages | offen |
| 3 | Stufe 2: Physik selbst rechnen (Einfang, Verschmelzen, Überleben) | offen, erst Modell-Vorschlag |
| 4 | `packages/server`: Team-Funktion | offen |
| 5 | Ergebnis- und Methoden-Seite | offen |

## Starten

Voraussetzung: Node.js ab Version 20.

```bash
npm install
```

```bash
npm test
```

```bash
npm run demo
```

`npm run demo` spielt das Berkeley-Experiment, eine Messung für Element 120 und
eine Messreihe gegen die „verdeckte Natur“ auf der Konsole durch.

## Aufbau

```
packages/core     Physik. Keine DOM-Zugriffe; läuft in Browser, Web Worker und Node.
  src/data/         Zahlen mit Herkunft: sources, constants, reactions, decays
  src/rng.ts        mulberry32, Seed-Ableitung, Poisson, Exponential
  src/kinematics.ts E_cm, E*, Bass-Barriere
  src/crossSection.ts  Anregungsfunktionen, Modus „verdeckte Natur“
  src/rate.ts       Rate mit Berkeley-Eichung
  src/decayChain.ts Zerfallsketten, Zählregel, exakte Ketten-Effizienz
  src/statistics.ts Poisson-Vertrauensgrenzen
  src/experiment.ts eine Messung nachspielen und auswerten
  test/             Vitest, darunter der Pflicht-Test berkeley.test.ts
packages/web      (Schritt 2)
packages/server   (Schritt 4)
```

## Stufe 1: Das Experiment nachspielen

Hauptreaktion ⁵⁰Ti + ²⁴⁹Cf → Element 120, Testlauf ⁵⁰Ti + ²⁴⁴Pu → Element 116
(Berkeley 2024).

**Energie.** `E_cm = E_lab · A_Target / (A_Projektil + A_Target)`, `E* = E_cm + Q`.

**Bass-Barriere.** Maximum des Potentials von Bass (1977):
`V(r) = Z₁Z₂e²/r − R₁R₂/(R₁+R₂) · g(s)`, `s = r − R₁ − R₂`,
`g(s) = 1 / (0,0300·e^(s/3,30 fm) + 0,0061·e^(s/0,65 fm))` MeV/fm,
`R = 1,16·A^(1/3) − 1,39·A^(−1/3)` fm.
Ergebnis: Ti+Cf 226,20 MeV, Ti+Pu 217,25 MeV.

**Trefferquote.** Je Kanal eine Gauß-Kurve über E* mit Breite 4 MeV.

**Rate.** `Rate = σ · Targetkerne/cm² · Strahlkerne/s · 0,556 · Separator`.
Der Faktor 0,556 eicht auf Berkeley.

**Ablauf einer Messung.** Fusionen als Poisson-Prozess über die Strahlzeit, dann
je Kern die Zerfallskette mit exponentiell verteilten Zeiten. 90 % der Alphas
werden voll gemessen, der Rest „entwischt“. Eine Kette zählt bei mindestens
2 vollen Alphas oder 1 vollem Alpha plus Spaltung innerhalb von 1 s.

**Auswertung.** `σ = Σ_Kanäle N / (Empfindlichkeit · Ketten-Effizienz)`. Fehler:
Poisson-Grenzen zu 68 % nach Gehrels (1986); bei 0 Ereignissen Obergrenze aus
1,84 Ereignissen. Die Ketten-Effizienz wird exakt aus den Zerfallsdaten gerechnet
(²⁹⁰Lv: 94,8 %).

**Verdeckte Natur.** Wahres Maximum zufällig zwischen 6 und 80 fb, beste Energie
um bis zu ±5 MeV verschoben. Nur Messreihen verraten sie.

### Berkeley-Eichung (Pflicht-Test)

440 fb, 6·10¹² Kerne/s, 0,44 mg/cm², Separator 70 %, 22,1 Tage:

| Größe | Wert |
|---|---|
| Kerne hinter dem Separator (Formel) | 2,13 |
| Ketten-Effizienz ²⁹⁰Lv (Zählregel) | 94,8 % |
| erkannte Ketten im Mittel | 2,02 |
| Auswertung von 2 Ketten | 436 (+575 −281) fb; veröffentlicht 440 (+580 −280) fb |

## Zahlen und ihre Herkunft

| Größe | Wert | Art | Quelle |
|---|---|---|---|
| σ(⁵⁰Ti+²⁴⁴Pu, 4n) | 440 fb bei E* 41 MeV | gemessen | Gates et al., PRL 133, 172502 (2024), arXiv:2407.16079 |
| σ(⁵⁰Ti+²⁴⁹Cf) 3n / 4n / 5n | 12,87 / 48,2 / 9,9 fb bei E* 34 / 41 / 52 MeV | Vorhersage | arXiv:2604.09287 |
| Q(Ti+Pu), Q(Ti+Cf) | −179,0 MeV; −197,7 MeV (±3 MeV) | Abschätzung | Projektvorgabe |
| Bass-Barriere | Formel | berechnet | R. Bass, PRL 39, 265 (1977) |
| Eichfaktor | 0,556 | Eichung | an Gates et al. (2 Ketten in 22,1 Tagen) |
| Strahl, Target, Separator | 6·10¹² /s; 0,44 mg/cm²; 70 % | Standardwerte | Projektvorgabe |
| ²⁹⁰Lv, ²⁸⁶Fl, ²⁸²Cn, ²⁸⁸Lv, ²⁸⁴Fl, ²⁷⁵Ds, ²⁷¹Hs | siehe `decays.ts` | gemessen | Projektvorgabe, Originalarbeiten noch zu benennen |
| ²⁹⁵120, ²⁹¹Og, ²⁸⁷Lv, ²⁸³Fl, ²⁷⁹Cn, ²⁹⁶120, ²⁹²Og | siehe `decays.ts` | Schätzung | Viola-Seaborg-Systematik, Projektvorgabe |
| Poisson-Grenzen | 68 %, 1,84 bei 0 Ereignissen | Formel | N. Gehrels, ApJ 303, 336 (1986) |
| N_A, e² | 6,02214076·10²³ /mol; 1,43996448 MeV fm | Konstante | CODATA 2018 / SI 2019 |

**Noch nicht am Original geprüft.** Alle Quellen tragen im Code `checked: false`:
Die Zahlen stammen aus der Projektvorgabe, die Originalarbeiten waren beim
Erstellen nicht abrufbar. Das wird nachgeholt, bevor Ergebnisse veröffentlicht
werden.

## Annahmen und offene Punkte

Annahmen (nicht belegt, im Code markiert):

- Die Zeiten der Zerfallsdaten sind **Halbwertszeiten**; mittlere Lebensdauer = T½ / ln 2.
- „Breite 4 MeV“ ist die **Standardabweichung** der Gauß-Kurve.
- Für ⁵⁰Ti + ²⁴⁴Pu ist nur ein Punkt gemessen. Dass er das Maximum ist und die
  Kurve ebenfalls 4 MeV breit ist, ist eine Annahme.
- Geschätzte Kerne zerfallen nur per Alpha (keine Spaltungskonkurrenz).
- Eine Spaltung wird immer nachgewiesen. Das 1-s-Fenster zählt ab dem Einschlag.
- Kein Untergrund, keine Totzeit, kein Energieverlust und keine Energiebreite im Target.
- Die Zuordnung Kette → Kanal ist bekannt (im Experiment liest man sie aus den
  Zerfallseigenschaften ab).
- Verdeckte Natur: Maximum logarithmisch gleichverteilt, Verschiebung
  gleichverteilt; alle Kanäle werden gemeinsam skaliert und verschoben.
- Molare Masse = Massenzahl in g/mol; die Targetdicke meint das reine Isotop.

Offen (keine Daten, deshalb nichts erfunden):

- **5n-Kanal von Element 120** (²⁹⁴120 → ²⁹⁰Og → ²⁸⁶Lv → ²⁸²Fl): keine
  Zerfallsdaten. Die Kerne werden erzeugt und gezählt, aber nicht als Kette
  nachgewiesen; die Auswertung nennt den Kanal ausdrücklich als offen.
- **Alpha-Energie von ²⁸⁸Lv**: nicht angegeben, im Protokoll „E offen“.
- **Zerfallsart von ²⁷¹Hs**: nicht angegeben; die Kette endet dort.

## Mitmachen

Fehler, Quellenhinweise und Verbesserungen sind willkommen, am liebsten als
Issue oder Pull Request. Regeln:

- Keine Zahl ohne Herkunft: Messwert mit Quelle, Vorhersage mit Quelle oder als
  Annahme markiert.
- Jede Änderung an Daten oder Formeln erhöht die Modellversion
  (`packages/core/src/version.ts`).
- `npm test` und `npm run typecheck` müssen bestehen; der Berkeley-Test darf
  nicht aufgeweicht werden.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
