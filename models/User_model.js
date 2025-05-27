// models/User.js
const mongoose = require("mongoose");

const LoginSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true,
    required: true
  },
  password: String,
  wallet: {
    type: Number,
    default: 10
  },
  purchasedProducts: [
    {
      name: String,
      level: String,
      price: Number,
      daily: String,
      time: String,
      purchasedAt: {
        type: Date,
        default: Date.now
      },
      nextEarningAt: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) 
      }
    }
  ]
});

module.exports = mongoose.model("loginData", LoginSchema);
