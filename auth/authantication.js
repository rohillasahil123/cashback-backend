const jwt = require("jsonwebtoken");
const secretKey = "cashback_website";

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; 

  if (!token) {
    return res.status(401).send({ message: "Access Denied. No token provided." });
  }

  try {
    const verified = jwt.verify(token, secretKey);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send({ message: "Invalid token" });
  }
};

module.exports = verifyToken;
