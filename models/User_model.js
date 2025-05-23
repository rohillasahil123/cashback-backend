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
  }
});

module.exports = mongoose.model("loginData", LoginSchema);
