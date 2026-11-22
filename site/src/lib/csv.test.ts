import { describe, expect, it } from 'vitest';
import { csvDataUri, toCsv } from './csv';

describe('toCsv', () => {
  it('writes header and rows with CRLF and raw numbers', () => {
    const csv = toCsv(
      [
        { key: 'label', label: 'Foyer' },
        { key: 'delta', label: 'Écart (€/mois)', numeric: true },
      ],
      [
        { label: 'Seul·e au SMIC', delta: 212.5 },
        { label: 'Couple, 2 enfants', delta: -40 },
      ],
    );
    expect(csv).toBe('Foyer,Écart (€/mois)\r\nSeul·e au SMIC,212.5\r\n"Couple, 2 enfants",-40\r\n');
  });
  it('escapes quotes and handles empty cells', () => {
    const csv = toCsv([{ key: 'a', label: 'a' }], [{ a: 'dit "oui"' }, { a: null }]);
    expect(csv).toBe('a\r\n"dit ""oui"""\r\n\r\n');
  });
  it('builds a data URI with a BOM', () => {
    const uri = csvDataUri('a\r\n1\r\n');
    expect(uri.startsWith('data:text/csv;charset=utf-8,%EF%BB%BF')).toBe(true);
  });
});
