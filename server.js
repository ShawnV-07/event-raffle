const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Player joins — gets assigned a unique number
app.post('/join', async (req, res) => {
  const { name, dob } = req.body;

  // Pick a random unused number
  const number = Math.floor(Math.random() * 9000) + 1000;

  const { data, error } = await supabase
    .from('players')
    .insert([{ number, name, dob, registered: true }])
    .select();
  if (error) {
    console.log('Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json({ number: data[0].number, name: data[0].name });
});

// Host picks a random registered player
app.get('/pick', async (req, res) => {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('registered', true);
  if (error) {
    console.log('Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }
  if (data.length === 0) return res.status(404).json({ error: 'No players yet' });

  const winner = data[Math.floor(Math.random() * data.length)];
  res.json(winner);
});

// Get all players (for host view)
app.get('/players', async (req, res) => {
  const { data, error } = await supabase.from('players').select('*');
  if (error) {
    console.log('Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

const PORT = process.env.PORT || 3000;
// Reset all players (for testing)
app.delete('/reset', async (req, res) => {
  const { error } = await supabase.from('players').delete().neq('id', 0);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'All players deleted' });
});

// Store latest winner in memory
let latestWinner = null;

// Update pick route to save latest winner
app.get('/pick', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('registered', true);

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).json({ error: 'No players yet' });

    const winner = data[Math.floor(Math.random() * data.length)];
    latestWinner = winner; // Save for display page
    res.json(winner);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/latest-winner', (req, res) => {
  if (!latestWinner) return res.json({});
  res.json(latestWinner);
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));