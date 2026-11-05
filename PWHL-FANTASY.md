# Fantasy PWHL BHL — état du développement

La page `bhl-pwhl-apercu.html` reste absente du menu public. Des liens vers elle et le Mondial junior sont présents dans le portail Admin; leur absence du menu ne constitue pas un contrôle d'accès.

## Fonctionnel
- Banque historique : 282 matchs, 11 258 performances et 257 joueuses, saisons régulières 2024 à 2025-26.
- Fiches accessibles par les noms du tableau : identifiant HockeyTech, portrait fourni par les effectifs officiels, position, naissance, taille, origine et statistiques historiques.
- Les équipes des biographies sont étiquetées avec la saison de leur effectif. Les poids à zéro ne sont pas affichés.
- Essai d'alignement par semaine lundi–dimanche : partantes, banc, calcul en centièmes entiers, sauvegarde locale par saison/semaine. Aucun résultat de compétition n'est écrit.
- Générateur contrôlant tous les identifiants de matchs attendus, les doublons et le recalcul de chaque performance. Cela valide la cohérence interne, pas une réconciliation indépendante avec les totaux publiés.

## Reproduction
Depuis la racine du dépôt principal :

```bash
python3 scripts/pwhl-build-fantasy-bank.py --source /chemin/vers/research/pwhl
python3 scripts/pwhl-player-profiles.py
node --test tests/pwhl-engine.test.mjs
```

Le premier chemin doit pointer vers les données importées de la branche `research/pwhl-fantasy-data`.

## Prochaines étapes avant une compétition réelle
1. Réconcilier les statistiques match par match avec les totaux officiels, y compris les matchs joués et gardiennes.
2. Décider du barème, des postes, du nombre de partantes et réservistes et des règles de verrouillage; vérifier la profondeur pour 16 villes.
3. Enregistrer effectifs et alignements sur le serveur, reliés aux comptes DG existants, avec validations d'appartenance, unicité et dates de verrouillage côté serveur.
4. Calculer les confrontations et classements depuis des alignements historiques immuables; conserver les corrections et recalculs.
5. Ajouter repêchage, agents libres, échanges et automatisation des données avant l'ouverture de la compétition.

Les identités, logos et attributions DG sont reportés. Les takeaways ne sont pas disponibles dans cette banque. La saison 2026-27 n'est pas présentée comme importée.

## Temps de jeu
TOI/GP ajouté aux tableaux et fiches : total publié lorsqu’il est cohérent, moyenne publiée par saison ou présences complètes si le total officiel est absent (notamment 2024). Carrière pondérée par les matchs joués, jamais une moyenne simple des saisons. PPTOI/PKTOI préparés mais non renseignés : aucun champ direct publié et aucune saison complète fiable dans la reconstruction des unités spéciales. Les intervalles incohérents ne sont pas assimilés à zéro. Banque de présences : 280 matchs exploitables / 282, deux matchs aux horloges incohérentes; contrôle des couvertures par joueuse. Aucune modification des FPTS.
