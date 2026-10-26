# Méthode et hypothèses

Le simulateur compare, pour **votre ménage**, deux situations :

- **Aujourd'hui** : la législation en vigueur au 24 octobre 2026 (barème de l'impôt de la loi de finances pour 2026,
  prestations revalorisées en avril 2026, aides au logement revalorisées en octobre 2026, SMIC de juin 2026) ;
- **Avec le plan** de l'association Résolution, tel qu'il est écrit dans les 81 amendements qu'elle a publiés (PLF 2027,
  1re et 2de parties ; PLFSS 2027), complétés par ses fiches et son manifeste quand le texte juridique est muet.

Par défaut, le résultat est le **plan complet appliqué à 2026** : toutes les mesures en vigueur, appliquées à vos
revenus de 2026, en euros de 2026. Trois « photos » de la transition (2027, 2028, 2030) donnent la moyenne mensuelle
de chaque année. Tous les montants sont **mensuels**.

Outil indépendant de l'association Résolution et de l'État (voir [À propos](/a-propos/)). Le calcul se fait dans
votre navigateur ; rien n'est envoyé nulle part.

## En deux minutes {#en-clair}

- **Ce que fait le simulateur.** Il calcule ce qui vous reste pour vivre chaque mois (le [revenu disponible](#calcul)) aujourd'hui, puis avec le plan complet, et vous montre l'écart ligne par ligne.
- **D'où viennent les règles du plan.** Des 81 amendements rédigés et publiés par l'association Résolution (aucun n'est en vigueur), complétés par ses fiches et son manifeste quand le texte est muet. Chaque ligne dit de quel type de source elle vient.
- **Ce qui est compté par défaut.** Les mesures chiffrées dans les amendements, et le remplacement du RSA, de la prime d'activité et de l'AAH par l'AFU, que le plan annonce sans l'écrire dans un amendement (hypothèse [H1](#h1), réglable).
- **Ce qui est montré à part.** Les promesses sans montant (compte d'épargne, patrimoine rendu, compte éducation) et les pertes que le simulateur ne sait pas chiffrer. Elles ne sont jamais additionnées au résultat.
- **Ce qui est vérifié.** La situation d'aujourd'hui est comparée à OpenFisca, le moteur de référence, sur 40 ménages types : au pire quelques euros par mois d'écart ([détail](#openfisca)).
- **Ce qui n'est pas calculé.** Patrimoine, taxe foncière, santé, travailleurs indépendants… La [liste complète](#non-compte) figure aussi sur la page de résultat.

## 1. Ce qui est calculé {#calcul}

Le **revenu disponible** est : salaires nets + allocations chômage + pensions nettes + prestations − impôt sur le
revenu (+ crédits d'impôt) + aide fondamentale. La TVA est estimée à part (« après TVA »).

| Bloc | Aujourd'hui (2026) | Avec le plan |
|---|---|---|
| Salaire | brut → net : cotisations salariales, CSG 9,2 % (dont 6,8 % déductible) et CRDS 0,5 % sur 98,25 % du brut ; coût employeur avec la réduction générale dégressive (RGDU) | même brut, **CSG et CRDS supprimées** sur les revenus d'activité (gain = brut × 98,25 % × 9,7 %) |
| Statuts | privé non-cadre ; cadre (+ APEC) ; fonctionnaire (**approximation**, voir §6) | idem |
| Chômage | ARE nette déclarée ; CSG 6,2 % + CRDS 0,5 % au-delà du SMIC (écrêtement) | ARE inchangée (H6), imposée à 23 % |
| Retraite | CSG des pensions par tranche de revenu fiscal (0 / 4,3 / 7,4 / 9,1 %) | CSG maintenue ; tranche recalculée (H16) |
| Impôt sur le revenu | barème 2026, quotient familial et son plafonnement, décote, abattements 10 % (salaires et pensions), abattement « 65 ans ou invalide » (art. 157 bis, par personne, doublé pour un couple), demi-part par titulaire de la CMI « invalidité » (art. 195), seuil de recouvrement ; crédits garde d'enfants et emploi à domicile, réduction pour dons | **23 % du revenu net imposable**, sans quotient ni décote ; revenu imposable = salaire net (− 10 % de frais professionnels, H2) + pensions après CSG déductible **sans abattement de 10 %** ; niches supprimées |
| Aide fondamentale (AFU) | — | 6 600 €/an par personne majeure, 3 300 €/an par enfant de moins de 18 ans, +6 600 € par titulaire de la carte mobilité inclusion « invalidité », +3 300 € par pension liquidée avant 2028 ; l'excédent sur l'impôt est versé |
| RSA, prime d'activité | barèmes 2026, forfait logement, majoration parent isolé | remplacés par l'AFU (H1, réglable) |
| AAH, ASPA | AAH individuelle (abattements sur revenus d'activité), ASPA (seul / couple) | remplacées par l'AFU (H1, réglable) |
| Aides au logement | barème APL/AL du parc privé, zones 1/2/3 | supprimées (droits existants réduits puis éteints) |
| Prestations familiales | allocations familiales (modulation, majoration d'âge, complément dégressif), complément familial, PAJE de base, allocation de rentrée scolaire, ASF (diminuée de la pension alimentaire déclarée), AEEH de base | abrogées au 1er janvier 2028 |
| Garde des enfants de moins de 6 ans | complément de libre choix du mode de garde (CMG) : assistante maternelle, barème « linéarisé » du 1er septembre 2025 (frais × (1 − ressources × taux d'effort ÷ 4,85 €)) ; micro-crèche, montants 2026 par tranche (moitié de 3 à 6 ans, au plus 85 % de la facture) ; crèche municipale ou associative : pas de CMG. Crédit d'impôt de 50 % des frais diminués du CMG (plafond 3 500 € par enfant) | CMG abrogé au 1er janvier 2028 ; crédit d'impôt réduit d'un tiers (2027), de deux tiers (2028), supprimé (2029) |
| TVA | estimation lissée (§4) | taux réduits portés à 20 % (alimentation 10 → 15 → 20 %) ; fin des certificats d'économies d'énergie |

Chaque ligne du résultat affiche **sa formule avec vos chiffres** et **sa source** (amendement, page
service-public, Légifrance, INSEE…).

## 2. Trois niveaux de certitude {#niveaux}

Chaque chiffre du site porte l'un de ces trois statuts, avec la même présentation partout. C'est la règle centrale : ne jamais faire passer une promesse pour un texte voté.

- **Proposé dans un amendement** — texte précis d'un amendement rédigé et publié par l'association Résolution. Aucun n'est en vigueur : il s'appliquerait tel quel s'il était adopté. Rien ici n'est présenté comme une loi votée, ni comme un texte déjà déposé ou à voter. (Les lignes « aujourd'hui » suivent la législation en vigueur et n'ont pas de niveau : ce sont les règles actuelles.)
- **Annoncé** — chiffre ou promesse du plan, avancé dans le manifeste, les fiches ou le chiffrage publié, sans texte précis.
- **Notre estimation** — notre choix là où le texte est muet. Chaque estimation est numérotée dans le [registre](#registre) et souvent réglable.

Deux règles découlent de ces niveaux :

- Les promesses **sans montant** (compte d'épargne « 300 €/mois », patrimoine « 20 000 € par foyer », compte éducation « 6 600 € par enfant ») sont montrées **à part**, à côté des pertes non chiffrées, **jamais additionnées** au revenu disponible.
- Le remplacement du RSA, de la prime d'activité et de l'AAH par l'AFU est lui aussi une promesse (« à la place de toutes les aides », hypothèse [H1](#h1)), mais il est **compté par défaut** : sans lui, le résultat additionnerait l'AFU et les anciennes aides, ce que le plan ne décrit pas. Vous pouvez le désactiver (« maintenus en différentiel »), et le simulateur montre les deux lectures côte à côte quand elles diffèrent.

## 3. Registre des hypothèses {#registre}

| # | Là où le texte est muet | Choix par défaut | Niveau | Réglable |
|---|---|---|---|---|
| H1 | RSA, prime d'activité, AAH, ASPA, bourses remplacés par l'AFU ? Le manifeste dit « à la place de toutes les aides », les classeurs comptent 135 Md€ d'aides fusionnées, mais aucun amendement ne les abroge | **Remplacés** | Annoncé | Oui : « maintenus en différentiel » (l'AFU compte comme ressource, l'aide complète jusqu'au niveau actuel, elle devient imposable à 23 %) |
| H2 | La déduction de 10 % pour frais professionnels survit-elle ? (art. 83 3° CGI non abrogé) | **Maintenue** : 0,793 € gardé par euro gagné, seuil d'équilibre ≈ 31 884 € de salaire net annuel | Estimation | Oui : supprimée = lecture du plan (0,77 € ; 28 695,65 €) |
| H3 | Revenu imposable | Aujourd'hui : net + CSG non déductible + CRDS ; plan : salaire net (plus de CSG) − 10 % ; pensions : CSG déductible maintenue, abattement de 10 % supprimé | Amendement proposé | — |
| H4 | Qui capte la baisse de CSG et la fin des exonérations patronales ? | 100 % au salarié (incidence légale de court terme), salaire brut et coût employeur inchangés | Annoncé | — |
| H5 | Répercussion de la TVA et de la fin des CEE sur les prix | **100 %**, panier fixe lissé selon le niveau de vie | Estimation | Oui : 0 %, 50 %, 100 % |
| H6 | Chômage « de treize à six mois » (aucun texte) | Montant mensuel de l'ARE inchangé ; « au 7e mois : ARE = 0 » montré dans les pertes non chiffrées | Annoncé | — |
| H7 | Compte d'épargne, patrimoine, compte éducation | Montrés à part aux montants annoncés | Annoncé | — |
| H8 | Taxe foncière unique | Non modélisée (les tarifs INSEE n'existent pas encore) | — | — |
| H9 | Gel de l'indexation | En euros 2026 : non modélisé ; signalé | Amendement proposé | — |
| H10 | Garde alternée, partage de l'AFU entre parents séparés | Non modélisé (enfants dans un seul ménage) | — | — |
| H11 | Couples | Aujourd'hui : impôt commun si marié·e/pacsé·e, sinon deux foyers fiscaux (enfants rattachés à l'adulte 1) ; CAF : un seul ménage. Plan : individuel, indépendant du mariage | Amendement proposé | — |
| H12 | AFU non indexée | 6 600 € nominaux appliqués aux revenus 2026 | Amendement proposé | — |
| H13 | Jeunes de 18 à 24 ans | Toute personne majeure reçoit l'AFU adulte (550 €/mois) ; le rattachement (art. 196 B) étant abrogé en 2028 (am. 1, 130°), elle forme son propre foyer et reçoit sa propre aide — même total pour le ménage | Amendement proposé | — |
| H14 | Non-recours | Aides perçues si éligible | Estimation | Oui : « je ne touche pas ces aides » ; total CAF déclaré |
| H15 | Enfant bénéficiaire de l'AEEH | **Pas** supposé titulaire de la CMI « invalidité » : l'AEEH peut être versée dès 50 % d'incapacité, la CMI exige 80 %. Si la CMI est déclarée : +6 600 €/an d'AFU, et ½ part aujourd'hui | Estimation | Oui (défaut : non) |
| H16 | Taux de CSG des pensions quand les parts fiscales disparaissent (l'art. L136-8 CSS renvoie aux « parts de quotient familial » de l'art. 194 CGI, abrogé, et n'est pas modifié) | RFR N-2 : taux actuel en 2027 ; en 2028, RFR 2026 calculé sans l'abattement de 10 % sur les pensions ; ensuite revenu imposable du plan, 1 part par adulte + ½ par enfant. Lecture littérale alternative (1 part par foyer) : un couple de retraités passerait souvent au taux plein | Estimation | — |
| H17 | APL pendant la transition | Calendrier des logements conventionnés (am. 32 II) : −1/3 (juillet 2027), −2/3 (juillet 2028), 0 (juillet 2029). Parc privé (am. 32 III) : aide entière jusqu'au terme du bail, sans reconduction, au plus tard le 1er janvier 2030 ; pour un bail de 3 ans d'échéance inconnue (uniforme), la moyenne annuelle est la même (5/6, 1/2, 1/6). Un bail meublé (1 an) s'arrête plus tôt | Estimation | — |
| H18 | Baisse progressive de la CSG en 2027 | Part déductible = min(taux, 6,8 points) : l'art. 154 quinquies CGI (« à hauteur de 6,8 points ») n'est pas modifié | Amendement proposé | — |
| H19 | Pension alimentaire d'un parent isolé | Non déclarée : supposée non versée, l'allocation de soutien familial est versée en entier ; déclarée : l'ASF est réduite d'autant | Estimation | Oui (montant reçu) |
| H20 | Frais de garde non renseignés | Assistante maternelle : 873 €/mois par enfant (180 h au tarif médian de 4,85 €/h) ; micro-crèche : 1 620 € (180 h à 9 €/h) ; crèche : 180 h au barème national selon vos revenus. Mêmes frais avec le plan | Estimation | Oui (montant réel) |

## 4. TVA : une estimation lissée {#tva}

Le simulateur ne connaît pas votre panier : il l'estime, **sans effet de seuil** (pas de déciles).

- Niveau de vie = revenu disponible annuel ÷ unités de consommation (1 + 0,5 par autre personne de 14 ans ou plus
  + 0,3 par enfant plus jeune).
- Consommation = revenu disponible × c, où c décroît en douceur de **97 %** (ménages modestes) à **72 %** (ménages
  aisés) : c = 0,72 + 0,25 / (1 + (niveau de vie / 25 760)^4). Sources : Conseil des prélèvements obligatoires,
  note n° 6 (2023), d'après INSEE ; 25 760 € = niveau de vie médian 2023 (INSEE).
- Panier par taux : 52,2 % à 20 %, 13,3 % à 10 %, 15,4 % à 5,5 %, 0,6 % à 2,1 %, le reste exonéré (INSEE, Économie et
  Statistique n° 522-523). La part à 5,5 % (surtout l'alimentation) est jusqu'à 25 % plus élevée pour les ménages
  modestes et 25 % plus faible pour les aisés ; la part à 10 % varie de ±10 % en sens inverse (hypothèse calibrée sur
  l'enquête Budget de famille).
- Avec le plan, **le même panier** coûte plus cher : prix × (1 + répercussion × (nouveau taux − ancien taux) / (1 +
  ancien taux)). 85 % de la tranche à 5,5 % est de l'alimentation (calendrier lent) ; un quart des autres taux réduits
  sont des « niches » supprimées dès juillet 2027 (hypothèses).
- Fin des certificats d'économies d'énergie (CEE, ≈ 6 Md€/an selon la Cour des comptes) : baisse des factures de
  6 Md€ ÷ 30 millions de ménages, proportionnelle aux unités de consommation (hypothèse).

Repère : la TVA représente ≈ 10,7 % de la consommation des ménages (INSEE) ; le simulateur retrouve ce taux.

## 5. Calendrier de la transition {#calendrier}

| Date | Mesure (source) |
|---|---|
| Revenus 2026 (impôt payé en 2027) | Fin de l'abattement de 10 % sur les pensions (PLF-P1 am. 1, déduit du calendrier par défaut) |
| 1er janvier 2027 | Crédits garde d'enfants et emploi à domicile réduits d'un tiers (2027), deux tiers (2028), supprimés (2029) ; chèque énergie supprimé |
| 1er juillet 2027 | CSG sur les revenus d'activité : 7,6 % (juillet), 6,0 %, 4,3 %, 2,7 %, 1,1 % (novembre) ; CRDS 0,5 % jusqu'en novembre (PLFSS am. 1) ; taux réduits de TVA « niches » à 20 % ; fin des CEE ; dons : avantage divisé par deux ; APL des baux en cours −1/3 |
| 1er décembre 2027 | CSG et CRDS = 0 sur les revenus d'activité |
| 1er janvier 2028 | Impôt à 23 % et aide fondamentale (PLF-P1 am. 28) ; fin des prestations familiales (PLFSS am. 7) ; fin du RSA, de la prime d'activité, de l'AAH, de l'ASPA (H1) ; réduction pour dons supprimée |
| 1er juillet 2028 | Taux réduits de TVA à 20 %, alimentation à 10 % (PLF-P1 am. 21) ; APL des baux en cours −2/3 |
| 1er juillet 2029 | Alimentation à 15 % ; APL des baux en cours supprimée |
| 1er janvier 2030 | Toutes les aides personnelles au logement abrogées |
| 1er juillet 2030 | Alimentation à 20 % |

Chaque « photo » (2027, 2028, 2030) est la moyenne des 12 mois de l'année ; l'impôt est calculé une fois sur le
revenu imposable de l'année. Les retraités voient un **creux en 2027** : l'abattement de 10 % disparaît avant
l'arrivée de l'aide fondamentale.

## 6. Simplifications assumées {#simplifications}

- **Régime permanent** : revenus constants, donc les règles « trimestrielles » (RSA, prime d'activité), « N-2 »
  (prestations familiales, CSG des pensions) et « 12 mois » (APL) voient vos revenus actuels.
- **Salaire saisi en net** : le brut est retrouvé par calcul inverse selon le statut. Sans mutuelle, prévoyance,
  primes exceptionnelles, heures supplémentaires ni avantages en nature. Entreprise de moins de 11 salariés, taux
  AT/MP moyen 2,08 %.
- **Fonctionnaires (approximation)** : primes supposées égales à 20 % du brut ; retenue pour pension 11,10 % du
  traitement indiciaire, RAFP 5 % des primes ; cotisations employeur de type CNRACL (37,65 % du traitement, maladie
  9,88 %, allocations familiales 5,25 %, CSA + FNAL 0,4 %). La CSG et la CRDS sont identiques au privé, donc le gain
  du plan est exact ; le coût employeur est indicatif.
- **Cadres** : seule la cotisation APEC distingue le calcul (la prévoyance cadre n'est pas modélisée).
- **Chômage** : vous saisissez l'ARE nette ; CSG 6,2 % (dont 3,8 % déductible) et CRDS 0,5 % sur 98,25 % de l'ARE,
  écrêtées pour ne jamais ramener l'allocation sous le SMIC brut mensuel. L'ARE est imposable comme un salaire et
  compte comme ressource (pas comme revenu d'activité) pour le RSA et la prime d'activité.
- **Étudiant·es** : pas de RSA ; prime d'activité seulement si le salaire atteint 78 % du SMIC net ; **pas de bourses**
  dans cette version.
- **Couples non mariés** : deux déclarations d'impôt, enfants rattachés à l'adulte 1, un seul ménage pour la CAF.
- **AAH** : individuelle, taux ≥ 80 % (carte mobilité inclusion « invalidité ») ou 50–79 % (jusqu'à 62 ans) ;
  ressources propres, abattements sur les revenus d'activité ; couples, ESAT et majoration pour la vie autonome non
  modélisés.
- **Aides au logement** : barème du parc privé pour tous (pas de distinction HLM / conventionné, pas de réduction de
  loyer de solidarité ni de colocation).
- **Parent isolé** : pension alimentaire supposée non versée (l'allocation de soutien familial est donc perçue)
  sauf si vous la déclarez : l'ASF est alors diminuée de la pension, qui compte aussi dans les ressources du RSA et
  de la prime d'activité (elle n'est pas ajoutée au revenu disponible, identique dans les deux situations) ;
  majoration « isolement » si le plus jeune enfant a moins de 3 ans ou si la séparation est récente.
- **Garde d'enfants** : le CMG de l'assistante maternelle suit le barème du 1er septembre 2025 (taux d'effort des
  crèches : 0,0619 % pour 1 enfant, 0,0516 % pour 2, 0,0413 % pour 3 ; ressources entre 815 € et 8 500 € par mois ;
  tarif de référence 4,85 €/h, valeur 2025 ; tarif horaire supposé ≤ 8 €/h). Non modélisés : la part
  « cotisations » (100 % des cotisations de l'assistante maternelle, payée par Pajemploi), la garde à domicile, le
  complément transitoire, les majorations. OpenFisca-France 176.1.3 n'intègre pas encore cette réforme : le CMG
  n'est pas vérifié sur les cas de référence.
- **Dirigeant·e assimilé·e salarié·e** (président·e de SAS/SASU, gérant·e minoritaire de SARL) : comme un·e cadre,
  sans assurance chômage ni réduction générale des cotisations. **Travailleurs non salariés** (gérant·e majoritaire,
  indépendant·e, micro-entrepreneur·e) : non modélisés ; le simulateur le dit et ne compte pas leur revenu.
- **Total CAF déclaré** : si vous le saisissez, les aides CAF calculées sont ajustées proportionnellement, dans les
  deux scénarios.

## 7. Écart avec OpenFisca (situation actuelle) {#openfisca}

La situation actuelle est vérifiée sur **40 ménages types** calculés par OpenFisca-France 176.1.3 (le moteur
open source de référence, publié le 23 octobre 2026), ligne par ligne :

| Ligne | Écart maximal sur les 40 cas | Commentaire |
|---|---|---|
| Salaire net, net imposable | 0,01 €/mois | exact au centime dans tous les cas salariés |
| Réduction générale (RGDU), coût employeur | 0,30 €/mois | OpenFisca compte 151,67 h au lieu de 151,6667 h |
| Pensions nettes | 0,00 € | |
| RSA, APL, complément familial, PAJE, ASF, ASPA, AAH | ≤ 0,01 €/mois | |
| Allocations familiales | 1,63 €/mois (1 cas) | cas « juste au-dessus du plafond » : base de ressources N-2 d'OpenFisca |
| Prime d'activité | 6,12 €/mois (1 cas) | OpenFisca utilise l'APL de juillet-septembre, avant la revalorisation d'octobre |
| Allocation de rentrée scolaire | 0,49 €/an | |
| Impôt sur le revenu | 2,18 €/an | OpenFisca arrondit à l'euro |
| Revenu disponible | 6,08 €/mois (1 cas), 0,01 € pour 27 cas | conséquence de la prime d'activité ci-dessus |

Tolérances des tests : 0,08 € (salaires), 0,40 € (RGDU), 0,60 € (prestations), 3 €/an (impôt), 8 € (revenu
disponible), avec deux exceptions documentées à 7 €. Les fonctionnaires, l'ARE, les couples non mariés, l'AEEH, les
dons et l'emploi à domicile ne sont **pas** couverts par ces cas : ce sont des approximations.

Le plan est vérifié sur les chiffres publiés : gain de CSG au SMIC 2025 (1 801,80 € brut) = **171,72 €/mois** ;
table « GraphIR » (revenu imposable 0 / 8 000 / 21 000 / 34 000 / 48 000 €) avec la lecture du plan (H2
désactivée) ; seuil 28 695,65 € ; 0,77 € gardé par euro ; adulte handicapé : 1 100 €/mois.

## 8. Ce que le simulateur ne compte pas {#non-compte}

- les revenus et la fiscalité du patrimoine et de l'épargne (intérêts, dividendes, loyers perçus, plus-values) ;
- la taxe foncière, aujourd'hui comme avec la taxe foncière unique du plan ;
- le compte d'épargne personnel, le patrimoine « rendu », le compte éducation (montrés à part) ;
- la durée de l'indemnisation chômage (six mois annoncés) ;
- la part « cotisations » du complément de mode de garde et le coût des crèches après la fin de leur financement
  par les CAF ;
- le reste à charge de 10 % par acte de soin et le bouclier sanitaire ;
- le gel de la revalorisation des pensions et prestations (calcul en euros 2026) ;
- la fin des exonérations sur l'épargne réglementée et l'assurance-vie ;
- le chèque énergie, les bourses, la complémentaire santé solidaire, les tarifs sociaux et aides locales ;
- les suppressions de postes publics et l'indemnité de départ ;
- les effets sur les salaires, l'emploi, les loyers et les prix autres que la TVA et les CEE ;
- les travailleurs non salariés (indépendants, gérants majoritaires), les DOM, l'Alsace-Moselle.

Ces éléments figurent, quand ils vous concernent, dans les panneaux « Promesses non chiffrées » et « Pertes non chiffrées »,
à poids égal.

## 9. Cas-types {#cas-types}

La page « Qui gagne, qui perd ? » montre 47 ménages types **illustratifs et non pondérés** : ils ne disent rien de la
proportion de ménages gagnants ou perdants en France (nous n'avons pas de données individuelles). Les résultats sont
publiés dans le fichier [`cas-types-results.json`](https://github.com/Pierrolo/etat-partout-justice-nulle-part/blob/main/engine/cas-types-results.json) du dépôt.

## 10. Sources principales {#sources}

- Plan : liasses d'amendements Résolution (PLF 2027 1re partie, 2de partie, PLFSS 2027, 19 octobre 2026) —
  france-resolution.fr/amendements ; fiches et manifeste — france-resolution.fr ; classeurs « Synthèse Chiffres » et
  « Synthèse Graphiques ».
- Législation 2026 : service-public.gouv.fr (F2300 SMIC, F2971 CSG, F1419 impôt, F2882 prime d'activité, F19778
  RSA, F12006 APL, F13213 allocations familiales, F12242 AAH, F16871 ASPA…), Légifrance, URSSAF (taux 2026),
  BOFiP (barème 2026), solidarites.gouv.fr (revalorisation du 1er avril 2026), arrêté du 28 septembre 2026 (APL).
- Statistiques : INSEE (niveau de vie 2023, unités de consommation, Économie et Statistique n° 522-523), Conseil des
  prélèvements obligatoires (note TVA 2023), Cour des comptes (CEE).
- Vérification : OpenFisca-France 176.1.3.

Chaque paramètre (plus de 300) porte sa valeur, son unité, sa date d'effet et sa source dans le
[code du moteur](https://github.com/Pierrolo/etat-partout-justice-nulle-part/tree/main/engine/src/params), publié en open source.

## 11. Où les sources se contredisent {#ecarts-sources}

Le manifeste, les amendements et les classeurs ne disent pas toujours la même chose. **Aucun chiffre n'est corrigé en silence** : quand deux sources divergent, le site conserve les deux valeurs, dit laquelle sert au calcul ou au graphique, et renvoie ici. Les écarts sont numérotés D01 à D34 ; les plus visibles sont rappelés d'abord.

## 12. Journal des modifications {#journal}

| Date | Version | Ce qui a changé |
|---|---|---|
| 26 octobre 2026 | site | Le site parle du plan avec ses propres mots ; un seul vocabulaire pour les trois niveaux (« Proposé dans un amendement », « Annoncé », « Notre estimation ») ; les amendements sont décrits comme rédigés et publiés, en vigueur nulle part ; questionnaire « À votre avis, où va l’argent public ? », où les chiffres du plan sont marqués « Annoncé » ; une seule identité visuelle. |
| 24 octobre 2026 | moteur 1.1.0 | Complément de libre choix du mode de garde (CMG) et crédit d'impôt garde d'enfants ; pension alimentaire et allocation de soutien familial ; phrase de synthèse en clair ; raison de chaque aide à 0 € ; heure de travail cohérente avec le revenu du foyer ; seconde lecture de H1 ; dirigeants assimilés salariés et travailleurs non salariés ; arrondi d'affichage à 5 € qui préserve les totaux. |
| 24 octobre 2026 | site | Niveaux de certitude renommés (« Proposé dans un amendement », « Annoncé », « Notre estimation ») ; page Méthode complète ; glossaire des sigles ; page « Ce que le plan prévoit pour… ». |
| 24 octobre 2026 | moteur 1.0.1 | Audit indépendant du moteur, quatre corrections : AEEH et carte mobilité inclusion (défaut), demi-part de la carte, CSG déductible en 2027, tranche de CSG des pensions en 2028. |
| 24 octobre 2026 | moteur 1.0.0 | Première version publiée : situation 2026 vérifiée sur 40 ménages types OpenFisca, plan reproduit sur les cas publiés. |
