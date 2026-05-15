const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const checklistRoutes = require('./routes/checklist');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.use('/api/checklists', checklistRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Surgical Safety Platform API running' });
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});