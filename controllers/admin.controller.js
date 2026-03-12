// Study Note:
// Admin controller provides create/list operations for admin accounts.
import { Admin } from '../models/index.js';

export async function createAdmin(req, res) {
  try {
    const { username, password, role, class_name } = req.body;
    const admin = await Admin.create({ username, password, role, class_name });
    res.json({ success: true, admin });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: error.message });
  }
}

export async function listAdmins(req, res) {
  try {
    const admins = await Admin.find().sort({ created_at: -1 }).lean().exec();
    res.json({ admins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
