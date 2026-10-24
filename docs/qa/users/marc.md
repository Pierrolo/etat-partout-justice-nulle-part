# Retour de Marc (UL, Saint-Étienne) sur « Et moi, dans tout ça ? »

Dossier des captures : /tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/users/marc/

## Ce que je cherchais
Je voulais voir si l'outil vend le programme avec des chiffres flatteurs ou s'il dit la vérité sur ceux que je défends : handicapés, parents isolés, gens au RSA, chômeurs, étudiants, retraités modestes. J'ai testé ces cas dans le simulateur, puis lu les pages « Qui gagne, qui perd ? », Méthode et À propos.

## Ce que j'ai trouvé

**1. Les perdants sont montrés. Je dois le reconnaître.** Voici ce que j'ai obtenu (plan complet, hypothèses par défaut) :
- Adulte handicapé à 50-79 %, sans revenu, locataire 450 € : 1 195 € passe à 380 €, soit **−815 € par mois (−68 %)**. Capture : `s_aah50.png`.
- Adulte handicapé à 80 % ou plus, même situation : **−265 € par mois (−22 %)**.
- Personne seule au RSA, loyer 400 € : **−335 € (−43 %)**. Le RSA est supprimé (−575 €) et l'APL aussi (−290 €).
- Parent isolé avec 1 enfant, salaire 1 400 € net : **−120 €**. L'allocation de soutien familial et l'APL disparaissent.
- Sur la page « Qui gagne, qui perd ? » : 10 foyers types perdent sur 47. Ce sont presque tous des gens modestes : parents isolés (jusqu'à −695 € et −52 %), handicapés, RSA, mi-temps au SMIC. Capture : `p_types.png`.
- À l'inverse, le « couple non marié 5 SMIC + sans revenu, propriétaire » gagne **+1 645 €** (+30 %). Les plus riches gagnent le plus en euros, et le site le montre.

Chaque ligne se déplie avec son calcul et le lien vers l'amendement (par exemple « ASF abrogée au 1er janvier 2028 »). C'est précis, je n'ai pas trouvé de chiffre sorti de nulle part. Le bandeau « annoncé / écrit dans la loi / hypothèse » est un vrai effort de transparence.

**2. Ce qui est loyal.**
- La page d'accueil dit « le simulateur dirait aussi clairement si le plan vous coûtait de l'argent », et il le fait (flèche rouge, −68 % en gros).
- Il y a un avertissement sur les cas types : « pas un échantillon représentatif, on ne peut pas en déduire la part des ménages qui gagnent ou perdent ».
- Les hypothèses sont modifiables. J'ai basculé H1 (RSA, AAH, prime d'activité « maintenus en différentiel ») pour l'AAH 50-79 % : on passe de −815 € à environ −435 € (1 195 € à 760 €, −37 %). Le perdant reste perdant. L'outil ne triche donc pas en faveur de son hypothèse par défaut. Capture : `s_aah50_diff2.png`.
- Les contradictions du livre (236 Md€ comptés de trois façons, quatre totaux de niches) sont affichées côte à côte.

**3. Ce qui est orienté, ou ce qui me gêne.**
- **Le chiffre en gros est un gain pour la plupart des profils.** Un salarié seul au SMIC voit « +115 € par mois ». Or ce chiffre exclut des pertes que le site reconnaît lui-même :
  - chômage limité à 6 mois au lieu de 13-18 ;
  - reste à charge de 10 % sur chaque acte de soin, fin de l'ALD ;
  - fin de la revalorisation automatique des pensions et prestations ;
  - fin des exonérations sur Livret A, assurance-vie, etc. ;
  - fin de l'indexation de l'AFU (6 600 € figés).
  Ces pertes sont dans un encadré plus bas (« Pertes non chiffrées », 6 éléments). Les « promesses non chiffrées » (8 éléments) ne comptent pas non plus dans le total. L'asymétrie est correctement expliquée, mais le chiffre vedette reste trop optimiste. Pour un chômeur, le simulateur affiche **+220 €** alors que la mesure qui le touche le plus (6 mois) n'est pas dans le calcul. Pour un retraité, **+365 à +880 €** alors que l'indexation est gelée.
