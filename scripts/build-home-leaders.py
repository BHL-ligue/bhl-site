"""Build compact homepage leaders and the site-wide player profile index."""
import collections
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
production = json.loads((ROOT / 'data/production/scorers.json').read_text())
identity_data = json.loads((ROOT / 'data/player-identity-map.json').read_text())
identity = identity_data.get('players', {})

seasons = production.get('seasons', [])
if not seasons:
    raise SystemExit('No scorer seasons available')
season = max(seasons)
rows = [row for row in production.get('rows', [])
        if row.get('season') == season and row.get('phase') == 'regular'
        and row.get('id') and row.get('name')]

totals = {}
for row in rows:
    key = (row['id'], row['positionGroup'])
    item = totals.setdefault(key, {
        'id': row['id'], 'name': row['name'],
        'positionGroup': row['positionGroup'], 'fpts': 0, 'gp': 0,
    })
    item['fpts'] += row.get('fpts') or 0
    item['gp'] += row.get('gp') or 0

leaders = {}
for position in ('forward', 'defense', 'goalie'):
    selected = [item for item in totals.values() if item['positionGroup'] == position]
    selected.sort(key=lambda item: (-item['fpts'], item['name'].casefold(), item['id']))
    leaders[position] = [
        {**item, 'fpts': round(item['fpts'], 2),
         'nhlId': (identity.get(item['id']) or {}).get('nhlId'),
         'nhlTeam': (identity.get(item['id']) or {}).get('nhlTeam')}
        for item in selected[:10]
    ]

(ROOT / 'data/home-top-scorers.json').write_text(json.dumps({
    'season': season,
    'phase': 'regular',
    'updatedAt': production.get('updatedAt'),
    'metric': 'FPTS produites pendant les présences dans un alignement BHL',
    'leaders': leaders,
}, ensure_ascii=False, separators=(',', ':')) + '\n')

# Collect canonical and confirmed identity aliases, then discard any name that
# could refer to more than one Fantrax player ID.
names = collections.defaultdict(set)
canonical = {}
for row in production.get('rows', []):
    if row.get('id') and row.get('name'):
        names[row['name'].strip()].add(str(row['id']))
        canonical[str(row['id'])] = row['name'].strip()
for player_id, item in identity.items():
    player_id = str(player_id)
    for name in [item.get('fantraxName'), item.get('nhlName'), *(item.get('aliases') or [])]:
        if isinstance(name, str) and name.strip():
            names[name.strip()].add(player_id)
            canonical.setdefault(player_id, item.get('fantraxName') or name.strip())

profile_names = []
for name, ids in names.items():
    if len(ids) == 1:
        profile_names.append({'name': name, 'id': next(iter(ids)),
                              'canonicalName': canonical.get(next(iter(ids)), name)})
profile_names.sort(key=lambda item: (item['name'].casefold(), item['id']))
(ROOT / 'data/player-profile-index.json').write_text(json.dumps({
    'schemaVersion': 1,
    'players': profile_names,
}, ensure_ascii=False, separators=(',', ':')) + '\n')

print(f'Built {sum(map(len, leaders.values()))} homepage leaders for {season} '
      f'and {len(profile_names)} unique player-name links')
