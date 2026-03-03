import { Router } from 'express';

const router = Router();

router.get('/info', (req, res) => {
  res.json({ message: 'Use existing /api/results endpoints from server.js' });
});

export default router;
