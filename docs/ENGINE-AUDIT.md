# Audit du moteur `@epjn/engine` — correction de la modélisation

Audit indépendant, 24 octobre 2026. Périmètre : `engine/src/**`, `engine/test/**`, `engine/cas-types-results.json`,
au regard des amendements (research/pages/amendements__*.md), de `research/reform_parameters.json`,
`research/baseline/baseline-rules.md`, `docs/VISION.md` §6 et `docs/METHODE.md`. Priorité : le côté « plan ».

**Verdict.** La chaîne du plan est juste sur l'essentiel. Les points suivants ont été vérifiés à la main sur 9 cas types
et sont exacts au centime : la suppression de la CSG/CRDS sur les revenus d'activité, la hausse du revenu imposable
qui en découle (la CSG déductible disparaît), le 23 % avec la déduction de 10 % (H2), les montants de l'AFU et
l'excédent versé, l'abrogation des prestations familiales, la sortie de l'APL, H1, les pensions (CSG maintenue,
abattement de 10 % supprimé, majoration de 3 300 € seulement si `startYear < 2028`), et l'égalité entre la somme du
waterfall et le delta affiché (vérifiée sur 752 combinaisons : cas types × périodes × H1 × TVA, aucun écart).
J'ai trouvé **un biais de valeur par défaut (moyen)**, **trois erreurs de règle (faibles)** dont une côté
« aujourd'hui », et **trois problèmes de libellé**. Tous sont corrigés et couverts par des tests de régression
(`engine/test/audit.test.ts`).

## 1. Constats et corrections

