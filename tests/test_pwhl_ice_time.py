import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('ice',Path(__file__).parents[1]/'scripts/pwhl-ice-time.py');ice=importlib.util.module_from_spec(spec);spec.loader.exec_module(ice)
class IceTimeTests(unittest.TestCase):
 def game(self,home,visitor,home_goalie=True,visitor_goalie=True):
  game={'skaters':[],'goalies':[]};shifts={'home':[],'visitor':[]}
  for side,count,goalie in [('home',home,home_goalie),('visitor',visitor,visitor_goalie)]:
   for i in range(count):
    pid=side+str(i);game['skaters'].append({'id':pid,'side':side});shifts[side].append({'player_id':pid,'shifts':[{'period':'1','start_time':'02:00','end_time':'00:00','length':'02:00'}]})
   if goalie:
    pid=side+'G';game['goalies'].append({'id':pid,'side':side});shifts[side].append({'player_id':pid,'shifts':[{'period':'1','start_time':'02:00','end_time':'00:00','length':'02:00'}]})
  return game,shifts
 def test_five_on_four(self):
  game,shifts=self.game(5,4);r=ice.calculate(shifts,game);self.assertEqual(r['home0']['pp'],120);self.assertEqual(r['visitor0']['pk'],120);self.assertEqual(r['home0']['toi'],120)
 def test_empty_net_is_not_power_play(self):
  game,shifts=self.game(6,5,False,True);r=ice.calculate(shifts,game);self.assertEqual(r['home0']['pp'],0);self.assertEqual(r['visitor0']['pk'],0)
 def test_incoherent_counts_are_not_counted_as_special_teams(self):
  game,shifts=self.game(2,5);r=ice.calculate(shifts,game);self.assertEqual(r['home0']['unknown'],120);self.assertEqual(r['visitor0']['pp'],0)
 def test_overlapping_stints_are_merged(self):
  self.assertEqual(ice.merge([[0,60],[30,80],[80,100]]),[[0,100]])
if __name__=='__main__':unittest.main()
