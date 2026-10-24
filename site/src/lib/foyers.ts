/**
 * LE dénominateur « par foyer » du site.
 *
 * Le livre emploie quatre « foyers » différents (30 / 29,5 / 31 M de foyers, et 40,2 M de foyers
 * fiscaux, voir /methode#foyers). Tout ré-échelonnement « par foyer » fait par le site utilise
 * UN SEUL dénominateur : les **30 millions de foyers** que les auteurs écrivent dans leurs fiches
 * (fact `fiche_pop_foyers`).
 *
 * Pourquoi celui-là :
 *   1. c’est un chiffre écrit par les auteurs (les trois autres sont déduits, ou ne mesurent pas la
 *      même chose : un foyer fiscal n’est pas un ménage) ;
 *   2. c’est aussi le dénominateur implicite de « 600 Md€, soit 20 000 € par foyer » ;
 *   3. il correspond à l’unité du simulateur, le ménage.
 *
 * Les montants « par foyer » écrits par les auteurs eux-mêmes (54 000 €, 8 000 €, 20 000 €…) restent
 * attribués aux auteurs, avec leur propre dénominateur, sur la page Méthode seulement. Ne jamais
 * comparer deux montants « par foyer » de sources différentes.
 */
import { millions } from '@/lib/facts';
import { formatNumber } from '@/lib/format';

/** Nombre de foyers retenu, en unités. */
export const FOYERS = millions('fiche_pop_foyers');
/** Même nombre, en millions. */
export const FOYERS_M = FOYERS / 1e6;

/** Un montant national en Md€ → euros par foyer et par an. */
export const perFoyerYear = (md: number): number => (md * 1e9) / FOYERS;
export const perFoyerMonth = (md: number): number => perFoyerYear(md) / 12;
export const perFoyerDay = (md: number): number => perFoyerYear(md) / 365;
export const perFoyerHour = (md: number): number => perFoyerDay(md) / 24;

/** « 30 millions de foyers », à imprimer à côté de tout montant « par foyer ». */
export const FOYERS_LABEL = `${formatNumber(FOYERS_M)} millions de foyers`;
/** Version courte pour les tuiles : « 30 M de foyers ». */
export const FOYERS_SHORT = `${formatNumber(FOYERS_M)} M de foyers`;
/** Phrase de note de bas de page, partout où un « par foyer » apparaît. */
export const FOYERS_NOTE = `Par foyer : montant national ÷ ${FOYERS_LABEL}, le chiffre des fiches des auteurs. Les autres dénominateurs du livre sont détaillés dans la Méthode.`;
