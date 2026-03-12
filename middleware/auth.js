// Study Note:
// JWT security middleware.
// - signToken: creates token for admin login
// - authenticateJWT: validates Bearer token and loads current admin
// - requireRole: enforces role-based access control
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

export function signToken(admin) {
  return jwt.sign({ id: admin._id, role: admin.role, username: admin.username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function authenticateJWT(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Authorization' });
    const token = auth.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const admin = await Admin.findById(payload.id).lean().exec();
    if (!admin) return res.status(401).json({ error: 'Invalid token' });
    req.user = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', details: err.message });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Forbidden: insufficient role',
        required_roles: roles,
        current_role: req.user.role
      });
    }
    next();
  };
}
