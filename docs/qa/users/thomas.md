# Retour de Thomas (38 ans, ingénieur, Nantes)

Dossier des captures : /tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/users/thomas/

## Ce que je cherchais
Savoir en euros, pour mon foyer, si le plan du livre me coûte ou me rapporte. Mon profil : couple marié, 4 800 € net + 2 300 € net, enfants de 7 et 3 ans (assistante maternelle), propriétaires avec crédit.

## Ce que j'ai trouvé
Résultat : **+1 095 €/mois (+18 %)**, de 6 170 € à 7 265 € (06a.png, 07a.png). Le détail : salaires nets +855 €, impôt −1 110 €, AFU +1 650 €, allocations familiales −155 €, TVA −170 €, CEE +25 €.
J'ai refait à la main le calcul de mon impôt actuel (79 434 € imposables, 3 parts, plafonnement du quotient familial) : 6 424 €/an, ça tombe juste. Là, j'ai cru l'outil. Chaque ligne se déplie avec la formule, les chiffres et la source (07b.png), et c'est ce que je cherchais.

## Ce qui est clair et qui m'a plu
- L'accueil va droit au but, et le bouton « Lancer le simulateur » est facile à trouver (01.png).
- Le détail ligne par ligne, avec les étiquettes « Écrit dans la loi / Annoncé / Hypothèse ».
- Les « pertes non chiffrées » sont affichées et les perdants figurent dans « Qui gagne, qui perd ? » (10 foyers sur 47 perdent). Ça rend le site crédible.
- L'URL contient mon profil, donc je peux la partager. Aucun cookie.

## Ce qui m'a fait douter ou agacé, par ordre d'importance
1. **La page Méthode est vide : elle affiche des « TODO(builder) »** pour la liste des mécanismes, les limites, le registre des hypothèses, les sources, les écarts avec les simulateurs officiels et le changelog (09_meth.png). Le site dit partout « voir la Méthode » et « publie toutes ses hypothèses ». Je clique, je tombe sur des notes de développeur. C'est le point qui ruine la confiance, d'autant que je suis du genre à vérifier.
2. **Le chiffre en gros ne tient pas compte de ce qui me concerne le plus : la garde d'enfant.** J'ai coché « Assistante maternelle » : le résultat n'a pas bougé (+1 095 €). Plus bas, le site dit que le CMG et la PAJE seraient abrogés en 2028 et qu'il ne les chiffre pas (« souvent plusieurs centaines d'euros par mois »). Pour une famille avec un enfant de 3 ans chez une assistante maternelle, le « +1 095 € » est donc surévalué, et ça ne se voit pas sur la carte résultat. Il faudrait un avertissement près du chiffre (« hors CMG : peut réduire ce gain de X »), ou au minimum un message quand on coche ce mode de garde. Même chose pour le crédit d'impôt de garde, la taxe foncière et mon crédit immobilier : je ne sais pas ce qui est pris en compte.
3. **Un résultat s'affiche dès l'arrivée sur le simulateur**, avec un profil par défaut (+115 €, personne seule à 1 478 €) sans que j'aie rien saisi (02.png). On ne comprend pas tout de suite que c'est un exemple. Je voudrais « Exemple, à remplacer par votre situation ».
4. **Le formulaire a des pièges** :
   - « Marié·e ou pacsé·e ? » est sur « Non » par défaut. Je l'ai vu par hasard, et ça change l'impôt d'aujourd'hui (05a.png).
   - Les champs d'âge et de salaire sont préremplis (35 ans, 1 478 €). Il faut tout écraser.
   - Le statut « Cadre » est sur « Privé, non-cadre » par défaut, pour moi comme pour Julie.
   - Rien ne me demande ma mensualité de crédit ni la valeur de mon bien, donc « propriétaire avec crédit » ne sert à rien dans le calcul. Dites-le.
5. **Les lignes de sources se répètent** : « loi n° 2026-103… art. 4 » apparaît deux fois de suite sous l'impôt (07b.png). Ça fait brouillon. Le résultat dit « +1 095 € » en gros mais « aux 5 € près » en petit : je préfère comprendre d'où vient l'arrondi.
6. **L'AFU me fait douter du modèle.** Un ménage à 7 100 € net touche 1 650 €/mois d'allocation « même si elle dépasse l'impôt ». C'est le texte, d'accord, et c'est bien expliqué (6 600 × 2 + 3 300 × 2), mais mon impôt passe de 535 € à 1 646 €/mois (23 % sans quotient familial) tandis que mon net grimpe de 855 € : l'effet net (+1 095 €) est bien une somme de gros mouvements. Un petit schéma « ce que je paie / ce que je reçois » en deux colonnes m'aiderait. L'heure de travail dit que je « garde » 0,56 €/h de moins, alors que le foyer gagne +1 095 € : les deux vues paraissent se contredire tant qu'on n'a pas lu la note sur l'AFU.
7. **Dénominateurs « par foyer » multiples** (30 M, 29,5 M, 31 M, 40,2 M) : c'est signalé, merci, mais on se perd. Sur l'accueil, la carte « 63 € de valeur ajoutée par heure » repose sur un « calcul des auteurs, sans source externe » : à mettre en retrait ou à expliquer davantage.
8. Pas testé : l'affichage sur mobile et le mode sombre.

## Ce que je voudrais qu'on améliore, en bref
1. Remplir la page Méthode (ou la retirer du menu tant qu'elle est vide).
2. Prendre en compte, ou signaler près du chiffre, le CMG et la garde d'enfants.
3. Marquer le résultat initial comme « exemple », et ne rien précocher (marié, statut).
4. Dire clairement ce que la case propriétaire avec crédit change (rien).
5. Nettoyer les sources en double et mieux relier la vue « heure de travail » à la vue « revenu du foyer ».

Captures utiles : 01.png (accueil), 02.png (résultat par défaut), 05a.png (formulaire), 07a.png (affiner le calcul), 07b.png (détail des lignes), 08b.png (qui gagne, qui perd), 09_meth.png (Méthode vide).
