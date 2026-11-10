#!/usr/bin/env python3
"""Liest die Eingangstabellen für Stufe 2 aus den Volltexten und schreibt eine TypeScript-Datei.

Quellen (als Text, erzeugt mit `pdftotext -layout`):
  1. P. Jachimowicz, M. Kowal, J. Skalski, At. Data Nucl. Data Tables 138, 101393 (2021);
     arXiv:2010.10018v2, Tabelle 1 (Grundzustand) und Tabelle 2 (Sattelpunkt).
  2. P. Möller, A. J. Sierk, T. Ichikawa, H. Sagawa, FRDM(2012); arXiv:1508.06294
     (Deformationen der Targetkerne).

Aufruf:
  python3 tools/tabellen_auslesen.py jks.txt frdm.txt > packages/core/src/data/stage2/nuclei.ts
"""
import math
import re
import sys

Z_MIN, Z_MAX = 110, 120  # Compoundkerne und ihre Töchter in Stufe 2
NUM = re.compile(r'^-?\d+(\.\d+)?$')


def rows(path):
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            yield line.rstrip('\n').replace('−', '-')


def read_jks(path):
    """Gibt {(Z, N): dict} mit Grundzustands- und Sattelwerten zurück."""
    ground, saddle = {}, {}
    z = None
    for line in rows(path):
        m = re.match(r'^\s*Z\s*=\s*(\d+)\s*$', line)
        if m:
            z = int(m.group(1))
            continue
        tok = line.split()
        if z is None or not tok or not all(NUM.match(t) for t in tok):
            continue
        # Tabelle 1 hat 18 Spalten, Tabelle 2 hat 17; geprüft wird zusätzlich A = Z + N.
        if len(tok) == 18:
            v = [float(t) for t in tok]
            n, a = int(v[0]), int(v[1])
            assert a == z + n, (z, tok)
            betas = v[6:13]  # beta20, 30, 40, 50, 60, 70, 80
            ground[(z, n)] = dict(mass=v[2], etot=v[3], emic=v[5], betas=betas, sn=v[15])
        elif len(tok) == 17:
            v = [float(t) for t in tok]
            n, a = int(v[0]), int(v[1])
            assert a == z + n, (z, tok)
            # beta20, 22, 30, 40, 42, 44, 50, 60, 70, 80 -> nur die axialen (mu = 0)
            axial = [v[6], v[8], v[9], v[12], v[13], v[14], v[15]]
            saddle[(z, n)] = dict(emic=v[5], betas=axial, bf=v[16])
    return ground, saddle


def alpha(betas):
    """alpha = Summe über lambda von sqrt((2 lambda + 1)/(4 pi)) * beta_lambda0 (Hagino 2018, Gl. A22)."""
    return sum(math.sqrt((2 * lam + 1) / (4 * math.pi)) * b for lam, b in zip(range(2, 9), betas))


def read_frdm(path, wanted):
    """Deformationen beta2, beta4, beta6 aus FRDM(2012) für die gewünschten (Z, N)."""
    out, z = {}, None
    for line in rows(path):
        m = re.match(r'^\s*Z\s*=\s*(\d+)\s*(\(\w+\))?\s*$', line)
        if m:
            z = int(m.group(1))
            continue
        tok = line.split()
        if z is None or len(tok) < 14 or not all(NUM.match(t) for t in tok[:14]):
            continue
        n, a = int(float(tok[0])), int(float(tok[1]))
        if a != z + n or (z, n) not in wanted:
            continue
        # N A eps2 eps3 eps4 eps6 beta2 beta3 beta4 beta6 ...
        out[(z, n)] = (float(tok[6]), float(tok[8]), float(tok[9]))
    return out


TARGETS = [  # (Z, A, Symbol)
    (90, 232, 'Th'), (92, 238, 'U'), (94, 242, 'Pu'), (94, 244, 'Pu'), (95, 243, 'Am'),
    (96, 245, 'Cm'), (96, 248, 'Cm'), (97, 249, 'Bk'), (98, 249, 'Cf'),
]


def main():
    jks, frdm = sys.argv[1], sys.argv[2]
    ground, saddle = read_jks(jks)
    assert len(ground) == 1305 and len(saddle) == 1305, (len(ground), len(saddle))
    defo = read_frdm(frdm, {(z, a - z) for z, a, _ in TARGETS})
    assert len(defo) == len(TARGETS), defo

    w = sys.stdout.write
    w('// Erzeugt von tools/tabellen_auslesen.py. Nicht von Hand ändern.\n')
    w('//\n')
    w('// Quelle 1: P. Jachimowicz, M. Kowal, J. Skalski, At. Data Nucl. Data Tables 138, 101393 (2021);\n')
    w('//           arXiv:2010.10018v2, Tabelle 1 (Grundzustand) und Tabelle 2 (Sattelpunkt).\n')
    w('// Quelle 2: P. Möller, A. J. Sierk, T. Ichikawa, H. Sagawa, FRDM(2012); arXiv:1508.06294.\n')
    w('\n')
    w('/**\n * Kerne mit Z = %d bis %d. Je Zeile:\n' % (Z_MIN, Z_MAX))
    w(' * [Z, N, Massenexzess (MeV), Grundzustandsenergie E_tot relativ zur makroskopischen Kugel (MeV),\n')
    w(' *  Schalenkorrektur im Grundzustand E_mic (MeV), Neutronen-Bindungsenergie S_n (MeV),\n')
    w(' *  Spaltbarriere B_f (MeV), Schalenkorrektur am Sattel (MeV), alpha_gs, alpha_sd]\n')
    w(' * alpha = Summe über lambda von sqrt((2 lambda + 1)/(4 pi)) * beta_lambda0 (axiale Deformationen).\n */\n')
    w('export const NUCLEI_RAW: readonly (readonly number[])[] = [\n')
    for (z, n) in sorted(ground):
        if not Z_MIN <= z <= Z_MAX:
            continue
        g, s = ground[(z, n)], saddle[(z, n)]
        w('  [%d, %d, %.2f, %.2f, %.2f, %.2f, %.2f, %.2f, %.4f, %.4f],\n' % (
            z, n, g['mass'], g['etot'], g['emic'], g['sn'], s['bf'], s['emic'], alpha(g['betas']), alpha(s['betas'])))
    w('];\n\n')
    w('/** Deformationen der Targetkerne nach FRDM(2012): [Z, A, beta2, beta4, beta6]. */\n')
    w('export const TARGET_DEFORMATIONS_RAW: readonly (readonly number[])[] = [\n')
    for z, a, sym in TARGETS:
        b2, b4, b6 = defo[(z, a - z)]
        w('  [%d, %d, %.3f, %.3f, %.3f], // %d%s\n' % (z, a, b2, b4, b6, a, sym))
    w('];\n')


if __name__ == '__main__':
    main()
