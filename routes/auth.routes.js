import { Router } from 'express';
import { body } from 'express-validator';
import { login } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login',
  body('username').isString().notEmpty(),
  body('password').isString().notEmpty(),
  login
);

export default router;
