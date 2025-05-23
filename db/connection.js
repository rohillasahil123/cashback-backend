const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://cashback:cashback@cluster0.kj5h6eq.mongodb.net/", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log("Connected to MongoDB Atlas");
})
.catch((err) => {
  console.error("MongoDB connection error:", err.message);
});
