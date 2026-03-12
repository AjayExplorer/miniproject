// Study Note:
// Placeholder verification route in modular structure.
// Real verification logic currently lives in server.js.
import { Router } from 'express';

const router = Router();

router.get('/info', (req, res) => {
  res.json({ message: 'Use existing /api/verification endpoints from server.js' });
});

export default router;
