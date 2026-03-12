// Study Note:
// Modular server app setup: middleware, DB connection, route mounting, and health check.
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import routes from '../routes/index.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voting_system';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('[MODULAR] Connected to MongoDB'))
  .catch((err) => console.error('[MODULAR] MongoDB error:', err.message));

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ ok: true, service: 'voting-management-system' }));

export default app;
