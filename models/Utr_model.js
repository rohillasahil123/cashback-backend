const mongoose = require('mongoose');

const utrSchema = new mongoose.Schema({
  utrNumber: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UtrTransaction', utrSchema);
