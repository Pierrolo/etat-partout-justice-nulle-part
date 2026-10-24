# Retour de Hugo (24 ans, commercial, Bordeaux) — mobile 390x844

Dossier : /tmp/claude-0/-home-user-etat-partout-justice-nulle-part/baab7dd5-e189-57f4-831a-57c57e1912f4/scratchpad/users/hugo/

## Ce que je cherchais
J'ai fini le livre, je suis convaincu. Je voulais un truc concret à montrer à mes potes et à ma famille : "regarde, voilà ce que ça change pour toi, en euros". Et surtout pouvoir envoyer le résultat par lien.

## Ce que j'ai fait
1. Accueil (01_home.png), puis simulateur en 4 étapes : seul, 24 ans, salarié privé, 2 400 € net, loyer 680 €, zone 2 (Bordeaux). Résultat : **+355 €/mois (+17 %)**, de 2 070 à 2 425 € (07_result.png). Moins de 1 minute, c'est tenu.
2. Ma mère : 48 ans (âge que j'ai dû inventer), 1 650 € net, parent isolé, sœur de 15 ans, loyer 560 € zone 3, "fonctionnaire" (j'ai choisi, je ne savais pas si l'hôpital comptait comme ça). Résultat : **-75 €/mois (-3,6 %)** (13_m_result.png). Détail : AFU +825, mais impôt -380, prime d'activité -295, APL -120, allocation de soutien familial -200, rentrée scolaire -40, TVA -75.
3. "Copier le lien" : ça marche, le bouton passe à "Lien copié" (14_m_copied.png). J'ai ouvert le lien dans un contexte vierge : le résultat -75 € s'affiche à l'identique (20_mom_open.png). Très bien.
4. J'ai parcouru Comprendre, Méthode, À propos, Qui gagne qui perd (32_types.png).

## Ce qui m'a plu
- Rapide, clair, gros chiffre en couleur, flèche, "soit 12 € par jour". Super partageable.
- Le simulateur montre aussi les perdants : ça lui donne de la crédibilité. Ma mère perd, et ça s'affiche sans maquillage. Honnêtement ça m'a fait réfléchir.
- Ligne par ligne avec la source (amendement, OpenFisca) quand on déplie. Pas de pub, pas de cookies.
- Le lien partagé fonctionne sans compte.

## Ce qui m'a fait douter / déçu (par ordre d'importance)

1. **Page Méthode inachevée (30_methode.png et suivantes).** On y voit des "TODO(builder)" : "Liste des mécanismes modélisés — À écrire", "Tableau H1…Hn", "Liste des sources", "Table des écarts". C'est exactement la page vers laquelle le site renvoie ("9 hypothèses actives", "voir la méthode") pour justifier les chiffres. Si ma famille ou un sceptique clique, la crédibilité s'effondre. À corriger avant de diffuser, ou masquer la page.

2. **Le résultat négatif de ma mère est brutal et ses hypothèses cachées.** Dans le lien partagé, on ne voit PAS les réponses saisies (âge, parent isolé, loyer, etc.) : juste "-75 € par mois". Ma mère ne saura pas sur quelles hypothèses ça repose, ni que "Allocation de soutien familial -200 €" vient d'une hypothèse "parent isolé sans pension alimentaire" que personne ne lui a demandée (visible seulement en dépliant la ligne, 21_mom_asf.png). Elle est divorcée : touche-t-elle une pension ? Il n'y a pas de question. Il faut une question sur la pension alimentaire, et un récapitulatif "Vos réponses" visible sur la page de résultat et dans le lien partagé.

3. **Incohérence "Annoncé" vs "dans le total".** L'accueil dit que ce qui est "annoncé" par les auteurs est montré à part, hors revenu disponible. Mais pour ma mère, la "Prime d'activité -295 € (Annoncé)" est bien comptée dans le -75 € (15_m_scroll1.png). Et le bandeau source du graphique dit juste "Loi". Je ne sais pas si je dois croire le total. À clarifier : soit la prime est comptée et il faut le dire, soit elle est exclue.

4. **Chiffres qui ne collent pas entre pages.** Le menu et le titre de la page niches disent "465 niches fiscales" (33_niches.png) ; la page Comprendre dit "486 niches fiscales, 134,7 Md€" alors que la page niches dit "89,4 Md€" pour le coût. Pour quelqu'un qui veut convaincre, c'est la première chose qu'on lui renverra. Il y a une note sur les dénominateurs "par foyer", mais pas là-dessus.

5. **Mon résultat est bon mais difficile à défendre face à un sceptique.** "+355 €/mois" mais, dans "Votre heure de travail", je garde 12,72 € au lieu de 13,64 € (-0,92 €/h) : mon salaire net monte de 290 € mais mon impôt monte de 430 €, et tout le gain vient de l'AFU de 550 €. Ce n'est pas expliqué simplement en haut ("tu gagnes grâce à l'allocation universelle, pas grâce à ton salaire"). Un ami me dira "donc je paie plus d'impôts". Une phrase de synthèse en haut du résultat aiderait. Aussi : les promesses non chiffrées (compte épargne 300 €, patrimoine 20 000 €, loyers en baisse) sont au même niveau que les pertes non chiffrées (chômage 6 mois, reste à charge 10 %, fin des exonérations Livret A) : bien, mais très long et enfoui tout en bas.

6. **Aperçu en direct trompeur pendant la saisie.** Dès que j'ajoute un enfant sans âge (10_m_child.png), la barre du bas affiche immédiatement "-120 €/mois" alors que rien n'est renseigné. Ça fait peur et ça n'a pas de sens. Idem au tout début : "+115 €/mois" avant même d'avoir saisi un salaire (02_sim.png) : ce sont des valeurs par défaut cachées (salaire, loyer 600 € pré-rempli, zone 2). Il vaudrait mieux n'afficher le chiffre qu'une fois les champs remplis, ou le griser.

7. **Le simulateur n'a pas de bouton "Partager".** Seulement "Copier le lien". Sur téléphone je voudrais le partage natif (WhatsApp, SMS), et idéalement une image/carte de résultat, avec un texte neutre du type "Pour Hugo : +355 €/mois". Un lien long avec un hash illisible est moins engageant.

8. **Petites choses.**
   - Statut "Fonctionnaire / Privé / Cadre" : une aide-soignante ne sait pas forcément quoi répondre, une phrase d'aide serait bienvenue (hôpital public = fonctionnaire).
   - Les deux étapes "Vous" demandent net ou brut : bien. Mais pas de rappel "24 ans = pas de RSA" visible dans le résultat.
   - Beaucoup de jargon : AFU, ASF, CRDS, OpenFisca, BMAF, "liasse PLF". Les abréviations devraient être définies au survol.
   - Page résultat très longue (32 000 px de haut sur téléphone). Un sommaire ou des sections repliables aideraient.

## Ce que je voudrais qu'on améliore, en résumé
1. Finir ou retirer la page Méthode (TODO visibles).
2. Ajouter récap des réponses + question pension alimentaire ; montrer les hypothèses de façon visible dans le lien partagé.
3. Clarifier si "Annoncé" est dans le total ou pas, et corriger l'étiquette "Loi".
4. Aligner les chiffres entre pages (465 vs 486, 89,4 vs 134,7 Md€).
5. Phrase de synthèse en haut du résultat ("d'où vient ton gain/ta perte").
6. Ne pas afficher de chiffre avant que les champs soient remplis.
7. Bouton de partage natif / image de résultat.
8. Glossaire pour les sigles.

Verdict d'Hugo : je vais l'envoyer à mes amis, ça marche et c'est honnête. Pour ma mère je suis embêté : le "-75 €" me prouve que le site ne triche pas, mais je ne peux pas le lui montrer sans lui expliquer les hypothèses, et ça manque.
