// Study Note:
// Student schema stores student identity, class, tutor ownership, and face embedding.
// Uses compound unique index on (admission_no, class_name) for per-class uniqueness.
import mongoose from 'mongoose';
const { Schema, model, Types } = mongoose;

const studentSchema = new Schema({
  admission_no: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, required: true },
  class_name: { type: String, required: true, trim: true, lowercase: true },
  tutor_id: { type: Types.ObjectId, ref: 'Admin' },
  // Store face embedding as array of numbers (stringified in DB stays compatible)
  face_encoding: { type: Schema.Types.Mixed },
  is_verified: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'registered_at', updatedAt: 'updated_at' } });

// Ensure uniqueness per class: same admission_no allowed in different classes
studentSchema.index(
  { admission_no: 1, class_name: 1 },
  { unique: true, name: 'admission_no_class_name_unique' }
);

// Drop any legacy indexes that are not the compound (admission_no, class_name)
async function dropLegacyAdmissionIndexes() {
  try {
    const coll = mongoose.connection.db.collection('students');
    const indexes = await coll.indexes();
    const desiredKeys = JSON.stringify({ admission_no: 1, class_name: 1 });
    for (const idx of indexes) {
      const keys = JSON.stringify(idx.key || {});
      if (idx.name === '_id_') continue;
      if (keys === desiredKeys) continue; // keep the intended compound index
      await coll.dropIndex(idx.name);
      console.log('[STUDENT] Dropped legacy index', idx.name, keys);
    }
  } catch (err) {
    // Ignore if collection/index not ready; this runs best-effort
  }
}

if (mongoose.connection.readyState === 1) {
  dropLegacyAdmissionIndexes();
} else {
  mongoose.connection.once('connected', dropLegacyAdmissionIndexes);
}

export default model('Student', studentSchema);