- **Le résultat dépend de la lecture « prise de position » de H1.** Elle est signalée « Annoncé par les auteurs », mais c'est le site qui choisit le défaut : RSA, AAH et prime d'activité remplacés. Pour l'AAH, l'écart entre −815 € et −435 € est énorme. Il faut le dire au moment du résultat, pas seulement dans les hypothèses tout en bas.
- **Le panier « gagnants / perdants » est choisi par le site.** « 37 gagnent sur 47 » sera cité par les partisans malgré l'avertissement. Le compteur en grand l'encourage.
- **Les montants sont arrondis à 5 € près.** Un « +115 € » sur le RSA ou l'AFU donne une impression de précision.
- **Cas à clarifier :** « Jeune de 22 ans sans revenu, hébergé » passe de 0 € à 560 €, affiché « +560 € » et « 0,0 % » dans la colonne pourcentage (division par zéro). Ce n'est pas faux, mais c'est confus.
- **Le revenu disponible suppose le plan appliqué à la situation de 2026**, sans effet sur les salaires, l'emploi ou les prix hors TVA. C'est écrit en bas de page (« ce que le simulateur ne compte pas »). Mais quand le plan prétend financer l'AFU par des suppressions d'agences et de services, personne ne chiffre ce que devient le service rendu. Le simulateur ne le prétend pas, et ne sait pas le faire. C'est mon vrai argument de fond : l'outil mesure le portefeuille, pas le service public perdu (hôpital, école, CAF).

## Ce qui est clair, ce qui est confus
- Clair : les six questions du simulateur, le détail ligne par ligne, la pastille de niveau de preuve, le CSV téléchargeable, l'absence de cookies.
- Confus : au début, l'accueil montre « 63 € de valeur ajoutée, dont 29 € à l'État » sans dire que c'est un calcul des auteurs « sans source externe ». C'est écrit, mais en petit, sous un graphique qui ressemble à un fait établi. Le « 465 niches » du menu contredit le « 486 » de la page Comprendre.
- Une page qui ne devrait pas être en ligne : **la page Méthode est quasiment vide.** « Ce qui est modélisé », « Ce qui ne l'est pas », « Registre des hypothèses », « Sources », « Écarts avec les simulateurs officiels » et « Journal des modifications » affichent chacun un `TODO(builder)`. Capture : `p_methode.png` (le sommaire est visible, et le texte de chaque section est un TODO). C'est ce qui sape le plus la promesse « on publie tout ». Le site dit « publie toutes ses hypothèses », et la page qui devrait le prouver est vide.

## Ce que je voudrais qu'on améliore, par ordre d'importance
1. **Remplir la page Méthode.** Plus de `TODO(builder)` visible. Sans elle, « tout est publié » est faux.
2. **Mettre les pertes non chiffrées à côté du chiffre vedette.** Par exemple sous « +115 € », une mention « hors 6 pertes que le texte ne chiffre pas : chômage limité à 6 mois, reste à charge santé… », avec un lien. Le profil « sans emploi » ou « patient » doit voir sa perte avant le gain.
3. **Dire, sous le résultat d'un foyer AAH/RSA/prime d'activité, que le chiffre dépend de H1.** Idéalement afficher les deux lectures (« remplacés » et « maintenus en différentiel ») côte à côte.
4. **Ne pas faire du « 37 gagnent sur 47 » un titre.** Sinon, mettre en regard le nombre de perdants parmi les plus modestes (revenu net sous 1 500 €).
5. **Cohérence des chiffres** : 465 contre 486 niches, et le « 0,0 % » sur le jeune hébergé.
6. **Être plus clair sur l'origine du « 63 € » de la page d'accueil**, qui vient d'un calcul des auteurs sans source externe.
7. **Un mot sur ce que devient le service public financé par ces suppressions.** Le site dit qu'il ne le calcule pas. Il pourrait le dire plus haut.

## Ma conclusion honnête
Je pensais trouver un outil de propagande. Ce n'est pas le cas : il montre noir sur blanc que les handicapés à 50-79 % perdent jusqu'à 815 € par mois, que les parents isolés et les gens au RSA y perdent aussi. C'est du matériel pour moi. En revanche, l'accueil et le chiffre vedette restent flatteurs pour le salarié moyen, et la page Méthode vide fait tache. J'ai de quoi argumenter, et je reconnais que l'outil, tel qu'il est, est plus loyal que ce que j'attendais.
