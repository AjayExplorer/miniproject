import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.js';
import { createAdmin, listAdmins } from '../controllers/admin.controller.js';

const router = Router();

router.post('/create', authenticateJWT, requireRole('super_admin'), createAdmin);
router.get('/all', authenticateJWT, requireRole('super_admin'), listAdmins);

export default router;
