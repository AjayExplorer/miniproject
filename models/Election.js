// Study Note:
// Election schema tracks election type, optional class scope, status, and timing data.
import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const electionSchema = new Schema({
  election_type: { type: String, required: true, enum: ['class_level', 'secondary_level'] },
  class_name: { type: String },
  status: { type: String, default: 'not_started', enum: ['not_started', 'ongoing', 'ended'] },
  started_at: { type: Date },
  ended_at: { type: Date }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default model('Election', electionSchema);
