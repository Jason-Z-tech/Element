/** Naturkonstanten für Stufe 2 (CODATA 2018). */

/** ħc in MeV fm. */
export const HBARC = 197.3269804;
/** Atomare Masseneinheit in MeV. */
export const AMU = 931.49410242;
/** Neutronenmasse in MeV. */
export const NEUTRON_MASS = 939.56542052;
/** 1 fm² = 10 mb = 1e10 pb. */
export const FM2_IN_PB = 1e10;
/** ħ²/(2u) in MeV fm²: Rotationsenergie = ℓ(ℓ+1) · das / J[u fm²]. */
export const ROT_CONST = (HBARC * HBARC) / (2 * AMU);
