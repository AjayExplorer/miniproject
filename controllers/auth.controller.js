import { signToken } from '../middleware/auth.js';
import { Admin } from '../models/index.js';

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await Admin.findOne({ username }).exec();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, role: user.role, class_name: user.class_name }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