| # | Gravité | Constat | Correction |
|---|---|---|---|
| A1 | **Moyenne** | Un enfant bénéficiaire de l'AEEH était supposé titulaire de la CMI « invalidité » (+6 600 €/an d'AFU, H15). Or l'AEEH peut être versée dès 50 % d'incapacité (taux de 50 à 79 % avec établissement spécialisé ou soins), alors que la CMI « invalidité » exige 80 % (CASF L241-3). Am. 28 conditionne la majoration à la détention de la carte. Le défaut gonflait le gain de 550 €/mois sans que l'utilisateur ait rien déclaré. | `cmiInvalidite` vaut désormais **false par défaut** et n'est lu que si `aeeh` vaut true. Le libellé H15 dit ce que la CMI ajouterait. Cas type `famille-aeeh` : **+1 310 → +760 €/mois**. ENGINE-API demande à l'UI une case à cocher distincte. |
| A2 | Faible (côté aujourd'hui, mais crée une asymétrie) | Dans l'IR d'aujourd'hui : (i) pas de ½ part pour les titulaires de la CMI « invalidité » (adulte `aah_80`, enfant CMI ; CGI 195), alors que le plan leur verse la majoration ; (ii) abattement de l'art. 157 bis réservé aux 65 ans et plus, et appliqué une seule fois par foyer. Le texte vise aussi les invalides et **double** l'abattement quand chacun des conjoints remplit la condition. | `fiscalParts(…, invalidHalfParts)` et `IncomeTaxInput.abattement157bisPersons`/`invalidHalfParts` (paramètres optionnels, rétrocompatibles). Le plafonnement suit celui de droit commun (1 807 €/½ part). La réduction complémentaire de l'art. 197 I 2 n'est pas modélisée et le libellé le dit. Le test golden neutralise la ½ part CMI, que l'oracle OpenFisca ne déclare pas (case P). Aucun delta de cas type ne change en régime permanent. |
| A3 | Faible (2027) | H18 : pendant la baisse de 2027, la part déductible de la CSG baissait « au prorata 6,8/9,2 ». Or l'art. 154 quinquies CGI admet la déduction « à hauteur de 6,8 points » et aucun amendement ne le modifie. La part déductible vaut donc min(taux, 6,8 %) : en juillet 2027, 6,8 points sur 7,6, et à partir d'août la totalité. | `csg2027()` corrigé ; H18 passe au niveau « Loi ». Delta 2027 des contribuables : +1 à +16 €/mois (par ex. `seul-5` 203 → 216). |
| A4 | Faible (2028) | Le taux de CSG des pensions était **figé** au niveau actuel en 2028. Or il dépend du RFR N-2 = revenus 2026, et l'abattement de 10 % disparaît dès l'IR sur les revenus 2026 (am. 1 IV.A, 120°). Un retraité dont le RFR n'était sous le seuil que grâce à l'abattement change de taux dès 2028. | Nouveau mode `pensionTier: 'rfr2026'` : barème actuel, salaires actuels, sans abattement pensions. La formule indique « RFR 2026 ». L'année 2027 reste figée (RFR 2025). Test A4 : un retraité passe de 4,3 % à 7,4 %. |
| A5 | Libellé | H13 disait « AFU adulte même rattachés au foyer des parents ». Or l'art. 196 B (rattachement des majeurs) est abrogé pour l'IR 2028 (am. 1 III 130°, IV.C) : le jeune majeur forme son propre foyer et perçoit sa propre aide. Le total du ménage est le même. | Libellé corrigé (METHODE H13 aussi). |
| A6 | Libellé | H17 et la formule APL ne parlaient que du parc conventionné (am. 32 II). Le III (parc privé) dit autre chose : aide entière jusqu'au terme du bail, sans reconduction, au plus tard le 1er janvier 2030. | Libellés corrigés : voir la décision (d). |
| A7 | Libellé | Accords « abrogé(e) », « remplacé(e) » (« Allocations familiales abrogé(e) »). | Accord explicite (« abrogées », « remplacée »…). |
| A8 | Info | Fonctionnaires : le taux employeur CNRACL est appliqué aux trois fonctions publiques, y compris l'État. | Libellé « non modélisé » précisé (voir (a)). Aucun effet sur le revenu disponible. |

Tests : `pnpm --filter @epjn/engine test`, 92 tests au vert, dont 7 nouveaux. Les propriétés passent aussi avec
`FC_RUNS=3000`. `pnpm typecheck` passe. Le snapshot et `cas-types-results.json` sont régénérés.

## 2. Décisions sur les points signalés par le constructeur

**(a) Cotisations des fonctionnaires.** Le taux employeur **CNRACL 2026 de 37,65 % est juste** (décret n° 2025-86 :
+3 points par an de 2025 à 2028, soit 34,65 %, 37,65 %, 40,65 % puis 43,65 %). Pour l'État (FPE), la contribution
employeur au CAS Pensions est d'environ **78,28 %** (civils) : le coût employeur et `hourOfWork` des fonctionnaires
d'État sont donc nettement sous-estimés. Le **revenu disponible n'en dépend pas** : la retenue pension de 11,10 % et
la RAFP sont communes aux trois fonctions publiques, et la CSG s'applique à 98,25 % du brut. Les primes à 20 % du
brut sont une moyenne plausible (plus élevées chez les cadres A) et sont marquées « hypothèse ». **Approximation
acceptable**, désormais signalée explicitement dans `notModelled`. Un statut `fonctionnaire_etat` serait un
changement d'API : non fait.

**(b) AEEH ⇒ CMI.** **Non défendable comme défaut** : voir A1. Le choix est désormais explicite (`cmiInvalidite`,
défaut false). La ½ part d'aujourd'hui suit la même déclaration, ce qui évite d'accorder la CMI d'un seul côté de la
comparaison.

**(c) Taux de CSG des pensions sans quotient familial.** L'art. L136-8 III CSS fixe les seuils en RFR « pour la
première part de quotient familial, majorée de … par demi-part supplémentaire ». Am. 28 abroge l'art. 194 CGI et
am. 1 abroge les ½ parts de l'art. 195, mais **aucun amendement ne touche L136-8** : le renvoi reste sans objet et
une coordination sera nécessaire. Il y a trois lectures possibles :
1. le nombre de parts de l'ancien art. 194, figé ;
2. 1 part par adulte + ½ par enfant (choix actuel, H16) ;
3. lecture littérale : plus de parts, donc 1 part par foyer.

Les lectures 1 et 2 ne diffèrent que pour les familles de 3 enfants ou plus et les parents isolés retraités, qui sont
rares. La lecture 3 ferait passer la plupart des **couples** de retraités au taux plein : `retraite-couple-3200`
passerait de 7,4 % à 9,1 %, soit environ −54 €/mois. **Je garde H16 (lecture 2)** : c'est la lecture qui respecte
l'intention (seuils proportionnés à la taille du foyer), elle préserve l'invariant 6, et elle reste marquée
« Hypothèse ». Le libellé mentionne désormais l'article non modifié et le calendrier N-2 (constat A4). La lecture 3
est documentée dans METHODE H16 comme sensibilité.

**(d) APL des baux en cours.** Am. 32 II (logement conventionné) : montant plafonné à celui de décembre 2026, −1/3
au 1er juillet 2027, −2/3 au 1er juillet 2028, fin au 1er juillet 2029 ou au départ. Am. 32 III (autres logements) :
**aide entière** jusqu'au terme du bail, du contrat de séjour ou du prêt en cours au 1er janvier 2027, sans
renouvellement ni reconduction, au plus tard le 1er janvier 2030. Le barème modélisé est celui du parc privé : il faut
donc l'échéance du bail, que l'utilisateur ne donne pas. Pour un bail nu de 3 ans dont l'échéance tombe uniformément
dans le cycle, la part d'aide conservée en moyenne annuelle vaut 1 − (mois moyen)/36, soit **5/6 (2027), 1/2 (2028),
1/6 (2029), 0 (2030)**. C'est exactement le calendrier conventionné (10/12, 6/12, 2/12). **Le défaut est donc une
bonne espérance** pour les deux parcs. Il ne convient pas aux baux meublés ou étudiants (1 an), qui s'arrêtent
pendant l'année 2027. Il est conservé avec un libellé corrigé (A6).

**(e) Calibration de la TVA.** Aujourd'hui, le taux effectif est de 10,7 à 10,8 % de la consommation, ce qui
correspond à la référence INSEE (10,73 %). Plan en régime permanent, panier fixe et répercussion de 100 % : le
surcoût vaut Σ s_k (20 % − τ_k)/(1 + τ_k) ≈ **3,4 % de la consommation** (moyenne nationale ; de 3,7 % pour les
ménages modestes à 3,1 % pour les plus aisés, avec la pente supposée). Rapporté à 1 350–1 400 Md€ de consommation des
ménages, cela fait environ **46–48 Md€**. C'est un peu au-dessus du classeur des auteurs (9,9 + 33,4 = 43,3 Md€) et
nettement au-dessus du CPO (30 Md€ en 2021, cité dans l'exposé de l'am. 21). Ces chiffres sont cohérents avec un
**majorant de premier ordre** (pas de substitution, répercussion intégrale). L'hypothèse est marquée comme telle et
peut être réglée à 0, 50 ou 100 % (H5). **Acceptable.** La pente de 25 % sur la tranche à 5,5 % est une hypothèse
non vérifiable avec les données en main ; elle reste signalée comme hypothèse.

## 3. Calculs à la main (régime permanent, hypothèses par défaut, €/mois)

SMIC 2026 = 1 867,02 € brut. Assiette CSG = 98,25 % du brut. Aujourd'hui : CSG 9,2 % dont 6,8 % déductible, CRDS
0,5 %.

**Seul·e, 1 SMIC, locataire zone 2 (`seul-1`)**

| Poste | Calcul | Aujourd'hui | Plan | Δ |
|---|---|---|---|---|
| Cotisations salariales | 6,90 % + 0,40 % + 3,15 % + 0,86 % du brut | 211,16 | 211,16 | |
| CSG/CRDS | 9,7 % × 1 834,35 | 177,93 | 0 | |
| Salaire net | 1 867,02 − 211,16 − 177,93 | 1 477,93 | 1 655,86 | **+177,93** |
| Imposable annuel | aujourd'hui : (1 867,02 − 211,16 − 124,74) × 12 × 0,9 = 16 536 ; plan : 1 655,86 × 12 × 0,9 = 17 883 | | | |
| IR | aujourd'hui : (16 536 − 11 600) × 11 % = 543, décote 897 − 0,4525 × 543 = 651 ⇒ 0 ; plan : 23 % × 17 883 = 4 113/an | 0 | −342,76 | **−342,76** |
| AFU | 6 600 / 12 | 0 | 550 | **+550** |
| Prime d'activité | golden | 229,72 | 0 (H1) | **−229,72** |
| **Total** | | 1 707,65 | 1 863,10 | **+155,45** ✓ |

**Seul·e sans revenu, locataire 450 € zone 2 (`seul-0`)** : RSA 651,69 − forfait logement 78,20 = 573,49 ; APL
308,41 ; AFU 550. Δ = 550 − 573,49 − 308,41 = **−331,90** ✓. Avec H1 « différentiel » : RSA 651,69 − 550 = 101,69
(plus de forfait logement, faute d'aide au logement), imposable : 23 % × 1 220 = 23,39/mois, d'où Δ = **−253,60** ✓.

**Parent isolé, 1 SMIC, 2 enfants (4, 9), loyer 700 € (`mono-1-2e`)** : +177,93 (CSG) − 342,76 (IR) + 1 100 (AFU =
(6 600 + 2 × 3 300)/12) − 182,83 (PA) − 298,91 (APL) − 152,25 (AF = 32 % × BMAF 478,16, net de CRDS) − 35,57 (ARS)
− 401,55 (ASF = 2 × 42,2 % BMAF) = **−135,94** ✓. En 2027, Δ = −6 ; en 2028, +14 (l'APL vaut encore la moitié de son
montant).

**Couple marié, 2 × SMIC, 2 enfants (6, 10), loyer 800 € (`famille-1-1-2e`)** : +355,86 (CSG) − 685,53 (23 % ×
35 767/12) + 1 650 ((2 × 6 600 + 2 × 3 300)/12) − 370,70 (PA) − 152,25 (AF) − 71,14 (ARS) = **+726,24** ✓.

**Retraité·e seul·e, 70 ans, 1 500 € net, propriétaire (pension liquidée en 2018)**

| Poste | Aujourd'hui | Plan |
|---|---|---|
| Brut (fixé) | 1 500 / (1 − 4,3 %) = 1 567,40 | 1 567,40 |
| RFR | 1 567,40 × 0,962 × 12 = 18 094 ; − 10 % (1 809) − 157 bis (2 822) = 13 463 ⇒ taux réduit (≤ 17 057) | 1 567,40 × 0,958 × 12 = 18 019 (sans abattements) > 17 057 ⇒ **taux médian 7,4 %** |
| Pension nette | 1 500,00 | 1 451,41 (−48,59) |
| IR | 13 463 → (13 463 − 11 600) × 11 % = 205, effacé par la décote ⇒ 0 | 23 % × 18 019 = 4 144/an ⇒ −345,36 |
| AFU | — | (6 600 + 3 300)/12 = 825 |
| **Δ** | | **+431,05** ✓ |

Même pension liquidée en 2028 : pas de majoration de 3 300 € (vérifié : `retraite-2028`, AFU 550 et un
avertissement).

**Adulte handicapé (50–79 %) sans revenu, loyer 450 € (`aah50-seul`)** : AAH 1 041,59 et APL 308,41 sont perdues ;
AFU 550 sans majoration (pas de CMI). Δ = **−800,00** ✓. Le cas ≥ 80 % (`aah80-seul`) : AFU 1 100, Δ = −250. Avec
un mi-temps au SMIC (`aah80-mi-temps`) : l'AAH aujourd'hui vaut 1 041,59 − (689 − 80 % × 560,11 − 40 % × 128,89) =
852,23 ✓ ; plan Δ = +88,97 − 171,38 + 1 100 − 852,23 − 212,80 = **−47,44** ✓.

**Seul·e, 5 SMIC cadre, propriétaire (`seul-5`)** : brut 9 335,10 ; CSG 889,66 supprimée. IR aujourd'hui sur RNI
83 200 : 19 779 × 11 % + 53 621 × 30 % = 18 064/an = 1 505,34. Plan : 23 % × (8 327,42 × 12 × 0,9) = 20 685/an =
1 723,78. Δ = 889,66 − 218,44 + 550 = **+1 221,22** ✓. Très haut revenu (20 000 € brut) : l'assiette CSG est de
98,25 % jusqu'à 4 PMSS puis 100 % ; la déduction de 10 % est plafonnée à 14 555 € ✓ ; Δ = +3 573 (CEHR non
modélisée, signalée).

**Couple 1,5 + 1 SMIC, enfants de 15 et 20 ans (`famille-jeune-majeur`)** : AFU = (3 × 6 600 + 3 300)/12 = 1 925 ✓
(le jeune de 20 ans touche l'AFU adulte, H13) ; IR 23 % × 44 708 = 856,91 ; PA −282,11. Pas d'AF aujourd'hui
(moins de deux enfants de moins de 20 ans). Δ = 444,83 − 856,91 + 1 925 − 282,11 = **+1 230,81** ✓.

**Demandeur·se d'emploi, ARE 1 100 € net (`chomeur-are`)** : ARE exonérée de CSG (sous le seuil SMIC) et inchangée
(H6). Imposable 13 200 × 0,9 = 11 880 ⇒ 23 % = 227,70 ; AFU 550 ; APL −100,50. Δ = **+221,80** ✓. La CSG sur l'ARE
est bien maintenue : PLFSS am. 1 V : « la contribution demeure due sur les revenus de remplacement ».

**Couple marié 1 SMIC + conjoint inactif (`couple-1-0`)** : +177,93 − 342,76 + 1 100 − 486,19 (PA) − 61,07 (APL) =
**+387,91** ✓.

**Waterfall.** Chaque étape est `r2(plan − aujourd'hui)` d'une composante arrondie au centime, donc Σ étapes =
delta exactement. Vérifié sur les 47 cas × 4 périodes × 2 variantes H1 × TVA oui/non : 0 écart.

## 4. Points vérifiés sans écart

- PLFSS am. 1 : CSG de 7,6 / 6,0 / 4,3 / 2,7 / 1,1 % de juillet à novembre 2027, CRDS 0,5 % jusqu'en novembre
  (V et VI à partir du 1er décembre 2027), RGDU maintenue (II 3°).
- Am. 28 : 6 600 € par personne majeure, 3 300 € par personne à charge jusqu'à l'année de ses 18 ans, +6 600 € par
  CMI « invalidité », +3 300 € par pension liquidée avant le 1er janvier 2028, excédent restitué, aucun cumul avec
  les prestations familiales, application aux revenus 2028.
- Am. 1 : l'art. 83 3° (10 %) n'est pas abrogé (H2 bien fondée) ; 158 5 a (abattement pensions, 120°) abrogé dès
  l'IR 2026 ; 157 bis (119°) et 195/196 B (126°–130°) abrogés pour l'IR 2028.
- PLFSS am. 7 : AF, CF, ASF, PAJE, AEEH et ARS sont abrogées au 1er janvier 2028. Le RSA, la prime d'activité,
  l'AAH et l'ASPA ne le sont par aucun texte : leur niveau « Annoncé » est juste.
- `nonRecours`, total CAF déclaré, mode « différentiel » : l'AFU entre dans les ressources, les aides maintenues
  deviennent imposables à 23 % (cohérent avec l'abrogation des exonérations de l'art. 81 visée par am. 28 VII).
  Pas de double comptage.

## 5. Laissé en l'état (et pourquoi)

- **Réduction complémentaire de l'art. 197 I 2 pour les ½ parts d'invalidité** : sous-estime légèrement l'avantage
  actuel des titulaires de la CMI à revenu élevé. Signalée dans `notModelled`.
- **Taux de CSG de l'ARE fonction du RFR** (0 / 3,8 / 6,2 %) : seuil d'exonération SMIC seulement. Même règle des
  deux côtés ; effet sur le delta négligeable.
- **Couples non mariés** : le taux de CSG des pensions est calculé au niveau du ménage dans le plan, alors qu'il y a
  en droit deux foyers fiscaux. Choix assumé pour l'invariant 6 ; écart rare (retraités non mariés).
- **Fonction publique d'État** : voir (a). Ajouter un statut casserait l'API.
- **AFU l'année des 18 ans** : le texte verse 3 300 € jusqu'à l'année des 18 ans ; le moteur passe à 6 600 € dès
  18 ans révolus. Écart d'au plus une année ; non corrigé.
- **TVA** : panier fixe et répercussion de 100 % par défaut, un majorant documenté.
- Le site (`site/`) n'a pas été modifié. L'UI devrait exposer `cmiInvalidite` (voir ENGINE-API, « Audit changes »).

## 6. Gagnants et perdants (cas types, régime permanent)

Toujours **37 gagnants, 10 perdants**. Seul `famille-aeeh` change en régime permanent : **+1 310 → +760 €/mois**.
Les perdants restent les ménages sans revenu d'activité ou à temps partiel qui vivaient des minima et de l'APL :
- AAH 50–79 % : −800 ;
- parent isolé sans revenu : −658 ;
- parent isolé à mi-temps avec 2 enfants : −366 ;
- parent isolé à 2 SMIC avec 3 enfants en zone 1 : −354 ;
- RSA seul : −332 ;
- AAH ≥ 80 % sans revenu : −250 ;
- parent isolé au SMIC avec 2 enfants : −136 ;
- AAH ≥ 80 % à mi-temps : −47 ;
- parent isolé au SMIC avec 1 enfant : −31 ;
- mi-temps seul : −12.

Les plus gros gains vont aux hauts revenus et aux familles nombreuses aisées (+1 200 à +1 800). En 2027, les deltas
des salariés imposables augmentent de 1 à 16 €/mois (A3).
