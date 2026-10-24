# Retour de Samir (boulanger, Toulouse), mobile puis ordinateur

Je suis passé sur mon téléphone (390x844) entre deux fournées, puis le soir sur l'ordinateur (1280x800). Mon profil : couple marié, enfant de 5 ans, moi 3 000 € net (je l'ai saisi « cadre »), ma femme 2 100 € net (fonctionnaire), loyer 1 050 €, zone 2.

## Ce que je cherchais
1. Ce que ça change pour moi et ma famille, en euros par mois.
2. Ce que ça change pour ma boulangerie et mes 12 salariés (charges patronales, coût d'un salarié, ce qu'ils touchent).

## Ce que j'ai trouvé
**Pour mon foyer, c'est bien.** Le simulateur marche, six questions environ. Résultat : **+945 €/mois (4 440 → 5 385 €)**, soit +21 %. Sur ordinateur j'ai eu +940 € pour le même profil. Ce n'est qu'un arrondi, mais ça surprend. Le détail ligne par ligne est lisible : salaire net +610, impôt −930, AFU +1 375, TVA −130, énergie +20. Les étiquettes « écrit dans la loi / annoncé / hypothèse » m'ont plu, c'est honnête. Le site dit aussi qu'il montre les perdants, et la page « cas types » le prouve : 10 foyers sur 47 perdent, surtout les parents isolés et les handicapés.

**Pour mon entreprise et mes salariés, je n'ai presque rien trouvé.**
- Il n'y a aucune entrée « chef d'entreprise » ou « employeur ».
- Le bloc « Votre heure de travail » dit seulement que mes cotisations patronales sont « inchangées » (10,89 €/h) et que le coût employeur reste à 35,37 €. Il ne dit pas si le plan baisse ou monte le coût de mes salariés, ni si leur net augmente.
- Pour un salarié seul à 1 900 € net, j'ai tapé le chiffre moi-même : +230 €/mois. J'ai dû faire ce test à la main, et rien ne me le propose.
- Dans « ce que le simulateur ne compte pas », je lis « indépendants et micro-entrepreneurs (pas encore) ». Moi, gérant, je ne sais pas dans quelle case je tombe (assimilé salarié ? TNS ?). J'ai choisi « cadre » au hasard. Personne ne m'a dit si c'était juste.

## Ce qui m'a fait douter ou agacé (par ordre d'importance)
1. **La page Méthode est un chantier.** Elle affiche « TODO(builder) » dans six sections : modèle, limites, registre des hypothèses, sources, écarts avec les simulateurs officiels, changelog. C'est la page qui doit me rassurer, et la plupart des liens « voir la méthode » mènent là. Je l'ai transmise à mon comptable : il a rigolé. Capture : `d_met.png`.
2. **Le message « heure de travail » est contradictoire.** Avec le plan, je « garde 16,02 € de l'heure au lieu de 17,22 € » (−1,20 €/h). Pourtant mon foyer gagne 945 € par mois. Ça vient de l'AFU de 1 375 €/mois, une aide universelle versée même à un foyer qui touche 5 100 € net. Je ne l'ai comprise qu'en lisant la petite phrase sous le chiffre. Le titre devrait expliquer pourquoi je gagne alors que mon heure rapporte moins. Je me suis demandé si je lisais bien. Capture : `r3.png`.
3. **L'AFU me laisse perplexe.** +1 375 €/mois pour mon ménage, c'est la plus grosse ligne. Le simulateur ne me dit pas, à cet endroit, d'où vient l'argent ni comment l'AFU se calcule. Il faut ouvrir la ligne. Je voudrais une phrase d'une ligne juste sous le résultat. Captures : `r2.png`, `y2.png`.
4. **Le chiffre d'accueil du simulateur n'est pas le mien.** Dès l'arrivée, la barre du bas affiche « +115 €/mois » avant que j'aie rien répondu. C'est le profil par défaut (un SMIC, seul), et ça ressemble à un résultat. Il faut le griser ou écrire « exemple » tant que je n'ai pas validé. Le chiffre se met à jour au fil de mes réponses (+630, +935…), ce qui est bien, mais il ne faut pas le prendre pour le mien. Capture : `m2.png`.
5. **Les hypothèses passent trop vite.** Je n'avais pas choisi « Cadre » en connaissance de cause. Le texte sous « Statut » parle de cotisations sans dire quoi choisir si on dirige sa boîte. Je n'ai aucune idée de l'impact : « 10 hypothèses actives » est un lien technique (H1, H2, H5), pas parlant pour moi.
6. **Détails de forme.**
   - Sur téléphone, le parcours est un assistant en 5 étapes. La barre dit « Étape 1 sur 4 » pour une personne seule, puis « sur 5 » dès que je coche « en couple ». Ça saute.
   - Le texte lu à l'écran contient une virgule orpheline (« Étape 1 sur 5 · , Foyer »).
   - L'âge par défaut (35 ans) est le mien par hasard, mais le champ salaire est pré-rempli à 1 478 €. Il faut tout effacer.
   - La page Comprendre annonce « 486 niches fiscales » alors que le menu dit « Les 465 niches fiscales ».
   - Le résultat est une très longue page (environ 34 000 px de haut sur mobile) : hypothèses, limites, partage. Je n'ai pas tout lu.
   - Le bandeau « Outil indépendant, non affilié » occupe de la place en haut du téléphone. C'est utile, mais il pousse le titre vers le bas.

