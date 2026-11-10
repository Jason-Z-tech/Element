import { nuclideParts } from '../format';

/** Kern mit hochgestellter Massenzahl. */
export function Nuclide({ id }: { id: string }) {
  const { mass, symbol } = nuclideParts(id);
  return (
    <span class="nuclide">
      <sup>{mass}</sup>
      {symbol}
    </span>
  );
}
