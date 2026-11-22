# Retour d'Élise (service économie) sur « Et moi, dans tout ça ? » (localhost:4600)

## Ce que je cherchais
Savoir si je peux citer ce site dans mon papier sur « État partout, justice nulle part », en tirer des chiffres ou des exemples, et ce qu'il vaut.

## Verdict
- **Utilisable comme outil de lecture, avec réserves.**
- **Citable pour les chiffres publics** (Insee, Eurostat), qui sont sourcés et que j'ai recoupés.
- **Pas citable seul pour le simulateur.** La page Méthode est vide. Je ne peux pas dire à mes lecteurs « selon un simulateur indépendant » sans pouvoir décrire sa méthode.
- **Chiffres des auteurs : toujours attribuer** (« selon les auteurs »). Le site le fait bien, par un badge « Annoncé ».

## Ce qui m'a plu
- **Indépendance affichée dès le bandeau**, puis détaillée dans À propos : non affilié à Résolution ni à l'État, sans cookies ni traceurs, licences listées.
- **Trois niveaux de preuve** (Écrit dans la loi / Annoncé / Hypothèse) visibles partout. C'est ce qu'un journaliste attend.
- **Les contradictions du livre sont montrées au lieu d'être gommées.** Exemples :
  - « record mondial » du manifeste contre Eurostat (Finlande 57,7 %, France 57,0 %, 2e sur 30) ;
  - 236 Md€ compté de trois façons ;
  - 275 € contre 300 €/mois de gain pour la fin de la CSG ;
  - 89,4 / 101,3 / 134,7 / 143 Md€ pour les niches ;
  - 746 agences contre 337 entités dans l'amendement.
  Ce sont de bons angles de papier.
- **Les perdants sont montrés** sur la page « Qui gagne, qui perd ? » (captures `quigagne.png`, `home.png`).
  - 47 foyers types : 37 gagnent, 10 perdent.
  - Les plus touchés : parents isolés (−695 €/mois sans revenu avec 1 enfant, −460 € à 2 SMIC avec 3 enfants), adulte handicapé 50–79 % sans revenu (−835 €, −69 %), personne seule sans revenu (−350 €).
  - La page précise que ce n'est pas représentatif.
- **Recoupement Insee.** 1 672 Md€ et 57,0 % du PIB en 2024 sont confirmés par l'Insee Première de février 2026.
- **Le simulateur est fluide**, avec lien partageable. Il est lisible sur mobile (390 px, pas de défilement horizontal).

## Ce qui me bloque ou me fait douter (par ordre d'importance)

1. **La page Méthode est un squelette.**
   - Capture : `methode.png`.
   - Les sections « Ce qui est modélisé », « Ce qui ne l'est pas », « Registre des hypothèses », « Sources », « Écarts avec les simulateurs officiels » et « Journal des modifications » affichent chacune « TODO(builder) … À écrire ».
   - Tout le site renvoie à cette page : « Méthode, sources et registre complet des hypothèses → ».
   - Sans elle, impossible de vérifier un résultat ou de répondre au lecteur qui demande « comment c'est calculé ».
   - La section « Écarts avec les simulateurs officiels » est vide : rien ne montre que le moteur donne les mêmes résultats que simulateurs.dgfip, mesdroitssociaux ou la CAF. C'est le premier recoupement que je ferais.
   - C'est une impression de site inachevé, voire « en chantier », visible par tous.

2. **Les étiquettes de preuve sont parfois trompeuses.**
   - Le moteur du simulateur est étiqueté « Loi » dans les sources : « Source : Loi, Moteur de calcul du simulateur ». Un moteur n'est pas une loi. Les amendements ne sont ni déposés ni adoptés, comme le dit À propos, mais le badge « Loi » sur le site pourrait être lu comme « en vigueur ».
   - À mon avis, « Loi » devrait devenir « Amendement proposé » ou équivalent. Sinon un lecteur pressé croira que c'est voté.
   - La suppression de la prime d'activité est étiquetée « Annoncé » et pourtant comptée dans le revenu disponible (−230 €). Or le site dit que l'« annoncé » est « montré à part, hors revenu disponible ». C'est contradictoire.
   - L'hypothèse H1 (RSA et prime d'activité remplacés par l'AFU) pèse beaucoup. Elle est expliquée, mais le résultat par défaut la retient sans l'avertir dans le bandeau de résultat.

3. **Le résultat par défaut s'affiche sans rien saisir.**
   - Capture : `sim1_0.png`, « +115 €/mois (+7,3 %) » dès l'arrivée, pour un profil préchargé (35 ans, 1 478 € net, locataire 600 €).
   - Un lecteur qui ne touche à rien pourrait citer ce chiffre. Il faudrait le dire : « exemple : modifiez vos réponses ».

