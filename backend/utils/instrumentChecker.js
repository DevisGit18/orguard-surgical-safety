function checkInstruments(instruments) {
  const flags = [];
  let missingCount = 0;

  instruments.forEach(inst => {
    if (inst.count_after === 0 && inst.count_before > 0) {
      inst.status = 'unverified';
    } else if (inst.count_before !== inst.count_after) {
      inst.status = 'missing';
      missingCount++;
      flags.push(`MISSING: ${inst.name} — before: ${inst.count_before}, after: ${inst.count_after}`);
    } else {
      inst.status = 'matched';
    }
  });

  return { instruments, flags, missingCount };
}

module.exports = { checkInstruments };