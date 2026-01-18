const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://admin:password@postgres:5432/flowviz',
});

// Test DB Connection
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});


// --- ROUTES ---

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login
app.post('/api/login', async (req, res) => {
    const client = await pool.connect();
    try {
        const { email } = req.body;
        // Simple "passwordless" check for now, or check generic password if needed.
        // For Mode C in this demo, we trust the email exists in DB.

        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await client.query(query, [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Simulating a session token
        res.json({
            user: result.rows[0],
            token: 'mock-jwt-token-for-mode-c'
        });
    } catch (err) {
        console.error('Error logging in:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Traceability
app.get('/api/traceability/:lotCode', async (req, res) => {
    const client = await pool.connect();
    try {
        const { lotCode } = req.params;

        // 1. Get Central Lot
        const lotQuery = 'SELECT * FROM lots WHERE lot_code = $1';
        const lotResult = await client.query(lotQuery, [lotCode]);

        if (lotResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lot not found' });
        }

        const centralLot = lotResult.rows[0];

        // 2. Get Parents (Upstream)
        const parentsQuery = `
            SELECT l.* 
            FROM lot_genealogy lg
            JOIN lots l ON lg.parent_lot_id = l.id
            WHERE lg.child_lot_id = $1
        `;
        const parentsResult = await client.query(parentsQuery, [centralLot.id]);

        // 3. Get Children (Downstream)
        const childrenQuery = `
            SELECT l.* 
            FROM lot_genealogy lg
            JOIN lots l ON lg.child_lot_id = l.id
            WHERE lg.parent_lot_id = $1
        `;
        const childrenResult = await client.query(childrenQuery, [centralLot.id]);

        // Structure for Frontend Graph
        // We can flatten this or keep it structured. The Frontend Graph expects `lot` and `related`.
        // To be compatible with the *Mock* structure (which was flat list of lots), we might need to adjust.
        // BUT the plan said "Adapt frontend". So let's return a nice graph object.

        res.json({
            central: centralLot,
            parents: parentsResult.rows,
            children: childrenResult.rows
        });

    } catch (err) {
        console.error('Error fetching traceability:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Register LOT
app.post('/api/lots', async (req, res) => {
    const client = await pool.connect();
    try {
        const lot = req.body;

        // Construct Query dynamically based on fields
        const keys = Object.keys(lot);
        const values = Object.values(lot);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const query = `
      INSERT INTO lots (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

        const result = await client.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error registering lot:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Record QC Decision
app.post('/api/qc-decisions', async (req, res) => {
    const client = await pool.connect();
    try {
        const decision = req.body;

        const keys = Object.keys(decision);
        const values = Object.values(decision);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

        const query = `
      INSERT INTO qc_decisions (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

        const result = await client.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error recording qc decision:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Backend API listening at http://localhost:${port}`);
});
