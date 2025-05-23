const mongoose = require("mongoose")
require("./db/connection.js")
const User = require("./models/User_model.js")
const UtrTransaction = require('./models/Utr_model.js');

const jwt = require("jsonwebtoken");
const express = require("express")
const bcrypt = require('bcrypt');
const secretKey = "cashback_website";
const cors = require("cors")


const app = express()
app.use(express.json())
app.use(cors())


// Testing
app.get("/alert", (req, res) => {
  res.send("✅ API is working");
});



// Register 

app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });


    const hashedPassword = await bcrypt.hash(password, 10);


    const newUser = new User({
      name,
      email,
      password: hashedPassword

    });

    await newUser.save();

    res.status(201).json({
      message: 'success',
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        wallet: newUser.wallet
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



// login


app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send({ message: "Email not found" });
    }

    // ✅ Compare hashed password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ message: "Incorrect password" });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      secretKey,
      { expiresIn: "24h" }
    );

    res.status(200).send({
      message: "Login success",
      token,
      user: {
        _id: user._id,
        email: user.email,
        wallet: user.wallet
      }
    });
  } catch (error) {
    res.status(500).send({ message: "Server error", error });
  }
});



// Wallet  Add and Widral Amount


app.post('/api/submit-utr', async (req, res) => {
  const { userId, utrNumber, amount } = req.body;

  // Check if UTR already submitted
  const existingUtr = await UtrModel.findOne({ utrNumber });
  if (existingUtr) {
    return res.status(400).json({ message: 'UTR already submitted' });
  }

  // Save new UTR with status pending
  const utrRecord = new UtrModel({
    userId,
    utrNumber,
    amount,
    status: 'pending',
  });
  await utrRecord.save();

  res.status(200).json({ message: 'UTR submitted successfully' });
});



app.post('/api/approve-utr', async (req, res) => {
  const { utrNumber } = req.body;

  const utrRecord = await UtrModel.findOne({ utrNumber });

  if (!utrRecord) {
    return res.status(404).json({ message: 'UTR not found' });
  }

  if (utrRecord.status === 'approved') {
    return res.status(400).json({ message: 'UTR already approved' });
  }

  // Find user by userId in utrRecord
  const user = await UserModel.findById(utrRecord.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Add amount to user's wallet
  user.wallet = (user.wallet || 0) + utrRecord.amount;
  await user.save();

  // Update UTR status to approved
  utrRecord.status = 'approved';
  await utrRecord.save();

  res.status(200).json({ message: 'UTR approved and wallet updated' });
});



app.get('/api/wallet/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("Requested userId:", userId);

    const user = await User.findById(userId).select('wallet');
    console.log("Found user:", user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ wallet: user.wallet });
  } catch (error) {
    console.error("Error in wallet API:", error);
    res.status(500).json({ message: 'Server error', error });
  }
});








app.listen(5000, () => {
  console.log(`Server running on  5000`);
});


