import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const verificationRequestSchema = new Schema({
  student_id: { type: Types.ObjectId, ref: 'Student' },
  admission_no: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  tutor_id: { type: Types.ObjectId, ref: 'Admin' },
  resolved_by: { type: Types.ObjectId, ref: 'Admin' },
  notified_to_tutor: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'requested_at', updatedAt: 'resolved_at' } });

export default model('VerificationRequest', verificationRequestSchema);
