import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const voteSchema = new Schema({
  voter_id: { type: Types.ObjectId, ref: 'Student', required: true },
  candidate_id: { type: Types.ObjectId, ref: 'Candidate', required: true },
  election_id: { type: Types.ObjectId, ref: 'Election', required: true }
}, { timestamps: { createdAt: 'voted_at', updatedAt: 'updated_at' } });

// enforce uniqueness similar to SQL unique constraint
voteSchema.index({ voter_id: 1, candidate_id: 1, election_id: 1 }, { unique: true });

export default model('Vote', voteSchema);
