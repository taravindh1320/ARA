import express     from 'express';
import cors        from 'cors';
import neuralRoutes from './routes/neural.routes';
import { config }  from './config';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allows requests from the Angular dev server only.
// In production, replace with actual domain(s).
app.use(cors({
  origin:      config.corsOrigins,
  credentials: false,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ara-neural-backend' });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/ara-neural', neuralRoutes);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

export default app;
