const mongoose = require('mongoose');

const instrumentSchema = new mongoose.Schema({
  name: String,
  count_before: Number,
  count_after: Number,
  status: { type: String, enum: ['matched', 'missing', 'unverified'], default: 'unverified' }
});

const checklistSchema = new mongoose.Schema({
  patient_id: { type: String, required: true },
  surgeon: { type: String, required: true },
  procedure: { type: String, required: true },
  patient_flags: {
    on_anticoagulants: { type: Boolean, default: false },
    known_allergies: { type: Boolean, default: false },
    robotic_procedure: { type: Boolean, default: false },
    high_risk_anesthesia: { type: Boolean, default: false }
  },
  phases: {
    sign_in: { completed: { type: Boolean, default: false }, timestamp: Date },
    time_out: { completed: { type: Boolean, default: false }, timestamp: Date },
    sign_out: { completed: { type: Boolean, default: false }, timestamp: Date }
  },
  instruments: [instrumentSchema],
  risk_flags: [String],
  compliance_score: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Checklist', checklistSchema);
