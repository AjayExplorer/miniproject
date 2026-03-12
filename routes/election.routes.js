// Study Note:
// Election routes for modular server status endpoints.
import { Router } from 'express';
import { getElectionStatus } from '../controllers/election.controller.js';

const router = Router();

router.get('/status/:type', getElectionStatus);

export default router;
