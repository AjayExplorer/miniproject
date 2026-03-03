import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const electedRepresentativeSchema = new Schema({
  student_id: { type: Types.ObjectId, ref: 'Student', required: true },
  class_name: { type: String, required: true },
  election_id: { type: Types.ObjectId, ref: 'Election', required: true }
}, { timestamps: { createdAt: 'elected_at', updatedAt: 'updated_at' } });

export default model('ElectedRepresentative', electedRepresentativeSchema);
