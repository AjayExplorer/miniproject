import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const candidateSchema = new Schema({
  student_id: { type: Types.ObjectId, ref: 'Student', required: true },
  election_id: { type: Types.ObjectId, ref: 'Election', required: true },
  position: { type: String, default: 'class_representative' },
  vote_count: { type: Number, default: 0 },
  is_elected: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default model('Candidate', candidateSchema);
