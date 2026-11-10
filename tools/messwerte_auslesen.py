#!/usr/bin/env python3
"""Erzeugt aus docs/daten/er_wirkungsquerschnitte.csv die Messwerte für Eichung und Prüfung von Stufe 2.

Aufruf:
  python3 tools/messwerte_auslesen.py > packages/core/src/data/stage2/measurements.ts

Regeln (vor dem ersten Blick auf die Prüf-Reaktionen festgelegt):
  - Nur positive Messungen (keine Obergrenzen) mit verlässlicher Energie.
  - Energie: Strahlenergie in der Mitte des Targets, umgerechnet in die Schwerpunktsenergie.
    Wo nur die Energie am Beschleuniger bekannt ist, wird E* umgerechnet (Feld `energyFrom`).
  - Über die Breite des angegebenen E*-Bereichs (Energieverlust im Target) wird gemittelt.
  - Eichung: 48Ca + 238U, 242Pu, 243Am, 248Cm, 249Bk. Prüfung: alle übrigen vereinbarten Reaktionen.
"""
import csv
import re
import sys

CSV = 'docs/daten/er_wirkungsquerschnitte.csv'

CALIBRATION = [
    '3a', '3b', '3c', '3e', '3f',
    '4a', '4b', '4c', '4d', '4e', '4f', '4g',
    '5a2', '5c', '5d1', '5d2', '5d3', '5d4', '5e', '5f1', '5f2', '5g', '5h', '5i1', '5j2',
    '5k1', '5k2', '5k3', '5l1', '5l2', '5m1', '5m2', '5n1', '5n2', '5n3', '5o', '5p',
    '6f', '6g', '6i', '6j',
    '7e1', '7e2', '7f2', '7f3', '7f4', '7i1', '7i2',
]
TEST = [
    '1a', '1b',
    '2a', '2b', '2c', '2d', '2e', '2f', '2g', '2j', '2k',
    '6a', '6b', '6c', '6d1', '6d2',
    '8a1', '8a2', '8b1', '8b2',
    '9a', '9b', '9c', '9d1',
]

MASS = {'Ca': 48, 'Ti': 50, 'Cr': 54}

# Energien, die nicht direkt aus der Tabelle folgen. Wert: (E_cm, Herkunft).
#   'E*+Q(Dubna)': E* mit dem Q-Wert umgerechnet, der aus der Dubna-Messung derselben Reaktion folgt
#                  (243 MeV Strahl, E* 38,9–43,0 MeV: Q = −162,1 MeV).
#   'E*+Q(Tabelle)': E* mit dem Q-Wert unserer Massentabelle umgerechnet (Q der Arbeit unbekannt).
Q_DUBNA_CA_PU244 = (38.9 + 43.0) / 2 - 243 * 244 / 292
OVERRIDE = {
    '2d': ('estar', Q_DUBNA_CA_PU244, 'E*+Q(Dubna)'),
    '2e': ('estar', Q_DUBNA_CA_PU244, 'E*+Q(Dubna)'),
    '2f': ('estar', Q_DUBNA_CA_PU244, 'E*+Q(Dubna)'),
    '2g': ('estar', Q_DUBNA_CA_PU244, 'E*+Q(Dubna)'),
    '9a': ('ecm', 220.0, 'E_cm'),
    '9b': ('estar', None, 'E*+Q(Tabelle)'),
    '9c': ('estar', None, 'E*+Q(Tabelle)'),
    '9d1': ('estar', None, 'E*+Q(Tabelle)'),
}


def number(text):
    m = re.match(r'^\s*(-?\d+(\.\d+)?)', text)
    return float(m.group(1)) if m else None


def estar_range(text):
    """Gibt (Mitte, Breite) des E*-Bereichs zurück."""
    text = text.strip()
    m = re.match(r'^(\d+(\.\d+)?)-(\d+(\.\d+)?)', text)
    if m:
        lo, hi = float(m.group(1)), float(m.group(3))
        return (lo + hi) / 2, hi - lo
    m = re.match(r'^(\d+(\.\d+)?)\s*\(\+(\d+(\.\d+)?)\s*-(\d+(\.\d+)?)\)', text)
    if m:
        return float(m.group(1)), float(m.group(3)) + float(m.group(5))
    m = re.match(r'^(\d+(\.\d+)?)\((\d+)\)', text)
    if m:
        return float(m.group(1)), 2 * float(m.group(3))
    v = number(text)
    return (v, 0.0) if v is not None else (None, 0.0)