4. **Le gain en euros est plus élevé chez les hauts revenus**, avec un gain en % à peu près constant de 18 à 20 % dès 2 000 € net. Ce n'est pas faux, mais le site ne le dit pas dans une phrase claire et c'est ce que la rédaction me demandera.
   - Mes essais : seul·e à 1 000 € net : +55 € (+4,5 %) ; 2 190 € (salaire médian cité par le site) : +355 € (+19 %) ; 5 000 € : +725 € (+19 %) ; couple 3 000 € + 1 478 € : +770 € ; avec un enfant : +915 € (+23 %).
   - Aux petits revenus, l'effet est faible ou négatif.
   - Le revenu médian est cité à 2 190 € net, avec +275 €/mois et +12,6 % pour la seule fin de la CSG. Ce n'est pas la même chose que le +355 € du simulateur, sans que le lien soit expliqué.

5. **Contradictions internes mineures et libellés confus.**
   - Ministères (`etat.png`) : « 9 regroupés » dans la légende, mais « 16 regroupés en 7 » dans la lecture. Je comprends la logique (16 − 7 = 9) après relecture, mais ça fait tiquer au premier passage.
   - « 54 000 € par foyer » est badgé « Annoncé » alors que c'est simplement 1 672 Md€ ÷ 31 M. Le site en déduit lui-même le dénominateur.
   - Le « par foyer » change de dénominateur selon les pages (30 M, 29,5 M, 31 M, 40,2 M). C'est signalé, mais c'est un piège pour quiconque compare. Je ne citerai aucun « par foyer » sans le dénominateur.
   - L'explication de l'écart 57,0 / 57,3 % (`europe57.png`) dit que « les sources ne disent pas d'où vient l'écart ». Le site compare un PIB du classeur des auteurs à un total Insee. Je dirais plutôt que le PIB du classeur est approximatif.
   - Page « Qui gagne, qui perd ? » : le « jeune de 22 ans sans revenu » passe de 0 € à 560 € et affiche « 0,0 % » d'écart. C'est un artefact de division par zéro.
   - Dans la liste des cas, « Couple non marié » (+1 645 €) contre « marié » (+1 060 €) pour le même revenu. Intéressant, mais non expliqué.

6. **Je n'ai pas pu vérifier le plan lui-même.**
   - france-resolution.fr, récupéré par WebFetch, n'a donné que la page d'accueil (« Vous rendre 600 € par mois », auteurs Ingrid Barrat, Arthur Marle, Moïse Mitterrand).
   - Les amendements, fiches et classeurs sont liés par le site, mais je dois les ouvrir moi-même pour confirmer 6 600 €/an d'AFU, 23 % d'IR ou 236 Md€. Un lien direct vers chaque amendement avec le numéro serait précieux (il y en a, mais pas toujours le texte).
   - Les liens « Classeur des auteurs » pointent tous vers le même fichier xlsx : il faudrait indiquer l'onglet et la cellule dans le texte visible.

## Ce que je citerais
- **Les chiffres Insee et Eurostat** (1 672 Md€, 57,0 % du PIB, 49,4 % pour la zone euro, 2e rang sur 30), en citant l'Insee ou Eurostat directement.
- **Le constat des divergences** : record mondial contre Eurostat, 236 Md€ compté de trois façons, 89,4 contre 143 Md€ de niches. Je le décrirais comme « relevé par un site indépendant », puis je vérifierais moi-même dans le classeur.
- **Les exemples de perdants** (parents isolés, handicap 50–79 %), mais pas de proportion : le site dit lui-même que ce n'est pas un échantillon.

## Ce que je ne citerais pas
- Tout chiffre du simulateur sans Méthode publiée, et surtout sans recoupement avec un simulateur officiel.
- Les montants « annoncés » par les auteurs (300 €/mois d'épargne, 20 000 € de patrimoine rendu, loyers en baisse) comme des effets certains.

## Ce que je voudrais qu'on améliore (priorité décroissante)
1. Écrire la page Méthode : modèle, limites, registre des hypothèses, sources avec millésimes, comparaison avec les simulateurs officiels, journal des modifications. Retirer tout « TODO » visible.
2. Remplacer « Loi » par un libellé qui dit « amendement proposé, non adopté », et ne plus appeler « Loi » le moteur de calcul.
3. Corriger l'incohérence « Annoncé » compté dans le revenu disponible (prime d'activité), ou l'expliquer clairement.
4. Marquer le profil par défaut du simulateur comme un exemple, et résumer en une phrase « qui gagne, qui perd en euros comme en % ».
5. Harmoniser les libellés ministères (9 / 16 regroupés), l'affichage « 0,0 % » et l'explication 57,0 / 57,3 %.
6. Indiquer onglet et cellule en clair à côté de chaque lien « Classeur des auteurs ».

## Captures
`home.png`, `methode.png`, `sim1_0.png`, `sim1_1.png` (« Ce qui change, ligne par ligne »), `quigagne.png`, `europe57.png`, `depenses_view.png`, `mobile_sim.png`, `etat.png`, `niches.png`, `plan.png`, `case2190.png`, `casecouple.png`, dans `/tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/users/elise/`.
