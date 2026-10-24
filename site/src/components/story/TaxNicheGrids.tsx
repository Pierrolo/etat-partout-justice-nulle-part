import { ChartFrame } from '@/components/ui/ChartFrame';
import type { ChipProps } from '@/lib/facts';
import { formatInteger, formatNumber } from '@/lib/format';
import { UnitGrid } from './UnitGrid';

/** 438 impôts, of which the four the plan would keep. One square = one tax (announced figure, no dataset). */
export function TaxesGrid({
  total,
  kept,
  keptNames,
  share,
  alt,
  sources,
}: {
  total: number;
  kept: number;
  keptNames: string;
  /** « 75 % des recettes » (claim of the manifesto). */
  share: number;
  /** The five-tax variant of the letters (conflict D14). */
  alt: number;
  sources: ChipProps[];
}) {
  return (
    <ChartFrame
      tier="announced"
      title={`${formatInteger(total)} impôts et taxes`}
      subtitle="Un carré = un impôt, selon le manifeste. Il n’existe pas de liste publique de ces impôts dans les sources du livre."
      summary={`Le manifeste compte ${formatInteger(total)} impôts et propose d’en garder ${formatInteger(kept)} (${keptNames}), qui « portent déjà ${formatNumber(share)} % des recettes ». Les lettres aux élus parlent de ${formatInteger(alt)} impôts : les sources ne nomment pas le cinquième.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'groupe', label: 'Groupe' },
          { key: 'n', label: 'Impôts', numeric: true, format: (v) => formatInteger(Number(v)) },
        ],
        rows: [
          { groupe: `Impôts conservés (${keptNames})`, n: kept },
          { groupe: 'Autres impôts et taxes', n: total - kept },
        ],
        caption: 'Impôts et taxes selon le manifeste',
      }}
      csvFileName="impots-manifeste.csv"
    >
      <UnitGrid
        colsWide={30}
        colsNarrow={20}
        ariaLabel={`${formatInteger(total)} carrés : ${formatInteger(kept)} impôts conservés, ${formatInteger(total - kept)} autres`}
        segments={[
          {
            id: 'kept',
            label: 'Impôts conservés',
            count: kept,
            color: 'var(--series-1)',
            detail: keptNames,
          },
          {
            id: 'other',
            label: 'Autres impôts et taxes',
            count: total - kept,
            color: 'var(--series-other)',
          },
        ]}
      />
    </ChartFrame>
  );
}

/** 486 niches : the 47 that touch most households, the other 418, and 21 reduced VAT rates (aggregate only). */
export function NichesGrid({
  common,
  others,
  vat,
  total,
  costCommonMd,
  costTotalMd,
  sources,
  explorerHref,
}: {
  common: number;
  others: number;
  vat: number;
  total: number;
  costCommonMd: number;
  costTotalMd: number;
  sources: ChipProps[];
  explorerHref: string;
}) {
  return (
    <ChartFrame
      title={`${formatInteger(total)} niches fiscales`}
      subtitle={`Un carré = une niche (dépense fiscale) ou un taux réduit de TVA. Coût en 2024 : ${formatNumber(costTotalMd, { decimals: 1 })} Md€.`}
      summary={`${formatInteger(common)} niches touchent couramment les ménages (${formatNumber(costCommonMd, { decimals: 1 })} Md€ en 2024) ; les ${formatInteger(others)} autres visent surtout des entreprises ou des cas particuliers. ${formatInteger(vat)} taux réduits de TVA sont comptés à part : seul leur total est publié.`}
      sources={sources.map((s) => ({ ...s }))}
      table={{
        columns: [
          { key: 'groupe', label: 'Groupe' },
          { key: 'n', label: 'Niches', numeric: true, format: (v) => formatInteger(Number(v)) },
        ],
        rows: [
          { groupe: 'Touchent couramment les ménages', n: common },
          { groupe: 'Autres niches', n: others },
          { groupe: 'Taux réduits de TVA (liste non publiée)', n: vat },
        ],
        caption: 'Niches fiscales par groupe',
      }}
      csvFileName="niches-groupes.csv"
      note={
        <>
          « Touchent couramment les ménages » : liste éditoriale, plus les niches qui ont au moins
          un million de bénéficiaires. <a href={explorerHref}>Explorer les niches une à une</a>.
        </>
      }
    >
      <UnitGrid
        colsWide={30}
        colsNarrow={20}
        ariaLabel={`${formatInteger(total)} carrés : ${formatInteger(common)} niches pour les ménages, ${formatInteger(others)} autres, ${formatInteger(vat)} taux réduits de TVA`}
        segments={[
          {
            id: 'menages',
            label: 'Touchent couramment les ménages',
            count: common,
            color: 'var(--series-1)',
          },
          { id: 'autres', label: 'Autres niches', count: others, color: 'var(--series-other)' },
          {
            id: 'tva',
            label: 'Taux réduits de TVA',
            count: vat,
            color: 'var(--series-4)',
            detail: 'Liste non publiée : seul le total l’est.',
          },
        ]}
      />
    </ChartFrame>
  );
}
