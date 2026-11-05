# Probabilités, Tankathon et signatures multiples

## En ligne sans changement de base
- Saison : probabilités BHL sur 10 000 simulations déterministes du calendrier restant. Huit places, bilan Fantrax courant, scores de périodes complétées. Moyenne pondérée (70 % historique / 30 % trois dernières), régularisée avec trois périodes à la moyenne de ligue; variabilité des scores et incertitude sur la force. Même score pour les trois duels. Durée des périodes ajustée. Scores partiels ignorés.
- Départage de simulation : points, FPTS, rang officiel actuel. Hypothèse annoncée dans la légende; le classement officiel n'est pas modifié.
- Repêchage : Tankathon 2027, première ronde espoir. Huit derniers au classement, tirage des trois premiers sans remplacement avec renormalisation des chances 32/21/15/10/8,5/6,5/4,5/2,5. Ordre inversé actuel pour les autres. Propriété des choix depuis Fantrax. Simulation sans effet sur les choix officiels.
- Propositions : classement saisi par l'administrateur, avec bonus optionnel de profondeur par position parmi les cinq meilleurs disponibles. Aucun classement d'espoirs inventé.

## Activation de base en attente d'approbation
La validation automatique a refusé la migration de production faute d'autorisation explicite des changements de schéma et de droits. Ne pas contourner ce refus.

Le script `database/bhl-draft-board-multiauthors.sql` est préparé mais non appliqué :
- Nouvelle table de centrale 2027, lecture publique; écriture limitée aux comptes dont le rôle est administrateur, RLS activée. Révisions pour empêcher l'écrasement d'une édition concurrente.
- Deux colonnes d'attribution sur les articles; jusqu'à cinq journalistes distincts. Le serveur construit la signature et vérifie leurs attributions au compte soumetteur (administrateur : tous les journalistes). Les permissions de modification des articles et l'approbation existantes sont conservées.
- Élargissement de la signature et adaptation de la vue des auteurs pour les filtres.

L'éditeur Admin permet de préparer et exporter la centrale pendant cette attente; la sauvegarde partagée reste désactivée. Les articles conservent l'éditeur de signature simple tant que les colonnes n'existent pas. Aucun ancien article n'est réattribué automatiquement.

## Vérifications
`node --test tests/bhl-predictions.test.mjs` : cohérence des huit places, déterminisme, absence de prise en compte des scores futurs/partiels, fin de saison, loterie (30 000 essais), propriété des choix, unicité des espoirs, validation de classement.
Vérifications navigateur locales : loterie trois gagnants; affichage des probabilités; écran de centrale; sélection « Corey Pronman et Scott Wheeler » sur données factices. Les écritures réelles ne sont pas testées avant activation autorisée de la base.
