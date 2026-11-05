# Recherche PWHL — BHL (non publiée)

**Branche de recherche uniquement** : `research/pwhl-fantasy-data`. Aucun lien ajouté au menu, aucune modification à la production.

## But
Évaluer la récupération des statistiques PWHL depuis le fournisseur utilisé par le site officiel, HockeyTech/LeagueStat, avant de créer les équipes ou le pointage fantasy.

## Premier test
```bash
python scripts/pwhl-api-probe.py --output pwhl-api-probe-report.json
```

Le script vérifie : saisons, calendrier, résumé d'un match, événements de jeu et présences sur glace. Les IDs de saison et de match par défaut sont des exemples documentés, **pas des IDs validés pour la saison actuelle**. Vérifier la réponse de `seasons`, puis celle de `schedule` avant de comparer des chiffres.

## Critères avant de construire le moteur fantasy
1. API joignable de façon répétée, JSON/JSONP correctement décodé.
2. Identifiants stables des joueuses, des équipes, des saisons et des matchs.
3. Buts, passes, tirs, statistiques gardiennes et matchs joués vérifiés contre les totaux officiels.
4. Historique par match permettant de recalculer le classement après une correction.
5. Distinguer clairement les champs absents des valeurs zéro.
6. Vérifier les conditions d'utilisation, les limites et les droits d'affichage des photos et des logos.

**État :** API et endpoints identifiés par documentation publique. Aucun résultat live n'a encore été confirmé dans cet environnement; ne pas annoncer de synchronisation fonctionnelle.

Références :
- https://fastrhockey.sportsdataverse.org/reference
- https://rdrr.io/cran/fastRhockey/src/R/pwhl_helpers.R
- https://github.com/masonlanger/pwhl_api/blob/main/docs/pwhl_api/endpoints/leagueschedule.md
