/**
 * Les 465 niches fiscales, en version compacte pour l'explorateur (/comprendre/niches).
 * Produit au build : un fichier statique `data/niches.json`, chargé à la demande par l'îlot
 * (et non copié dans chaque page). Source : src/data/niches.json (pipeline), champs utiles seulement.
 */
import type { APIRoute } from 'astro';
import niches from '@/data/niches.json';
import { toRows, type RawNiche } from '@/lib/niches-model';

export const GET: APIRoute = () => {
  const rows = toRows(niches.niches as unknown as RawNiche[]);
  return new Response(JSON.stringify({ count: rows.length, rows }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
