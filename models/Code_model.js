// models/Code.js
const mongoose = require("mongoose");

const codeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  code: { type: String, required: true },
  amount: { type: Number, required: true },
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

module.exports = mongoose.model("Code", codeSchema);
