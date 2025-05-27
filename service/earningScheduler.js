// earningScheduler.js
const cron = require('node-cron');
const User = require('../models/User_model');

cron.schedule('* * * * *', async () => {
  const now = new Date();

  const users = await User.find({
    'purchasedProducts.nextEarningAt': { $lte: now }
  });

  for (const user of users) {
    let updated = false;

    user.purchasedProducts.forEach((product) => {
      if (product.nextEarningAt <= now) {
        user.wallet += parseInt(product.daily); // Add daily to wallet
        product.nextEarningAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // next 24h
        updated = true;
      }
    });

    if (updated) {
      await user.save();
      console.log(`Credited wallet for ${user.email}`);
    }
  }
});