## Ce qui m'a plu
- Le résultat est dit tout de suite en gros, en euros par mois : **+945 € par mois, 31 € par jour**.
- Le détail par ligne avec des couleurs claires, et la barre « Aujourd'hui / Avec le plan ».
- Le ton honnête : « les gagnants comme les perdants », hypothèses affichées, « ce que le simulateur ne compte pas ».
- Pas de cookie, pas de compte : tout se calcule dans le navigateur. Je suis méfiant avec mes données.
- Sur ordinateur, tout le formulaire est sur une page avec le résultat qui se met à jour à droite. C'est plus rapide que sur téléphone.
- Le lien « Copier le lien » pour montrer le résultat à ma femme.

## Ce que je voudrais qu'on améliore (par ordre)
1. Terminer la page Méthode (supprimer tous les TODO) avant de la montrer à qui que ce soit.
2. Ajouter un vrai volet « Mon entreprise / mes salariés » : statut du dirigeant (assimilé salarié ou TNS), coût employeur et net du salarié avant/après, pour un boulanger à 1 900 € net par exemple.
3. Dire clairement dans l'interface qui est couvert : si les gérants et indépendants ne sont pas encore pris en compte, le dire dès la question « Vous êtes… », avec une option dédiée ou un avertissement.
4. Éclaircir le bloc « Votre heure de travail » : expliquer en une phrase pourquoi l'heure rapporte moins (−1,20 €) alors que le foyer gagne beaucoup plus à cause de l'AFU.
5. Griser ou étiqueter « exemple » le chiffre affiché avant que j'aie répondu.
6. Corriger les petites incohérences (4 ou 5 étapes, 486 / 465 niches, arrondi 940 / 945 entre mobile et ordinateur, virgule orpheline, champs pré-remplis).

## Captures
Dossier : /tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/users/samir/
- `m1.png` : accueil sur mobile
- `m2.png`, `s1b.png` : simulateur au départ (profil par défaut)
- `u3b.png` : étape conjoint
- `u5b.png` : étape aides
- `r1.png`, `r2.png`, `r3.png` : résultat sur mobile (+945 €, détail, heure de travail)
- `x1.png`, `y1.png`, `y2.png` : simulateur et résultat sur ordinateur
- `d_foy.png` : « Qui gagne, qui perd ? »
- `d_met.png` : page Méthode avec les TODO
