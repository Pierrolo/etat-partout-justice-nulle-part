/**
 * Une seule façon de dire « 465 ou 486 niches » sur tout le site :
 *   « 465 niches fiscales + 21 taux réduits de TVA = 486 ».
 * Les 465 niches sont listées une à une (PLF 2026, annexe Dépenses fiscales) ; les 21 taux réduits de TVA
 * ne sont publiés qu’en agrégat ; leur somme donne les « 486 niches » du manifeste.
 * Fonction pure : les nombres viennent de facts.json, passés par l’appelant (page ou île).
 */
import { formatInteger } from './format';

export function nichesEquation(niches: number, vat: number, total: number): string {
  return `${formatInteger(niches)} niches fiscales + ${formatInteger(vat)} taux réduits de TVA = ${formatInteger(total)}`;
}
