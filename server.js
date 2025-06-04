const mongoose = require("mongoose")
require("./db/connection.js")
const User = require("./models/User_model.js")
const UtrModel = require('./models/Utr_model.js');
const Product = require('./models/Add_Items.js');
const Withdrawal = require("./models/withdrawal_Model.js");
const Code = require("./models/Code_model.js")
const Event = require("./models/Event_Product.js")
const verifyToken = require("./auth/authantication.js")
const jwt = require("jsonwebtoken");
const express = require("express")
const bcrypt = require('bcrypt');
const secretKey = "cashback_website";
const cors = require('cors');




const app = express()

app.use(cors({
  origin: ['https://foodenergy.shop', 'https://www.foodenergy.shop'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json())

// Testing
app.get("/alert", (req, res) => {
  res.send("✅ API is working");
});



// Register 
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    let bonus = 0;
    let referralCodeMatched = false;

    if (referredBy) {
      const referrer = await User.findOne({ referralCode: referredBy });
      if (!referrer) {
        return res.status(400).json({ message: "Invalid referral code" });
      }

      referrer.wallet += 10;
      await referrer.save();

      bonus = 10;
      referralCodeMatched = true;  // Referral code valid mila hai
    }

    async function generateUniqueReferralCode() {
      let code;
      let exists = true;
      while (exists) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        exists = await User.findOne({ referralCode: code });
      }
      return code;
    }

    const newUser = new User({
      name,
      email,
      password,
      wallet: 10 + bonus,
      referralCode: await generateUniqueReferralCode(),
      referredBy: referredBy || null
    });

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully",
      referralCodeMatched,  // Yahan ye bhi bhej rahe hain
      user: {
        name: newUser.name,
        email: newUser.email,
        wallet: newUser.wallet,
        referralCode: newUser.referralCode,
        referredBy: newUser.referredBy
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Something went wrong", error });
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

    if (user.password !== password) {
      return res.status(400).send({ message: "Incorrect password" });
    }


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
app.post('/api/submit-utr', verifyToken, async (req, res) => {
  const { userId, utrNumber, amount, name } = req.body;

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
    name,
    status: 'pending',
  });
  await utrRecord.save();

  res.status(200).json({ message: 'UTR submitted successfully' });
});


app.get('/api/get-account', verifyToken, async (req, res) => {
  try {
    const products = await UtrModel.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
});



app.post('/api/approve-utr', verifyToken, async (req, res) => {
  const { utrNumber } = req.body;

  const utrRecord = await UtrModel.findOne({ utrNumber });

  if (!utrRecord) {
    return res.status(404).json({ message: 'UTR not found' });
  }

  if (utrRecord.status === 'approved') {
    return res.status(400).json({ message: 'UTR already approved' });
  }

  // Find user by userId in utrRecord
  const user = await User.findById(utrRecord.userId);
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


app.post('/api/update-utr', verifyToken, async (req, res) => {
  const { utrNumber, status } = req.body;

  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const utrRecord = await UtrModel.findOne({ utrNumber });
  if (!utrRecord) {
    return res.status(404).json({ message: "UTR not found" });
  }

  if (utrRecord.status === status) {
    return res.status(400).json({ message: `UTR already ${status}` });
  }

  // If approving, update user wallet
  if (status === "approved") {
    const user = await User.findById(utrRecord.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.wallet = (user.wallet || 0) + utrRecord.amount;
    await user.save();
  }

  // Update UTR status
  utrRecord.status = status;
  await utrRecord.save();

  res.status(200).json({ message: `UTR ${status} successfully` });
});

// widthrawal Api 

app.post('/api/withdraw', verifyToken, async (req, res) => {
  try {
    const { userId, name, amount, paymentMethod, accountOrUpi, ifscCode } = req.body;

    if (!userId || !name || !amount || !paymentMethod || !accountOrUpi) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // 🧾 Get user and check wallet balance
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.wallet < numericAmount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // 💸 Deduct from wallet
    user.wallet -= numericAmount;
    await user.save();

    const requestData = {
      amount: numericAmount,
      paymentMethod,
      accountOrUpi,
      ifscCode: paymentMethod === 'bank' ? ifscCode : null,
      status: 'pending'
    };

    let withdrawalDoc = await Withdrawal.findOne({ userId });

    if (withdrawalDoc) {
      withdrawalDoc.requests.push(requestData);
      await withdrawalDoc.save();
    } else {
      withdrawalDoc = new Withdrawal({
        userId,
        name,
        requests: [requestData]
      });
      await withdrawalDoc.save();
    }

    res.status(200).json({ message: 'Withdrawal request saved successfully' });

  } catch (err) {
    console.error('Withdrawal error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


app.get('/api/withdrawals', verifyToken, async (req, res) => {
  try {
    const allWithdrawals = await Withdrawal.find({});
    res.status(200).json(allWithdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/api/withdrawals/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    const userWithdrawals = await Withdrawal.find({ userId });
    res.status(200).json(userWithdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/api/withdrawals/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const withdrawal = await Withdrawal.findOne({ userId });

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'No withdrawals found for this user' });
    }

    res.status(200).json({
      success: true,
      name: withdrawal.name,
      requests: withdrawal.requests.reverse() // latest first
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});






// Example route to update withdrawal status
app.patch('/api/withdrawal/status', verifyToken, async (req, res) => {
  const { withdrawalId, requestIndex, newStatus } = req.body;

  try {
    const withdrawalDoc = await Withdrawal.findById(withdrawalId);
    if (!withdrawalDoc) return res.status(404).json({ message: 'Withdrawal not found' });

    // Update the specific request
    if (withdrawalDoc.requests[requestIndex]) {
      withdrawalDoc.requests[requestIndex].status = newStatus;
      await withdrawalDoc.save();
      return res.status(200).json({ message: 'Status updated successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid request index' });
    }
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Daily Earning
app.post('/api/add-daily-earning', verifyToken, async (req, res) => {
  const { userId, productId, amount } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const product = user.purchasedProducts.id(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found for this user' });
    }

    const amt = Number(amount);

    product.daily = String((parseFloat(product.daily) || 0) + amt); // assuming daily is string
    product.nextEarningAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // ✅ FIX: Correct field is `wallet`
    user.wallet = (user.wallet || 0) + amt;

    await user.save();

    res.json({
      message: 'Earning added, wallet updated',
      wallet: user.wallet
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});




app.get('/api/wallet/:userId', verifyToken, async (req, res) => {
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



// add items 
app.post('/api/add-product',  async (req, res) => {
  const { name, price, daily, time, level } = req.body;

  console.log(req.body)
  if (!name || !price || !daily || !time || !level) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newProduct = new Product({ name, price, daily, time, level });
    await newProduct.save();
    res.status(201).json({ message: 'Product added successfully', product: newProduct });
  } catch (error) {
    res.status(500).json({ message: 'Error adding product', error });
  }
});


app.get('/api/get-product', verifyToken, async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
});


// Event Product
app.post('/api/event-product',  async (req, res) => {
  const { name, price, daily, time, level } = req.body;

  console.log(req.body)
  if (!name || !price || !daily || !time || !level) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const newProduct = new Event({ name, price, daily, time, level });
    await newProduct.save();
    res.status(201).json({ message: 'Product added successfully', product: newProduct });
  } catch (error) {
    res.status(500).json({ message: 'Error adding product', error });
  }
});


app.get('/api/get-event',  async (req, res) => {
  try {
    const products = await Event.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
});






// perchage Product 
app.post("/api/buy-product", verifyToken, async (req, res) => {
  const { userId, name, level, price, daily, time } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.wallet < price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    const newProduct = {
      name,
      level,
      price,
      daily,
      time,
      purchasedAt: new Date(),
      nextEarningAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };

    user.wallet -= price;
    user.purchasedProducts.push(newProduct);

    await user.save();

    res.json({ message: "Product purchased", wallet: user.wallet });
  } catch (error) {
    res.status(500).json({ message: "Error purchasing product", error });
  }
});


app.get('/api/purchase-product/:userId', verifyToken, async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId).select('purchasedProducts');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ purchasedProducts: user.purchasedProducts });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});



// Code  genrate and verify
const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};


const generateRandomAmount = () => {
  return Math.floor(Math.random() * 6) + 2; // 2 to 7
};


// API Route
app.post("/api/generate-code", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: "UserId is required" });

  try {
    const code = generateRandomCode();
    const amount = generateRandomAmount();
    const newCode = new Code({ userId, code, amount });
    await newCode.save();
    res.status(201).json({ code, amount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error generating code" });
  }
});


// ✅ VERIFY CODE API
app.post("/api/verify-code", async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ message: "UserId and Code are required" });
  }

  try {
    const codeDoc = await Code.findOne({ code });

    if (!codeDoc) {
      return res.status(404).json({ valid: false, message: "Code not found" });
    }

    if (codeDoc.usedBy.includes(userId)) {
      return res.status(400).json({ valid: false, message: "You have already used this code" });
    }

    if (codeDoc.usedBy.length >= 4) {
      return res.status(400).json({ valid: false, message: "Code usage limit exceeded" });
    }

    codeDoc.usedBy.push(userId);
    await codeDoc.save();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ valid: false, message: "User not found" });
    }

    user.wallet += codeDoc.amount;
    await user.save();

    return res.status(200).json({
      valid: true,
      message: `₹${codeDoc.amount} added to your wallet`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ valid: false, message: "Server error" });
  }
});




app.listen(5000, '0.0.0.0', () => {
  console.log("Server running on port 5000");
});

