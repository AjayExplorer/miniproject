// Study Note:
// Placeholder results route in modular structure.
// Real results logic currently lives in server.js.
import { Router } from 'express';

const router = Router();

router.get('/info', (req, res) => {
  res.json({ message: 'Use existing /api/results endpoints from server.js' });
});

export default router;
