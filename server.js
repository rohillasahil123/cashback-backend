const mongoose = require("mongoose")
require("./db/connection.js")
const User = require("./models/User_model.js")
const UtrModel = require('./models/Utr_model.js');
const Product = require('./models/Add_Items.js');
const Withdrawal = require("./models/withdrawal_Model.js");
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


app.get('/api/get-account', async (req, res) => {
  try {
    const products = await UtrModel.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
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


app.post('/api/update-utr', async (req, res) => {
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

app.post('/api/withdraw', async (req, res) => {
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


app.get('/api/withdrawals', async (req, res) => {
  try {
    const allWithdrawals = await Withdrawal.find({});
    res.status(200).json(allWithdrawals);
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Example route to update withdrawal status
app.patch('/api/withdrawal/status', async (req, res) => {
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
app.post('/api/add-daily-earning', async (req, res) => {
  const { productId, amount } = req.body;

  try {
    // Step 1: Find the user who has this product inside purchasedProducts array
    const user = await User.findOne({ 'purchasedProducts._id': productId });

    if (!user) {
      return res.status(404).json({ message: 'Product not found in any user' });
    }

    // Step 2: Find the specific product inside purchasedProducts
    const product = user.purchasedProducts.id(productId);

    if (!product) {
      return res.status(404).json({ message: 'Product not found in user data' });
    }

    // Step 3: Update product fields
    product.earnedAmount = (product.earnedAmount || 0) + Number(amount);
    product.nextEarningAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // next 24 hrs

    // Step 4: Save the user document
    await user.save();

    res.json({ message: 'Earning added and timer reset' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
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



// add items 
app.post('/api/add-product', async (req, res) => {
  const { name, price, daily, time, level } = req.body;

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


app.get('/api/get-product', async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching products', error });
  }
});


// perchage Product 
app.post("/api/buy-product", async (req, res) => {
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


app.get('/api/purchase-product/:userId', async (req, res) => {
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





app.listen(5000, () => {
  console.log(`Server running on  5000`);
});


