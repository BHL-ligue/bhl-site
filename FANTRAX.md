# Synchronisation BHL / Fantrax

La page bhl-fantrax.html lit exclusivement data/fantrax.json. Aucun appel Fantrax ni secret n'est envoyé au navigateur.

Le workflow « Synchronisation Fantrax et publication » récupère les données toutes les 15 minutes (minutes 00, 15, 30 et 45 de chaque heure UTC), ainsi que sur lancement manuel depuis Actions > Run workflow. Les horaires GitHub peuvent être retardés. Il conserve un instantané dans Git et publie GitHub Pages.

Le script fixe User-Agent: BHL-Sync/1.0 et utilise les appels officiels getLeagueInfo, getPlayerIds, getTeamRosters, getStandings et getMatchupScores pour la ligue 32q8rjpomo2tig1z.

Les périodes d'effectif et de pointage sont choisies indépendamment d'après leurs dates Fantrax, avec fuseau horaire. Aucun recours implicite à la période suivante. Hors calendrier connu, la synchronisation échoue et conserve le fichier précédent.

Une réponse incomplète ou une erreur réseau interrompt la mise à jour. Le fichier est remplacé seulement après récupération et validation de l'ensemble. Après 12 heures, la page signale les données anciennes. Les données publiées sont limitées aux joueurs, organisations, classements et scores; les renseignements des responsables sont exclus.

Cette intégration ne modifie ni FORBES, ni les historiques Google Sheets, ni les profils ou autorisations DG Supabase. Elle ne fournit pas les statistiques individuelles ou les points par joueur.

Vérification locale : python scripts/test-fantrax.py
Actualisation locale : python scripts/sync-fantrax.py
