import express from 'express';
import rateLimit from 'express-rate-limit';
import { 
  register, 
  login, 
  refresh, 
  logout, 
  getMe, 
  updateGracePeriod 
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRegistration, validateLogin } from '../validators/authValidator.js';

const router = express.Router();

// Strict rate limiter for auth entry points (15 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login or registration attempts. Please try again after 15 minutes.'
  }
});

router.post('/register', authLimiter, validateRegistration, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/grace-period', authenticate, updateGracePeriod);

export default router;
