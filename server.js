const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const TEAMS = ['Red', 'Yellow', 'Green', 'Blue', 'Purple'];
const TEAM_COLORS = {
  Red: '#e94560',
  Yellow: '#f5a623',
  Green: '#2ecc71',
  Blue: '#3498db',
  Purple: '#9b59b6'
};

// Generate a unique number
async function getUniqueNumber() {
  let attempts = 0;
  while (attempts < 20) {
    const number = Math.floor(Math.random() * 9000) + 1000;
    const { data } = await supabase
      .from('players')
      .select('number')
      .eq('number', number);
    if (data && data.length === 0) return number;
    attempts++;
  }
  throw new Error('Could not generate unique number');
}

// Get next team based on even distribution
async function getNextTeam() {
  const { data } = await supabase
    .from('players')
    .select('team');
  
  const counts = {};
  TEAMS.forEach(t => counts[t] = 0);
  if (data) data.forEach(p => { if (p.team) counts[p.team]++; });
  
  // Pick team with lowest count
  return TEAMS.reduce((a, b) => counts[a] <= counts[b] ? a : b);
}

// Player joins
app.post('/join', async (req, res) => {
  try {
    const { name, dob } = req.body;
    if (!name || !dob) return res.status(400).json({ error: 'Name and DOB are required' });

    const number = await getUniqueNumber();
    const team = await getNextTeam();

    const { data, error } = await supabase
      .from('players')
      .insert([{ number, name, dob, registered: true, team }])
      .select();

    if (error) {
      console.log('Supabase insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ number: data[0].number, name: data[0].name, team: data[0].team, color: TEAM_COLORS[data[0].team] });
  } catch (err) {
    console.log('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Store latest pick
let latestPick = null;

// Pick random players (optionally filter by team)
app.get('/pick', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 1;
    const team = req.query.team || null;

    let query = supabase.from('players').select('*').eq('registered', true);
    if (team && team !== 'All') query = query.eq('team', team);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).json({ error: 'No players found' });

    const shuffled = data.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, data.length));
    latestPick = picked;
    res.json(picked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Latest pick for display page
app.get('/latest-winner', (req, res) => {
  if (!latestPick) return res.json([]);
  res.json(latestPick);
});

// Get all players
app.get('/players', async (req, res) => {
  try {
    const { data, error } = await supabase.from('players').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset all players
app.delete('/reset', async (req, res) => {
  try {
    const { error } = await supabase.from('players').delete().neq('id', 0);
    if (error) return res.status(500).json({ error: error.message });
    latestPick = null;
    res.json({ message: 'All players deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));