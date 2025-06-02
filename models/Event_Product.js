
const mongoose = require('mongoose');

const eventproductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  daily: Number,
  time: String,
  level: String,
});

module.exports = mongoose.model('event', eventproductSchema);
