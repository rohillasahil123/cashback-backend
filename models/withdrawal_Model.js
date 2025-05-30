const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true
  },
  accountOrUpi: {
    type: String,
    required: true
  },
  ifscCode: String,
  status: {
    type: String,
    enum: ['pending', 'approved'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  }
});

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: 'User'
  },
  name: String,
  requests: [withdrawalRequestSchema]
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
