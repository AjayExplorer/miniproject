// Study Note:
// Placeholder student route in modular structure.
// Real student logic currently lives in server.js.
import { Router } from 'express';

const router = Router();

router.get('/info', (req, res) => {
  res.json({ message: 'Use existing /api/student and /api/students endpoints from server.js' });
});

export default router;
