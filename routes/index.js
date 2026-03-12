// Study Note:
// Root API router for modular server; groups feature routes under /api.
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import electionRoutes from './election.routes.js';
import adminRoutes from './admin.routes.js';
import studentRoutes from './student.routes.js';
import verificationRoutes from './verification.routes.js';
import resultsRoutes from './results.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/election', electionRoutes);
router.use('/admin', adminRoutes);
router.use('/student', studentRoutes);
router.use('/verification', verificationRoutes);
router.use('/results', resultsRoutes);

export default router;
