const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Generate a unique number not already in the database
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

// Player joins
app.post('/join', async (req, res) => {
  try {
    const { name, dob } = req.body;
    console.log('Join request received:', { name, dob });

    if (!name || !dob) {
      return res.status(400).json({ error: 'Name and DOB are required' });
    }

    const number = await getUniqueNumber();
    console.log('Generated number:', number);

    const { data, error } = await supabase
      .from('players')
      .insert([{ number, name, dob, registered: true }])
      .select();

    if (error) {
      console.log('Supabase insert error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Player registered:', data[0]);
    res.json({ number: data[0].number, name: data[0].name });

  } catch (err) {
    console.log('Server error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Store latest pick in memory
let latestPick = null;

// Pick multiple random players
app.get('/pick', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 1;
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('registered', true);

    if (error) return res.status(500).json({ error: error.message });
    if (data.length === 0) return res.status(404).json({ error: 'No players yet' });

    const shuffled = data.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(count, data.length));
    latestPick = picked;
    res.json(picked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get latest pick for display page
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

// Always last!
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));