def elab(text):
    m = re.search(r'\((\d+\.\d+)\)\s*$', text.strip())  # „252.0-256.1 (254.0)“
    if m:
        return float(m.group(1))
    m = re.match(r'^(\d+(\.\d+)?)-(\d+(\.\d+)?)', text.strip())
    if m:
        return (float(m.group(1)) + float(m.group(3))) / 2
    return number(text)


def main():
    rows = {r['id']: r for r in csv.DictReader(open(CSV, encoding='utf-8'), delimiter=';')}
    w = sys.stdout.write
    w('// Erzeugt von tools/messwerte_auslesen.py aus docs/daten/er_wirkungsquerschnitte.csv. Nicht von Hand ändern.\n\n')
    w('export interface MeasurementRow {\n')
    w('  readonly id: string;\n  readonly role: \'eichung\' | \'pruefung\';\n')
    w('  readonly projectile: readonly [symbol: string, z: number, a: number];\n')
    w('  readonly target: readonly [symbol: string, z: number, a: number];\n')
    w('  /** Zahl der abgedampften Neutronen. */\n  readonly neutrons: number;\n')
    w('  /** Schwerpunktsenergie in MeV; `null` = aus E* mit dem Q-Wert der Massentabelle umzurechnen. */\n  readonly eCm: number | null;\n')
    w('  /** Anregungsenergie laut Arbeit in MeV (Mitte des Bereichs), falls angegeben. */\n  readonly eStar: number | null;\n')
    w('  /** Breite des Energiebereichs im Target in MeV, über die gemittelt wird. */\n  readonly width: number;\n')
    w('  readonly sigma_pb: number;\n  readonly errPlus_pb: number;\n  readonly errMinus_pb: number;\n')
    w('  /** Woher die Energie stammt. */\n  readonly energyFrom: string;\n')
    w('  readonly lab: string;\n  readonly reference: string;\n  /** P = Original, X = EXFOR, X+ = EXFOR vom Autor bestätigt, S = Sekundärquelle. */\n  readonly status: string;\n}\n\n')
    z = {'Ca': 20, 'Ti': 22, 'Cr': 24, 'Th': 90, 'U': 92, 'Pu': 94, 'Am': 95, 'Cm': 96, 'Bk': 97, 'Cf': 98}
    w('export const MEASUREMENTS: readonly MeasurementRow[] = [\n')
    for role, ids in (('eichung', CALIBRATION), ('pruefung', TEST)):
        for i in ids:
            r = rows[i]
            pm = re.match(r'(\d+)([A-Za-z]+)', r['projectile'])
            tm = re.match(r'(\d+)([A-Za-z]+)', r['target'])
            ap, ps, at, ts = int(pm.group(1)), pm.group(2), int(tm.group(1)), tm.group(2)
            neutrons = int(r['channel'][0])
            mid, width = estar_range(r['Estar_MeV'])
            source = 'Strahl'
            ecm = None
            if i in OVERRIDE:
                kind, value, source = OVERRIDE[i]
                if kind == 'ecm':
                    ecm = value
                elif value is not None:
                    ecm = mid - value
            else:
                e = elab(r['E_lab_MeV'])
                assert e is not None, i
                ecm = e * at / (ap + at)
            assert r['upper_limit'] == 'no', i
            w('  { id: %r, role: %r, projectile: [%r, %d, %d], target: [%r, %d, %d], neutrons: %d, eCm: %s, eStar: %s, width: %.1f, sigma_pb: %s, errPlus_pb: %s, errMinus_pb: %s, energyFrom: %r, lab: %r, reference: %r, status: %r },\n' % (
                i, role, ps, z[ps], ap, ts, z[ts], at, neutrons,
                'null' if ecm is None else '%.2f' % ecm, 'null' if mid is None else '%.2f' % mid, width,
                r['sigma_pb'], r['err_plus_pb'], r['err_minus_pb'], source, r['lab_separator'], r['primary_reference'], r['status']))
    w('];\n')


if __name__ == '__main__':
    main()
