// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  price: Number,
  daily: Number,
  time: String,
  level: String,
});

module.exports = mongoose.model('Product', productSchema);
