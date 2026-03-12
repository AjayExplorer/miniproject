// Study Note:
// Election controller exposes election status lookup logic for modular routes.
import { Election } from '../models/index.js';

export async function getElectionStatus(req, res) {
  try {
    const type = (req.params.type || '').toLowerCase();
    const class_name = req.query.class_name ? req.query.class_name.toLowerCase() : undefined;

    let election = null;
    if (class_name) {
      election = await Election.findOne({ election_type: type, class_name }).sort({ created_at: -1 }).lean().exec();
    }
    if (!election) {
      election = await Election.findOne({ election_type: type }).sort({ created_at: -1 }).lean().exec();
    }

    res.json({ election });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
