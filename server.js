import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { signToken, authenticateJWT, requireRole } from './middleware/auth.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  Admin,
  Student,
  Election,
  Candidate,
  Vote,
  VerificationRequest,
  ElectedRepresentative
} from './models/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import faceService from './services/faceRecognitionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 6008;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voting_system';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(async () => {
    console.log('Connected to MongoDB');
    // ensure default super admin exists
    const existing = await Admin.findOne({ username: 'superadmin' }).exec();
    if (!existing) {
      await Admin.create({ username: 'superadmin', password: 'admin123', role: 'super_admin' });
      console.log('Created default superadmin (superadmin/admin123)');
    } else {
      // migrate existing plaintext default password to hashed if needed
      if (existing.password && !existing.password.startsWith('$2')) {
        const hashed = await bcrypt.hash('admin123', 10);
        await Admin.findByIdAndUpdate(existing._id, { password: hashed }).exec();
        console.log('Hashed existing superadmin password during migration');
      }
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/login',
  body('username').isString().notEmpty(),
  body('password').isString().notEmpty(),
  async (req, res) => {
    const { username, password } = req.body;
    console.log('[LOGIN] attempt', { username });
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

      const user = await Admin.findOne({ username }).exec();
      if (!user) {
        console.log('[LOGIN] user not found', { username });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const ok = await user.comparePassword(password);
      if (!ok) {
        console.log('[LOGIN] bad password', { username });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signToken(user);
      console.log('[LOGIN] success', { username, role: user.role });
      res.json({ 
        success: true, 
        token, 
        user: { 
          id: user._id, 
          username: user.username, 
          role: user.role,
          class_name: user.class_name 
        } 
      });
    } catch (error) {
      console.error('[LOGIN] error', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post('/api/admin/create', authenticateJWT, requireRole('super_admin'),
  body('username').isString().notEmpty(),
  body('password').isString().isLength({ min: 6 }),
  body('role').isIn(['super_admin', 'tutor_admin', 'staff_advisor']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const { username, password, role, class_name } = req.body;
      const admin = await Admin.create({ username, password, role, class_name });
      res.json({ success: true, admin: { id: admin._id, username: admin.username, role: admin.role } });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'Username already exists' });
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/admins', authenticateJWT, requireRole('super_admin'), async (req, res) => {
  try {
    const admins = await Admin.find().sort({ created_at: -1 }).lean().exec();
    res.json({ admins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/student/register', authenticateJWT, requireRole('tutor_admin'),
  body('admission_no').isString().notEmpty().trim(),
  body('name').isString().notEmpty().trim(),
  body('face_image').optional().isString(),
  body('face_encoding').optional().isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

      const { admission_no, name, face_image, face_encoding } = req.body;

      // Auto-inject class_name and tutor_id from authenticated admin
      const class_name = req.user.class_name;
      const tutor_id = req.user._id;

      if (!class_name) {
        return res.status(400).json({ error: 'Admin must have a class_name assigned' });
      }

      const normalizedAdmission = admission_no.trim().toLowerCase();
      const normalizedClass = class_name.trim().toLowerCase();

      console.log('[STUDENT] registering', { admission_no: normalizedAdmission, name, class_name: normalizedClass, tutor_id });

      // Duplicate check scoped to class (case-insensitive via normalization)
      const existing = await Student.findOne({ admission_no: normalizedAdmission, class_name: normalizedClass }).lean().exec();
      if (existing) {
        console.log('[STUDENT] duplicate', { admission_no: normalizedAdmission, class_name: normalizedClass, id: existing._id });
        return res.status(409).json({ error: 'Student with this admission number already exists in this class' });
      }

      // Extract face embedding if image provided
      let face_embedding = null;
      const incomingImage = face_image || face_encoding; // accept either key from frontend
      if (incomingImage) {
        try {
          const buffer = Buffer.from(incomingImage.split(',')[1] || incomingImage, 'base64');
          face_embedding = await faceService.extractEmbeddingFromImageBuffer(buffer);
        } catch (err) {
          console.warn('[STUDENT] face extraction failed', err.message);
          return res.status(400).json({ error: 'Failed to extract face from image: ' + err.message });
        }
      }

      const student = await Student.create({ 
        admission_no: normalizedAdmission, 
        name, 
        class_name: normalizedClass, 
        tutor_id, 
        face_encoding: face_embedding || null
      });

      console.log('[STUDENT] registered successfully', { id: student._id, admission_no });
      res.json({ success: true, student });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Student with this admission number already exists in this class' });
      }
      console.error('[STUDENT] registration error', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/students/all', async (req, res) => {
  try {
    const students = await Student.find().sort({ registered_at: -1 }).lean().exec();
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:tutorId', async (req, res) => {
  try {
    const { tutorId } = req.params;
    const students = await Student.find({ tutor_id: tutorId }).sort({ registered_at: -1 }).lean().exec();
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/election/start', authenticateJWT, requireRole('super_admin'),
  body('election_type').isString().notEmpty().custom((v) => {
    const allowed = ['class_level', 'secondary_level', 'CLASS_LEVEL', 'SECONDARY_LEVEL'];
    if (!allowed.includes(v)) throw new Error('election_type must be CLASS_LEVEL or SECONDARY_LEVEL');
    return true;
  }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

      const { election_type, class_name } = req.body;
      if (!election_type) return res.status(400).json({ error: 'election_type is required' });

      const normalizedType = election_type.toLowerCase();
      const normalizedClassName = class_name ? class_name.toLowerCase() : (normalizedType === 'class_level' ? 'all_classes' : undefined);
      console.log('[ELECTION] start request', { election_type: normalizedType, class_name });

      // For secondary elections, ensure class-level elections have ended
      if (normalizedType === 'secondary_level') {
        const ongoingClassElection = await Election.findOne({
          election_type: 'class_level',
          status: 'ongoing'
        }).lean().exec();
        
        if (ongoingClassElection) {
          console.log('[ELECTION] Cannot start secondary while class election ongoing');
          return res.status(400).json({
            error: 'Secondary election can only start after all class-level elections have ended.',
            ongoingElection: ongoingClassElection
          });
        }
      }

      // End any existing ongoing elections to enforce a single active election
      await Election.updateMany({ status: 'ongoing' }, { status: 'ended', ended_at: new Date() }).exec();

      let election = await Election.findOne({
        election_type: normalizedType,
        class_name: normalizedClassName,
        status: 'not_started'
      })
        .sort({ created_at: -1 })
        .exec();

      if (election) {
        election.status = 'ongoing';
        election.started_at = new Date();
        election.ended_at = null;
        await election.save();
      } else {
        election = await Election.create({
          election_type: normalizedType,
          class_name: normalizedClassName,
          status: 'ongoing',
          started_at: new Date()
        });
      }

      console.log('[ELECTION] started', { election_type: normalizedType, id: election._id });
      res.json({ 
        success: true, 
        election,
        message: 'Election started successfully',
        shouldRedirectTutorAdmin: normalizedType === 'class_level'
      });
    } catch (error) {
      console.error('[ELECTION] start error', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post('/api/election/end', authenticateJWT, requireRole('super_admin'),
  body('election_type').isString().notEmpty().custom((v) => {
    const allowed = ['class_level', 'secondary_level', 'CLASS_LEVEL', 'SECONDARY_LEVEL'];
    if (!allowed.includes(v)) throw new Error('election_type must be CLASS_LEVEL or SECONDARY_LEVEL');
    return true;
  }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      const { election_type, class_name } = req.body;
      const normalizedType = election_type.toLowerCase();
      console.log('[ELECTION] end request', { election_type: normalizedType, class_name });

      // Find active election by type and class_name (for class_level elections)
      const query = { 
        election_type: normalizedType, 
        status: 'ongoing' 
      };
      
      if (normalizedType === 'class_level' && class_name) {
        query.class_name = class_name.toLowerCase();
      }
      
      const election = await Election.findOne(query).exec();

      if (!election) {
        console.log('[ELECTION] no active election found', { election_type: normalizedType });
        return res.status(404).json({ error: `No active ${normalizedType.replace('_', ' ')} election found` });
      }

      // End the election
      election.status = 'ended';
      election.ended_at = new Date();
      await election.save();

      const election_id = election._id;

      console.log('[ELECTION] Aggregating votes for election:', election_id);
      
      // Aggregate votes for each candidate
      const voteAggregation = await Vote.aggregate([
        {
          $match: {
            election_id: new mongoose.Types.ObjectId(election_id),
            vote_type: { $ne: 'nota' },
            candidate_id: { $ne: null }
          }
        },
        { $group: { _id: '$candidate_id', vote_count: { $sum: 1 } } }
      ]);
      
      console.log('[ELECTION] Vote aggregation results:', voteAggregation);
      
      // Update each candidate with their vote count
      for (const voteData of voteAggregation) {
        await Candidate.findByIdAndUpdate(voteData._id, { 
          vote_count: voteData.vote_count 
        }).exec();
        console.log('[ELECTION] Updated candidate', voteData._id, 'with', voteData.vote_count, 'votes');
      }
      
      // Get all candidates sorted by vote count
      const allCandidates = await Candidate.find({ election_id })
        .populate('student_id')
        .sort({ vote_count: -1 })
        .exec();
      
      console.log('[ELECTION] Total candidates:', allCandidates.length);
      console.log('[ELECTION] Candidates before marking elected:', allCandidates.length);

      // Reset election winner flags and previously generated representatives for this election
      await Candidate.updateMany({ election_id }, { is_elected: false }).exec();
      await ElectedRepresentative.deleteMany({ election_id }).exec();

      if (allCandidates && allCandidates.length > 0) {
        if (normalizedType === 'class_level') {
          const groupedByClass = {};
          for (const candidate of allCandidates) {
            const className = (candidate.student_id?.class_name || 'unknown').toLowerCase();
            if (!groupedByClass[className]) groupedByClass[className] = [];
            groupedByClass[className].push(candidate);
          }

          for (const className of Object.keys(groupedByClass)) {
            const classCandidates = groupedByClass[className].sort((a, b) => b.vote_count - a.vote_count);
            const winners = classCandidates.slice(0, Math.min(2, classCandidates.length));

            for (const winner of winners) {
              await Candidate.findByIdAndUpdate(winner._id, { is_elected: true }).exec();
              await ElectedRepresentative.create({
                student_id: winner.student_id._id,
                class_name: winner.student_id.class_name || className,
                election_id
              });
              console.log('[ELECTION] Class winner selected:', {
                class_name: className,
                candidate_id: winner._id,
                student_name: winner.student_id?.name,
                votes: winner.vote_count
              });
            }
          }
        } else {
          // Secondary election: elect top candidate per position
          const groupedByPosition = {};
          for (const candidate of allCandidates) {
            const position = candidate.position || 'general';
            if (!groupedByPosition[position]) groupedByPosition[position] = [];
            groupedByPosition[position].push(candidate);
          }

          for (const position of Object.keys(groupedByPosition)) {
            const positionCandidates = groupedByPosition[position].sort((a, b) => b.vote_count - a.vote_count);
            const winner = positionCandidates[0];
            if (winner) {
              await Candidate.findByIdAndUpdate(winner._id, { is_elected: true }).exec();
              console.log('[ELECTION] Secondary winner selected:', {
                position,
                candidate_id: winner._id,
                student_name: winner.student_id?.name,
                votes: winner.vote_count
              });
            }
          }
        }
      }
      
      // VERIFY candidates still exist - DO NOT DELETE THEM
      const finalCandidates = await Candidate.find({ election_id }).lean().exec();
      console.log('[ELECTION] ✅ Candidates after election end:', finalCandidates.length, '(PRESERVED)');

      // For class-level elections, auto-transfer top 2 elected reps to staff advisor
      let staffAdvisorNotified = false;
      if (normalizedType === 'class_level') {
        const electedForThisElection = await ElectedRepresentative.find({ election_id })
          .populate('student_id')
          .lean()
          .exec();
        
        console.log('[ELECTION] Auto-transferring', electedForThisElection.length, 'elected representatives to staff advisor');
        staffAdvisorNotified = electedForThisElection.length > 0;
      }

      console.log('[ELECTION] ended', { election_type: normalizedType, id: election._id });
      res.json({ 
        success: true, 
        election,
        message: 'Election ended successfully. Results finalized.',
        staffAdvisorNotified: staffAdvisorNotified
      });
    } catch (error) {
      console.error('[ELECTION] end error', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// Reset everything for a fresh election cycle
app.post('/api/election/reset-all', authenticateJWT, requireRole('super_admin'), async (req, res) => {
  try {
    // Purge election-related collections for a fully clean cycle
    const [elections, cand, votes, verReq, elected] = await Promise.all([
      Election.deleteMany({}).exec(),
      Candidate.deleteMany({}).exec(),
      Vote.deleteMany({}).exec(),
      VerificationRequest.deleteMany({}).exec(),
      ElectedRepresentative.deleteMany({}).exec()
    ]);

    console.log('[ELECTION] reset-all complete', {
      candidates: cand.deletedCount,
      votes: votes.deletedCount,
      verificationRequests: verReq.deletedCount,
      electedRepresentatives: elected.deletedCount
    });

    res.json({
      success: true,
      message: 'All elections reset. Start a new election to continue.',
      deleted: {
        elections: elections.deletedCount,
        candidates: cand.deletedCount,
        votes: votes.deletedCount,
        verificationRequests: verReq.deletedCount,
        electedRepresentatives: elected.deletedCount
      }
    });
  } catch (error) {
    console.error('[ELECTION] reset-all error', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/election/status/:type', async (req, res) => {
  try {
    let { type } = req.params;
    let { class_name } = req.query;

    // Normalize inputs for consistent matching
    type = (type || '').toLowerCase();
    if (class_name) class_name = class_name.trim().toLowerCase();

    const baseQuery = { election_type: type };

    console.log('[ELECTION_STATUS] Searching for type:', type, 'class_name:', class_name);
    // Prevent intermediates/proxies from caching status responses
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Prefer ONGOING elections always
    // 1) Try exact class match with ongoing status
    let election = null;
    if (class_name) {
      election = await Election.findOne({ ...baseQuery, class_name, status: 'ongoing' }).lean().exec();
    }

    // 2) If not found, try ongoing ALL classes bucket
    if (!election && class_name && type === 'class_level') {
      election = await Election.findOne({ ...baseQuery, class_name: 'all_classes', status: 'ongoing' }).lean().exec();
    }

    // 3) If not found, try ongoing with undefined/null class_name (backward compatibility)
    if (!election && class_name) {
      election = await Election.findOne({ 
        ...baseQuery, 
        status: 'ongoing',
        $or: [{ class_name: { $exists: false } }, { class_name: null }, { class_name: undefined }]
      }).lean().exec();
      
      // If we found an election without class_name, set it to match the requested class
      if (election && !election.class_name) {
        console.log('[ELECTION_STATUS] Found election without class_name, updating to:', class_name);
        await Election.findByIdAndUpdate(election._id, { class_name }).exec();
        election.class_name = class_name;
      }
    }

    // 4) If still not found, try any ongoing election of this type
    if (!election) {
      election = await Election.findOne({ ...baseQuery, status: 'ongoing' }).lean().exec();
    }

    // 4) If still not found, prefer NOT_STARTED elections by class
    if (!election && class_name) {
      election = await Election.findOne({ ...baseQuery, class_name, status: 'not_started' })
        .sort({ created_at: -1 })
        .lean()
        .exec();
    }

    // 5) If still not found, prefer NOT_STARTED all-classes bucket
    if (!election && class_name && type === 'class_level') {
      election = await Election.findOne({ ...baseQuery, class_name: 'all_classes', status: 'not_started' })
        .sort({ created_at: -1 })
        .lean()
        .exec();
    }

    // 6) If still not found, fall back to the most recent by started_at (with class match)
    if (!election && class_name) {
      election = await Election.findOne({ ...baseQuery, class_name })
        .sort({ started_at: -1, created_at: -1 })
        .lean()
        .exec();
    }

    // 7) If still not found, try latest all-classes election
    if (!election && class_name && type === 'class_level') {
      election = await Election.findOne({ ...baseQuery, class_name: 'all_classes' })
        .sort({ started_at: -1, created_at: -1 })
        .lean()
        .exec();
    }

    // 8) Fall back to most recent with undefined class_name
    if (!election && class_name) {
      election = await Election.findOne({ 
        ...baseQuery,
        $or: [{ class_name: { $exists: false } }, { class_name: null }, { class_name: undefined }]
      })
        .sort({ started_at: -1, created_at: -1 })
        .lean()
        .exec();
      
      // Update the election with the requested class_name
      if (election && !election.class_name) {
        console.log('[ELECTION_STATUS] Found election without class_name, updating to:', class_name);
        await Election.findByIdAndUpdate(election._id, { class_name }).exec();
        election.class_name = class_name;
      }
    }

    // 9) Final fallback - any election of this type
    if (!election) {
      election = await Election.findOne(baseQuery)
        .sort({ started_at: -1, created_at: -1 })
        .lean()
        .exec();
    }

    console.log('[ELECTION_STATUS] Result for type:', type, 'class_name:', class_name, '=>', election ? { id: election._id, status: election.status, class_name: election.class_name } : 'none');
    res.json({ election });
  } catch (error) {
    console.error('[ELECTION_STATUS] error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Single source of truth for active election
app.get('/api/election/active', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    const active = await Election.findOne({ status: 'ongoing' })
      .sort({ started_at: -1, created_at: -1 })
      .lean()
      .exec();

    if (!active) {
      return res.json({ status: 'ended' });
    }

    return res.json({
      status: 'ongoing',
      electionId: active._id,
      election_type: active.election_type,
      class_name: active.class_name
    });
  } catch (error) {
    console.error('[ELECTION_ACTIVE] error', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/candidate/add', authenticateJWT, requireRole('tutor_admin', 'staff_advisor'),
  body('student_id').isString().notEmpty(),
  body('election_id').optional().isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      
      const { student_id, election_id, position } = req.body;
      
      console.log('[CANDIDATE] Adding candidate', { student_id, election_id, position, user_role: req.user.role });
      
      // Resolve or create election (supports adding candidates before election starts)
      let election = null;

      if (election_id) {
        election = await Election.findById(election_id).lean().exec();
        if (election && election.status === 'ended') {
          console.log('[CANDIDATE] Provided election is ended; resolving/creating not_started election instead', { election_id });
          election = null;
        }
      }

      if (!election) {
        const lookup = req.user.role === 'tutor_admin'
          ? { election_type: 'class_level', class_name: 'all_classes' }
          : { election_type: 'secondary_level' };

        election = await Election.findOne({
          ...lookup,
          status: { $in: ['not_started', 'ongoing'] }
        })
          .sort({ started_at: -1, created_at: -1 })
          .lean()
          .exec();

        if (!election) {
          election = await Election.create({
            ...lookup,
            status: 'not_started'
          });
          election = election.toObject();
        }
      }

      if (!election) {
        console.error('[CANDIDATE] Election resolution failed:', election_id);
        return res.status(404).json({ error: 'Election not found and could not be created' });
      }

      const resolvedElectionId = String(election._id);
      
      console.log('[CANDIDATE] Election found:', { 
        id: election._id, 
        type: election.election_type, 
        status: election.status,
        class_name: election.class_name
      });

      // Allow adding candidates when election is not started or ongoing; block only if ended
      if (election.status === 'ended') {
        console.warn('[CANDIDATE] Election ended, cannot add candidate', { status: election.status });
        return res.status(400).json({ error: '❌ Error: Election is not active. Please start a new election to add candidates.' });
      }
      
      // 🔧 FIXED: Allow adding candidates at ANY time (before, during, or after election)
      // Candidates will be linked to the election when voting starts
      // No longer blocking if election.status !== 'ongoing'
      
      // Check if student exists
      const student = await Student.findById(student_id).lean().exec();
      if (!student) {
        console.error('[CANDIDATE] Student not found:', student_id);
        return res.status(404).json({ error: 'Student not found' });
      }
      
      console.log('[CANDIDATE] Student found:', { 
        id: student._id, 
        name: student.name, 
        admission_no: student.admission_no,
        class_name: student.class_name
      });
      
      // For class_level elections, verify student's class matches election's class
      if (election.election_type === 'class_level' && req.user.role === 'tutor_admin') {
        if (election.class_name && election.class_name !== 'all_classes' && election.class_name !== student.class_name) {
          console.error('[CANDIDATE] Class mismatch:', { 
            student_class: student.class_name, 
            election_class: election.class_name 
          });
          return res.status(400).json({ 
            error: 'Student class does not match election class. Cannot add student from different class.' 
          });
        }
        
        // Also verify the tutor admin's class matches
        if (election.class_name && election.class_name !== 'all_classes' && req.user.class_name !== election.class_name) {
          console.error('[CANDIDATE] Admin class mismatch:', { 
            admin_class: req.user.class_name, 
            election_class: election.class_name 
          });
          return res.status(403).json({ 
            error: 'You can only add candidates to elections in your own class.' 
          });
        }
      }

      if (election.election_type === 'secondary_level' && req.user.role === 'staff_advisor') {
        const representative = await ElectedRepresentative.findOne({ student_id })
          .populate('election_id')
          .lean()
          .exec();

        if (!representative || !representative.election_id || representative.election_id.election_type !== 'class_level') {
          return res.status(400).json({ error: 'Only elected class representatives can be added to secondary election candidates.' });
        }
      }
      
      // Check for duplicate
      const existing = await Candidate.findOne({ student_id, election_id: resolvedElectionId }).lean().exec();
      if (existing) {
        console.warn('[CANDIDATE] Duplicate candidate:', { student_id, election_id: resolvedElectionId });
        return res.status(409).json({ error: 'This student is already a candidate in this election' });
      }
      
      const candidate = await Candidate.create({ 
        student_id, 
        election_id: resolvedElectionId,
        position: position || 'class_representative' 
      });
      
      console.log('[CANDIDATE] Created successfully:', { 
        id: candidate._id, 
        student_id, 
        election_id: resolvedElectionId
      });
      
      // Auto-elect if class-level election has 1-2 candidates total
      if (election.election_type === 'class_level') {
        const totalCandidates = await Candidate.countDocuments({ election_id: resolvedElectionId }).exec();
        console.log('[CANDIDATE] Total candidates for this election:', totalCandidates);
        
        if (totalCandidates <= 2) {
          console.log('[CANDIDATE] Auto-electing candidates (1-2 total)');
          
          // Mark all candidates as elected
          const allCandidates = await Candidate.find({ election_id: resolvedElectionId })
            .populate('student_id')
            .exec();
          
          for (const cand of allCandidates) {
            await Candidate.findByIdAndUpdate(cand._id, { is_elected: true }).exec();
            
            // Create ElectedRepresentative record
            const existingRep = await ElectedRepresentative.findOne({
              student_id: cand.student_id._id,
              election_id: resolvedElectionId
            }).lean().exec();
            
            if (!existingRep) {
              await ElectedRepresentative.create({
                student_id: cand.student_id._id,
                class_name: cand.student_id.class_name || election.class_name || '',
                election_id: resolvedElectionId
              });
              console.log('[CANDIDATE] Auto-elected:', cand.student_id.name);
            }
          }
        }
      }
      
      // Return the full candidate with success flag
      const fullCandidate = await Candidate.findById(candidate._id)
        .populate('student_id')
        .lean()
        .exec();
      
      res.json({ 
        success: true, 
        candidate: fullCandidate,
        election_id: resolvedElectionId,
        message: 'Candidate added successfully'
      });
    } catch (error) {
      console.error('[CANDIDATE] Add error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/candidates/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    const classNameFilter = req.query.class_name ? req.query.class_name.trim().toLowerCase() : null;
    console.log('[CANDIDATES] Fetching candidates for election:', electionId);

    const election = await Election.findById(electionId).lean().exec();
    if (!election) {
      return res.status(404).json({ error: 'Election not found' });
    }
    
    let candidates = await Candidate.find({ election_id: electionId })
      .populate('student_id')
      .lean()
      .exec();

    if (election.election_type === 'class_level' && classNameFilter) {
      candidates = candidates.filter(c => c.student_id && (c.student_id.class_name || '').toLowerCase() === classNameFilter);
    }

    const nota_count = await Vote.countDocuments({
      election_id: electionId,
      vote_type: 'nota'
    }).exec();
    
    console.log('[CANDIDATES] Found candidates:', candidates.length, 'for election_id:', electionId);
    if (candidates.length === 0) {
      console.warn('[CANDIDATES] No candidates found for election_id:', electionId);
    } else {
      console.log('[CANDIDATES] Sample candidate:', {
        id: candidates[0]._id,
        election_id: candidates[0].election_id,
        student: candidates[0].student_id ? candidates[0].student_id.name : 'NOT POPULATED'
      });
    }
    
    res.json({ candidates, nota_count: nota_count || 0 });
  } catch (error) {
    console.error('[CANDIDATES] Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/vote/cast',
  body('voter_id').isString().notEmpty(),
  body('candidate_id').optional().isString().notEmpty(),
  body('election_id').isString().notEmpty(),
  body('is_nota').optional().isBoolean(),
  body('position').optional().isString(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const { voter_id, candidate_id, election_id, is_nota, position } = req.body;
      const isNotaVote = is_nota === true;
      
      // Get election to check type
      const election = await Election.findById(election_id).lean().exec();
      if (!election) {
        return res.status(404).json({ error: 'Election not found' });
      }

      if (!isNotaVote && !candidate_id) {
        return res.status(400).json({ error: 'candidate_id is required for candidate votes' });
      }

      if (isNotaVote && election.election_type !== 'class_level') {
        return res.status(400).json({ error: 'NOTA is available only for class-level election.' });
      }

      const existingVotes = await Vote.find({ voter_id, election_id }).lean().exec();
      const hasExistingNota = existingVotes.some(v => v.vote_type === 'nota');
      const candidateVoteCount = existingVotes.filter(v => v.vote_type !== 'nota').length;

      if (isNotaVote) {
        if (existingVotes.length > 0) {
          return res.status(400).json({ error: 'NOTA must be submitted without any other votes.' });
        }

        const vote = await Vote.create({
          voter_id,
          election_id,
          vote_type: 'nota',
          position: 'class_level_nota'
        });
        return res.json({ success: true, vote });
      }

      const candidate = await Candidate.findById(candidate_id).populate('student_id').lean().exec();
      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      if (String(candidate.election_id) !== String(election_id)) {
        return res.status(400).json({ error: 'Candidate does not belong to this election' });
      }

      if (election.election_type === 'class_level' && hasExistingNota) {
        return res.status(400).json({ error: 'You already submitted NOTA for this election.' });
      }

      // For class-level: exactly 2 candidate votes max
      if (election.election_type === 'class_level' && candidateVoteCount >= 2) {
        return res.status(400).json({ error: 'Maximum 2 votes allowed per election' });
      }

      if (election.election_type === 'class_level') {
        const voter = await Student.findById(voter_id).lean().exec();
        if (!voter) return res.status(404).json({ error: 'Voter not found' });

        const voterClass = (voter.class_name || '').toLowerCase();
        const candidateClass = (candidate.student_id?.class_name || '').toLowerCase();
        if (!candidateClass || voterClass !== candidateClass) {
          return res.status(403).json({ error: 'You can only vote for candidates from your own class.' });
        }
      }
      
      // For secondary-level: one vote per position
      if (election.election_type === 'secondary_level') {
        const rep = await ElectedRepresentative.findOne({ student_id: voter_id }).populate('election_id').lean().exec();
        if (!rep || !rep.election_id || rep.election_id.election_type !== 'class_level') {
          return res.status(403).json({ error: 'Only elected class representatives can vote in secondary election.' });
        }
        
        // Check if voter already voted for this position
        const existingVotesForPosition = await Vote.find({ 
          voter_id, 
          election_id 
        }).populate('candidate_id').lean().exec();
        
        const alreadyVotedForPosition = existingVotesForPosition.some(
          vote => vote.candidate_id && vote.candidate_id.position === candidate.position
        );
        
        if (alreadyVotedForPosition) {
          return res.status(400).json({ 
            error: `You have already voted for ${candidate.position}. Only one vote per position allowed.` 
          });
        }
      }

      const vote = await Vote.create({
        voter_id,
        candidate_id,
        election_id,
        vote_type: 'candidate',
        position: position || candidate.position || null
      });
      await Candidate.findByIdAndUpdate(candidate_id, { $inc: { vote_count: 1 } }).exec();
      res.json({ success: true, vote });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'Duplicate vote' });
      res.status(500).json({ error: error.message });
    }
  }
);

app.post('/api/vote/count', async (req, res) => {
  try {
    const { voter_id, election_id } = req.body;
    const votes = await Vote.find({ voter_id, election_id }).lean().exec();
    const vote_count = votes.length;
    const nota_count = votes.filter(v => v.vote_type === 'nota').length;
    const candidate_vote_count = vote_count - nota_count;
    const votes_by_position = {};

    for (const vote of votes) {
      if (vote.position) {
        votes_by_position[vote.position] = (votes_by_position[vote.position] || 0) + 1;
      }
    }

    res.json({
      vote_count: vote_count || 0,
      candidate_vote_count: candidate_vote_count || 0,
      nota_count: nota_count || 0,
      votes_by_position
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results/:electionId', async (req, res) => {
  try {
    const { electionId } = req.params;
    const results = await Candidate.find({ election_id: electionId }).populate('student_id').sort({ vote_count: -1 }).lean().exec();
    const nota_count = await Vote.countDocuments({ election_id: electionId, vote_type: 'nota' }).exec();
    res.json({ results, nota_count: nota_count || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results/class/all', async (req, res) => {
  try {
    const elections = await Election.find({ election_type: 'class_level', status: 'ended' }).lean().exec();
    const results = [];

    for (const election of elections) {
      const candidates = await Candidate.find({ election_id: election._id })
        .populate('student_id')
        .sort({ vote_count: -1 })
        .lean()
        .exec();

      if (!candidates.length) continue;

      const groupedByClass = {};
      for (const candidate of candidates) {
        const className = (candidate.student_id?.class_name || election.class_name || 'unknown').toLowerCase();
        if (!groupedByClass[className]) groupedByClass[className] = [];
        groupedByClass[className].push(candidate);
      }

      for (const className of Object.keys(groupedByClass)) {
        const nota_count = await Vote.countDocuments({ election_id: election._id, vote_type: 'nota' }).exec();
        results.push({
          election: {
            ...election,
            class_name: className
          },
          candidates: groupedByClass[className].sort((a, b) => b.vote_count - a.vote_count),
          nota_count: nota_count || 0
        });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/results/secondary/all', async (req, res) => {
  try {
    const elections = await Election.find({ election_type: 'secondary_level', status: 'ended' }).lean().exec();
    const results = [];
    for (const election of elections) {
      const candidates = await Candidate.find({ election_id: election._id })
        .populate('student_id')
        .sort({ position: 1, vote_count: -1 })
        .lean()
        .exec();
      const nota_count = await Vote.countDocuments({ election_id: election._id, vote_type: 'nota' }).exec();
      results.push({ election, candidates, nota_count: nota_count || 0 });
    }
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/verification/request',
  body('admission_no').isString().notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const { student_id, admission_no, tutor_id } = req.body;
      const normalizedAdmission = admission_no.trim().toLowerCase();
      
      console.log('[VERIFICATION] Creating request', { admission_no: normalizedAdmission });
      
      const request = await VerificationRequest.create({ 
        student_id, 
        admission_no: normalizedAdmission, 
        tutor_id, 
        status: 'pending' 
      });
      
      console.log('[VERIFICATION] Request created', { id: request._id, admission_no: normalizedAdmission });
      res.json({ success: true, request });
    } catch (error) {
      console.error('[VERIFICATION] Request creation error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/verification/pending', authenticateJWT, requireRole('super_admin'), async (req, res) => {
  try {
    console.log('[VERIFICATION] Fetching pending requests');
    const requests = await VerificationRequest.find({ status: 'pending' })
      .populate('student_id')
      .sort({ requested_at: -1 })
      .lean()
      .exec();
    
    console.log('[VERIFICATION] Found pending requests:', requests.length);
    res.json({ requests });
  } catch (error) {
    console.error('[VERIFICATION] Pending fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/verification/resolve', authenticateJWT, requireRole('super_admin'),
  body('request_id').isString().notEmpty(),
  body('status').isIn(['pending', 'approved', 'rejected']),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      const { request_id, status, resolved_by } = req.body;
      
      if (!request_id) {
        console.error('[VERIFICATION] Missing request_id in resolve');
        return res.status(400).json({ error: 'request_id is required' });
      }
      
      console.log('[VERIFICATION] Resolving request', { request_id, status });
      const request = await VerificationRequest.findByIdAndUpdate(
        request_id, 
        { status, resolved_by, resolved_at: new Date(), notified_to_tutor: false }, 
        { new: true }
      ).exec();
      
      if (!request) {
        console.error('[VERIFICATION] Request not found', { request_id });
        return res.status(404).json({ error: 'Verification request not found' });
      }
      
      console.log('[VERIFICATION] Request resolved successfully', { request_id, status });
      res.json({ success: true, request });
    } catch (error) {
      console.error('[VERIFICATION] Resolve error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/verification/status/:admission_no', async (req, res) => {
  try {
    const { admission_no } = req.params;
    const normalized = admission_no.trim().toLowerCase();
    
    console.log('[VERIFICATION] Checking status for', { admission_no: normalized });
    
    const approvedRequest = await VerificationRequest.findOne({ 
      admission_no: normalized, 
      status: 'approved' 
    }).lean().exec();
    
    if (approvedRequest) {
      console.log('[VERIFICATION] Found approved request', { admission_no: normalized });
      res.json({ approved: true, request: approvedRequest });
    } else {
      console.log('[VERIFICATION] No approved request found', { admission_no: normalized });
      res.json({ approved: false });
    }
  } catch (error) {
    console.error('[VERIFICATION] Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/verification/updates', authenticateJWT, requireRole('tutor_admin'), async (req, res) => {
  try {
    const tutorId = req.user._id;

    const updates = await VerificationRequest.find({
      tutor_id: tutorId,
      status: { $in: ['approved', 'rejected'] },
      notified_to_tutor: false
    })
      .populate('student_id')
      .sort({ resolved_at: -1 })
      .lean()
      .exec();

    if (updates.length > 0) {
      const ids = updates.map((item) => item._id);
      await VerificationRequest.updateMany(
        { _id: { $in: ids } },
        { $set: { notified_to_tutor: true } }
      ).exec();
    }

    res.json({ updates });
  } catch (error) {
    console.error('[VERIFICATION] updates fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/elected-representatives', async (req, res) => {
  try {
    // Get all representatives with election details
    const representatives = await ElectedRepresentative.find()
      .populate('student_id')
      .populate('election_id')
      .lean()
      .exec();
    
    // Filter to only include class_level representatives
    const classLevelReps = representatives.filter(rep => 
      rep.election_id && rep.election_id.election_type === 'class_level'
    );
    
    console.log('[ELECTED_REPS] Total reps:', representatives.length, 'Class level:', classLevelReps.length);
    res.json({ representatives: classLevelReps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/check-representative/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log('[CHECK_REP] Checking if student is representative:', studentId);
    
    const rep = await ElectedRepresentative.findOne({ student_id: studentId })
      .populate('election_id')
      .lean()
      .exec();
    
    if (rep && rep.election_id && rep.election_id.election_type === 'class_level') {
      console.log('[CHECK_REP] Student IS a class representative');
      res.json({ isRepresentative: true, representative: rep });
    } else {
      console.log('[CHECK_REP] Student is NOT a class representative');
      res.json({ isRepresentative: false });
    }
  } catch (error) {
    console.error('[CHECK_REP] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.post('/api/student/verify-face', 
  body('admission_no').isString().notEmpty(),
  body('face_image').optional().isString(),
  body('face_encoding').optional().isString(),
  async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed', details: errors.array() });

    const { admission_no, face_image, face_encoding, attempt = 1 } = req.body;
    const normalized = admission_no.trim().toLowerCase();

    console.log('[VERIFY] Request for admission:', normalized, 'attempt:', attempt);

    const student = await Student.findOne({ admission_no: normalized }).lean().exec();
    if (!student) {
      console.warn('[VERIFY] Student not found:', normalized);
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!student.face_encoding) {
      console.warn('[VERIFY] No face embedding stored for student:', normalized);
      return res.status(400).json({ error: 'No face embedding stored for this student' });
    }

    // Extract live face embedding
    let liveEmbedding;
    try {
      const incomingImage = face_image || face_encoding;
      if (!incomingImage) throw new Error('No face image provided');
      const buffer = Buffer.from(incomingImage.split(',')[1] || incomingImage, 'base64');
      liveEmbedding = await faceService.extractEmbeddingFromImageBuffer(buffer);
      
      if (!Array.isArray(liveEmbedding) || liveEmbedding.length !== 128) {
        throw new Error('Invalid embedding generated: expected 128-D array, got ' + (Array.isArray(liveEmbedding) ? liveEmbedding.length : typeof liveEmbedding));
      }
    } catch (err) {
      console.error('[VERIFY] Face extraction failed:', err.message);
      return res.status(400).json({ error: 'Failed to extract face from image: ' + err.message });
    }

    // Parse stored embedding
    const storedEmbedding = Array.isArray(student.face_encoding)
      ? student.face_encoding
      : (() => {
          try { return JSON.parse(student.face_encoding); } catch { return null; }
        })();
        
    if (!Array.isArray(storedEmbedding)) {
      console.error('[VERIFY] Stored embedding is invalid for student:', normalized);
      return res.status(400).json({ error: 'Stored face embedding is invalid' });
    }
    
    if (storedEmbedding.length !== 128) {
      console.error('[VERIFY] Stored embedding has wrong dimension:', storedEmbedding.length);
      return res.status(400).json({ error: 'Stored face embedding has invalid dimension' });
    }

    console.log('[VERIFY] Comparing embeddings for student:', normalized);
    const { match, distance } = faceService.compareEmbeddings(liveEmbedding, storedEmbedding, 0.6);

    if (match) {
      console.log('[VERIFY] SUCCESS - Face verified', { admission_no: normalized, distance: distance.toFixed(4) });
      res.json({ success: true, student, verified: true, distance });
    } else {
      const attemptNum = parseInt(attempt, 10) || 1;
      console.log('[VERIFY] FAILED - Face not matched', { admission_no: normalized, distance: distance.toFixed(4), attempt: attemptNum });
      
      if (attemptNum >= 3) {
        // Max attempts reached, create verification request for super admin
        const existingRequest = await VerificationRequest.findOne({
          admission_no: normalized,
          status: 'pending'
        }).lean().exec();
        
        if (!existingRequest) {
          await VerificationRequest.create({
            student_id: student._id,
            admission_no: normalized,
            tutor_id: student.tutor_id,
            status: 'pending'
          });
          console.log('[VERIFY] Created new verification request for super admin');
        } else {
          console.log('[VERIFY] Verification request already exists');
        }
        
        res.json({ success: false, verified: false, attempts_remaining: false, verification_request_created: true });
      } else {
        res.json({ success: false, verified: false, attempts_remaining: true, attempt: attemptNum, distance });
      }
    }
  } catch (error) {
    console.error('[VERIFY] Unexpected error:', error);
    res.status(500).json({ error: error.message });
  }
});

function calculateFaceSimilarity(encoding1, encoding2) {
  if (!encoding1 || !encoding2) return 0;
  return Math.random() > 0.3 ? 0.85 : 0.6;
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
