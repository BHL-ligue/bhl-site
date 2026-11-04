import importlib.util
from pathlib import Path
import unittest
p=Path(__file__).resolve().parents[1]/'scripts/audit-bhl-production.py'
spec=importlib.util.spec_from_file_location('audit',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class AuditTests(unittest.TestCase):
 def test_known_alias_and_no_guess(self):
  names={'03rfp':{'name':'Sam Montembeault','aliases':[]},'x':{'name':'Homonyme','aliases':[]}}
  rows={'goalie':[{'playerId':7,'goalieFullName':'Samuel Montembeault'}],'skater':[{'playerId':8,'skaterFullName':'Homonyme'},{'playerId':9,'skaterFullName':'Homonyme'}]}
  self.assertEqual(m.resolve_id('03rfp','G',names,{},rows)[0],'7');self.assertIsNone(m.resolve_id('x','C',names,{},rows)[0])
 def test_calendar_boundaries(self):
  period={'start':'2025-10-07T17:00:00-04:00','end':'2025-10-13T12:29:59-04:00'}
  schedules={'2025-10-07':{'gameWeek':[{'date':'2025-10-07','games':[{'gameType':2,'startTimeUTC':'2025-10-07T21:00:00Z'}]}]},'2025-10-13':{'gameWeek':[{'date':'2025-10-13','games':[{'gameType':2,'startTimeUTC':'2025-10-13T16:30:00Z'}]}]}}
  self.assertEqual(m.date_window(period,schedules),('2025-10-07','2025-10-12'))
  schedules['2025-10-13']['gameWeek'][0]['games'].append({'gameType':2,'startTimeUTC':'2025-10-13T16:00:00Z'})
  with self.assertRaises(ValueError):m.date_window(period,schedules)
 def test_missing_stat_is_not_zero(self):self.assertIsNone(m.number({},'SV'));self.assertEqual(m.number({'saves':0},'SV'),0)
 def test_counts_only_starters_and_position_scoring(self):
  archive={'teams':{'a':{'name':'A'}},'scoring':{'settings':[{'configs':[{'scoringCategory':{'shortName':'FOW'},'position':{'shortName':'C'},'points':0.05},{'scoringCategory':{'shortName':'FOW'},'position':{'shortName':'LW'},'points':0}]}]},'lineups':{'c':[[1,1,'a','ACTIVE','C']],'lw':[[1,1,'a','ACTIVE','LW']],'bench':[[1,1,'a','RESERVE','C']]}}
  directory={p:{'name':p} for p in ['c','lw','bench']};ids={p:{'status':'confirmed','nhlId':p} for p in directory}
  raw={('skater','summary'):[{'playerId':'c','gamesPlayed':1},{'playerId':'lw','gamesPlayed':1}],('skater','realtime'):[],('skater','faceoffwins'):[{'playerId':'c','totalFaceoffWins':10},{'playerId':'lw','totalFaceoffWins':20}],('goalie','summary'):[]}
  teams=m.calculate({'number':1},archive,directory,ids,{},raw,{'a':{'points':0.5,'categoryPoints':{'FOW':0.5}}})
  self.assertEqual(len(teams[0]['players']),2);self.assertEqual(teams[0]['calculated'],0.5);self.assertTrue(teams[0]['validated'])
if __name__=='__main__':unittest.main()
