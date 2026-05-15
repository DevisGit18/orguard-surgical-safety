function evaluateRisk(patient_flags) {
  const flags = [];

  if (patient_flags.on_anticoagulants && patient_flags.robotic_procedure) {
    flags.push('HIGH RISK: Anticoagulant use with robotic procedure — bleeding risk elevated');
  }
  if (patient_flags.high_risk_anesthesia && patient_flags.known_allergies) {
    flags.push('HIGH RISK: Known allergies with high-risk anesthesia — verify allergy profile');
  }
  if (patient_flags.robotic_procedure && patient_flags.high_risk_anesthesia) {
    flags.push('CAUTION: Robotic procedure with high-risk anesthesia — extended OR time likely');
  }
  if (patient_flags.on_anticoagulants && patient_flags.known_allergies) {
    flags.push('CAUTION: Anticoagulants with known allergies — review medication interactions');
  }

  return flags;
}

function computeComplianceScore(phases) {
  const completed = [phases.sign_in, phases.time_out, phases.sign_out]
    .filter(p => p.completed).length;
  return Math.round((completed / 3) * 100);
}

module.exports = { evaluateRisk, computeComplianceScore };