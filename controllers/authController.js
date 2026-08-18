import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth/register
export const register = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password ) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters." });
        }

        //check if users exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: "Email already registered." });
        }

        //Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        //Insert user
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
            [email, passwordHash, name]
        );

        const user = result.rows[0];

        //Issue JWT
        const token = jwt.sign({userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({ user, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Registration failed." });
    }
};

//POST api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required." });
        }

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({error: "Invalid credentials."});
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid credentials." });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Login failed." });
    }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};