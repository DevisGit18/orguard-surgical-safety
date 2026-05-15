require('dotenv').config();
const mongoose = require('mongoose');
const Checklist = require('./models/Checklist');
const { evaluateRisk, computeComplianceScore } = require('./utils/riskEngine');

const procedures = [
  'Laparoscopic Cholecystectomy','Appendectomy','Caesarean Section',
  'Hip Replacement','Knee Arthroplasty','Coronary Artery Bypass Graft',
  'Colectomy','Thyroidectomy','Spinal Fusion','Robotic Prostatectomy',
  'Hernia Repair','Mastectomy','Bowel Resection','Aortic Valve Replacement',
  'Craniotomy'
];

const surgeons = [
  'Dr. Mehta','Dr. Krishnan','Dr. Sharma','Dr. Patel',
  'Dr. Nair','Dr. Rajan','Dr. Iyer','Dr. Suresh'
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function prob(p) { return Math.random() < p; }

// Based on BMJ paper distributions: ~51% global completeness, higher risk in complex cases
function generateChecklist(i) {
  const procedure = rand(procedures);
  const isRobotic = procedure.includes('Robotic') || prob(0.12);
  const isComplex = ['Craniotomy','CABG','Aortic Valve Replacement','Spinal Fusion'].some(p => procedure.includes(p));

  const patient_flags = {
    on_anticoagulants: prob(isComplex ? 0.4 : 0.15),
    known_allergies: prob(0.22),
    robotic_procedure: isRobotic,
    high_risk_anesthesia: prob(isComplex ? 0.5 : 0.1)
  };

  // Phase completion: reflects ~51% global completeness from PROSPERO meta-analysis
  // Sign-in most complete, sign-out most skipped
  const sign_in_done = prob(0.82);
  const time_out_done = sign_in_done ? prob(0.74) : prob(0.15);
  const sign_out_done = time_out_done ? prob(0.63) : prob(0.08);

  const phases = {
    sign_in: { completed: sign_in_done, timestamp: sign_in_done ? new Date(Date.now() - Math.random() * 30 * 86400000) : undefined },
    time_out: { completed: time_out_done, timestamp: time_out_done ? new Date(Date.now() - Math.random() * 29 * 86400000) : undefined },
    sign_out: { completed: sign_out_done, timestamp: sign_out_done ? new Date(Date.now() - Math.random() * 28 * 86400000) : undefined }
  };

  const risk_flags = evaluateRisk(patient_flags);
  const compliance_score = computeComplianceScore(phases);

  return {
    patient_id: `PT-${String(i + 3).padStart(3, '0')}`,
    surgeon: rand(surgeons),
    procedure,
    patient_flags,
    phases,
    instruments: [],
    risk_flags,
    compliance_score,
    created_at: new Date(Date.now() - Math.random() * 60 * 86400000)
  };
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await Checklist.countDocuments();
  console.log(`Existing records: ${existing}`);

  const records = Array.from({ length: 50 }, (_, i) => generateChecklist(i));
  await Checklist.insertMany(records);

  const total = await Checklist.countDocuments();
  console.log(`Seed complete. Total records: ${total}`);
  mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
