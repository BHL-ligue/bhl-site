# Historique d’appartenance BHL

L’onglet « Appartenance BHL » des fiches de joueurs utilise les effectifs publics Fantrax par période, depuis 2018-19. Les anciennes appellations et logos restent propres à chaque saison. L’identifiant Fantrax est la clé; une recherche par nom n’est acceptée que si elle correspond à une identité unique.

Les archives initiales comprennent 199 périodes dans neuf saisons, dont les six premières périodes de 2026-27. Chaque période récupérée a été comparée aux intervalles compressés: le résultat restitue exactement la réponse source. Les 1 228 identifiants ont des effectifs; 1 210 noms sont confirmés par le répertoire public Fantrax ou l’onglet DRAFTS de la ligue. Les 18 autres identifiants restent explicitement marqués `unresolved`, avec un nom nul, sans rapprochement deviné.

Les archives conservent aussi `lineups`: les statuts et postes par période, sans attribuer de points. Les deux représentations des barèmes retournées par Fantrax (`scoringCategories` et `scoringCategorySettings`) sont conservées telles quelles dans `scoring`; certaines valeurs ne concordent pas entre ces représentations. Un calcul historique de production doit être contrôlé contre les points Fantrax réellement comptés avant de choisir une interprétation. Les mises au jeu sont notamment pondérées selon le poste utilisé.

Les dates viennent de `getLeagueInfo.rosterPeriods`; les effectifs viennent de `getTeamRosters?period=N`. Ils indiquent la présence d’un joueur dans un effectif pour une période, sans fournir la date exacte ou le type de ses mouvements. Une absence ne prouve pas une signature, une libération, ou même que le joueur figurait déjà dans le bassin Fantrax. Les périodes manquantes ne sont jamais prolongées artificiellement.

Les noms sont complétés par `getPlayerIds?sport=NHL` et les résultats historiques DRAFTS du Google Sheets déjà utilisé sur le site. Aucun renseignement de responsable, de compte ou de session n’est publié. Les réponses brutes restent dans un cache temporaire hors du dépôt; seuls les effectifs, périodes, équipes et identités nécessaires sont conservés.

- `python scripts/archive-fantrax-ownership.py`: réimporter toutes les saisons configurées.
- `python scripts/archive-fantrax-ownership.py --current`: actualiser la saison en cours, en conservant les autres archives. Une actualisation incomplète échoue avant de remplacer les données précédentes.
- `python tests/test-ownership-data.py`: vérifier périodes, intervalles et identités.
- `node tests/test-ownership-core.mjs`: vérifier identités, trous, regroupements et un historique confirmé.
- `node tests/test-ownership-view.mjs`: vérifier la génération de la vue et ses filtres avec un DOM simulé.

Le workflow `ownership-history.yml` actualise la saison courante quotidiennement. Lors d’une nouvelle saison, ajouter son identifiant de ligue au registre `LEAGUES` du script. Le jeu de données de la saison courante peut évoluer jusqu’à la fin de chaque période.
