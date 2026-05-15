const express = require('express');
const router = express.Router();
const Checklist = require('../models/Checklist');
const { evaluateRisk, computeComplianceScore } = require('../utils/riskEngine');
const { checkInstruments } = require('../utils/instrumentChecker');

// CREATE
router.post('/', async (req, res) => {
  try {
    const { patient_id, surgeon, procedure, patient_flags, instruments } = req.body;
    const risk_flags = evaluateRisk(patient_flags || {});
    const { instruments: checkedInstruments, flags: instrumentFlags } = checkInstruments(instruments || []);
    const checklist = new Checklist({
      patient_id, surgeon, procedure, patient_flags,
      instruments: checkedInstruments,
      risk_flags: [...risk_flags, ...instrumentFlags]
    });
    await checklist.save();
    res.status(201).json(checklist);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// GET ALL with filter + pagination
router.get('/', async (req, res) => {
  try {
    const { surgeon, risk, procedure, search, page = 1, limit = 10 } = req.query;
    const query = {};
    if (surgeon) query.surgeon = surgeon;
    if (procedure) query.procedure = { $regex: procedure, $options: 'i' };
    if (risk === 'flagged') query['risk_flags.0'] = { $exists: true };
    if (risk === 'clean') query.risk_flags = { $size: 0 };
    if (risk === 'high') query.risk_flags = { $elemMatch: { $regex: '^HIGH' } };
    if (search) query.$or = [
      { patient_id: { $regex: search, $options: 'i' } },
      { procedure: { $regex: search, $options: 'i' } },
      { surgeon: { $regex: search, $options: 'i' } }
    ];
    const total = await Checklist.countDocuments(query);
    const checklists = await Checklist.find(query)
      .sort({ created_at: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ checklists, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/summary', async (req, res) => {
  try {
    const summary = await Checklist.aggregate([{
      $group: {
        _id: null,
        total_surgeries: { $sum: 1 },
        avg_compliance: { $avg: '$compliance_score' },
        full_compliance: { $sum: { $cond: [{ $eq: ['$compliance_score', 100] }, 1, 0] } },
        flagged_cases: { $sum: { $cond: [{ $gt: [{ $size: '$risk_flags' }, 0] }, 1, 0] } }
      }
    }]);
    res.json(summary[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/trend', async (req, res) => {
  try {
    const from = new Date(Date.now() - 30 * 86400000);
    const trend = await Checklist.aggregate([
      { $match: { created_at: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          avg_compliance: { $avg: '$compliance_score' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(trend);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/by-procedure', async (req, res) => {
  try {
    const data = await Checklist.aggregate([
      { $group: { _id: '$procedure', avg_compliance: { $avg: '$compliance_score' }, count: { $sum: 1 } } },
      { $sort: { avg_compliance: -1 } },
      { $limit: 10 }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/phases', async (req, res) => {
  try {
    const total = await Checklist.countDocuments();
    if (!total) return res.json({ total: 0, sign_in: 0, time_out: 0, sign_out: 0 });
    const signIn = await Checklist.countDocuments({ 'phases.sign_in.completed': true });
    const timeOut = await Checklist.countDocuments({ 'phases.time_out.completed': true });
    const signOut = await Checklist.countDocuments({ 'phases.sign_out.completed': true });
    res.json({
      total,
      sign_in: Math.round(signIn / total * 100),
      time_out: Math.round(timeOut / total * 100),
      sign_out: Math.round(signOut / total * 100)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/analytics/distribution', async (req, res) => {
  try {
    const dist = await Checklist.aggregate([
      { $group: { _id: '$compliance_score', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    const buckets = { 0: 0, 33: 0, 67: 0, 100: 0 };
    dist.forEach(d => {
      const nearest = [0, 33, 67, 100].reduce((a, b) => Math.abs(b - d._id) < Math.abs(a - d._id) ? b : a);
      buckets[nearest] += d.count;
    });
    res.json(buckets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/meta/surgeons', async (req, res) => {
  try {
    const surgeons = await Checklist.distinct('surgeon');
    res.json(surgeons.sort());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const checklist = await Checklist.findById(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'Not found' });
    res.json(checklist);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/phase', async (req, res) => {
  try {
    const { phase } = req.body;
    const checklist = await Checklist.findById(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'Not found' });
    checklist.phases[phase].completed = true;
    checklist.phases[phase].timestamp = new Date();
    checklist.compliance_score = computeComplianceScore(checklist.phases);
    await checklist.save();
    res.json(checklist);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/:id/instruments', async (req, res) => {
  try {
    const { name, count_before, count_after } = req.body;
    const checklist = await Checklist.findById(req.params.id);
    if (!checklist) return res.status(404).json({ error: 'Not found' });
    checklist.instruments.push({ name, count_before: parseInt(count_before), count_after: parseInt(count_after) });
    const { instruments: checked, flags } = checkInstruments(checklist.instruments);
    checklist.instruments = checked;
    const nonInstFlags = checklist.risk_flags.filter(f => !f.startsWith('MISSING'));
    checklist.risk_flags = [...nonInstFlags, ...flags];
    await checklist.save();
    res.json(checklist);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await Checklist.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
