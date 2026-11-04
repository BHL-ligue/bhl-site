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

## Contrôle de production 2025-26

Le contrôle en lecture seule couvre les 24 périodes de 2025-26. Sur 350 scores d’équipe en compétition, 337 concordent exactement, y compris les points par catégorie. Les 13 autres écarts sont conservés dans `data/ownership/production-audit-2025-26.json`, avec leur période, équipe et catégorie. Aucune correction arbitraire n’est appliquée. Les variantes Samuel/Sam Montembeault, Ben/Benjamin Kindel, Michael/Mikey Eyssimont, Dan/Daniel Vladar et Bo/Benoit-Olivier Groulx sont rapprochées uniquement lorsqu’une identité unique existe dans les rapports officiels LNH de la saison.

La saison régulière comprend les périodes 1 à 21 (323 scores concordants sur 336). Les séries comptent 8, puis 4, puis 2 équipes en compétition (14 scores concordants sur 14). Les effectifs encore marqués ACTIVE chez les équipes éliminées ne sont pas comptés. Les dates limites sont confrontées aux heures de début des matchs LNH; une journée coupée par une limite incompatible est bloquée plutôt qu’arrondie.

Cette concordance agrégée ne certifie pas à elle seule chaque contribution individuelle et ne constitue pas un classement officiel des pointeurs. Le détail individuel original Fantrax, non accessible publiquement, reste nécessaire pour attribuer les petits écarts aux joueurs concernés. Le rapport complet du calcul est conservé sept jours comme artifact du workflow de contrôle; le résumé et les écarts sont conservés dans le dépôt.
