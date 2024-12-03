// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/asin_manager');

// User Schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isApproved: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false }
});

// ASIN Schema
const asinSchema = new mongoose.Schema({
  asin: { type: String, required: true, unique: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date
});

const User = mongoose.model('User', userSchema);
const ASIN = mongoose.model('ASIN', asinSchema);

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, 'your_jwt_secret');
    const user = await User.findOne({ _id: decoded._id });
    
    if (!user || !user.isApproved) {
      throw new Error();
    }
    
    req.user = user;
    next();
  } catch (e) {
    res.status(401).send({ error: 'Authentication failed' });
  }
};

// Register endpoint
app.post('/register', async (req, res) => {
  try {
    const user = new User({
      email: req.body.email,
      password: await bcrypt.hash(req.body.password, 8)
    });
    await user.save();
    res.status(201).send({ message: 'Registration successful. Waiting for admin approval.' });
  } catch (error) {
    res.status(400).send(error);
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user || !user.isApproved) {
      throw new Error('Invalid login');
    }
    
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      throw new Error('Invalid login');
    }
    
    const token = jwt.sign({ _id: user._id }, 'your_jwt_secret');
    res.send({ token, isAdmin: user.isAdmin });
  } catch (error) {
    res.status(400).send({ error: 'Login failed' });
  }
});

// Admin endpoints
app.get('/admin/pending-users', auth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).send();
  const pendingUsers = await User.find({ isApproved: false });
  res.send(pendingUsers);
});

app.post('/admin/approve-user/:id', auth, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).send();
  await User.findByIdAndUpdate(req.params.id, { isApproved: true });
  res.send({ message: 'User approved' });
});

// ASIN management endpoints
app.post('/asins/bulk', auth, async (req, res) => {
  try {
    const asins = req.body.asins.map(asin => ({
      asin: asin,
      status: 'pending'
    }));
    await ASIN.insertMany(asins);
    res.status(201).send();
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get('/asins/pending', auth, async (req, res) => {
  const asins = await ASIN.find({ status: 'pending' });
  res.send(asins);
});

app.post('/asins/:id/review', auth, async (req, res) => {
  try {
    const asin = await ASIN.findByIdAndUpdate(req.params.id, {
      status: req.body.status,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    }, { new: true });
    res.send(asin);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get('/asins/stats', auth, async (req, res) => {
  const stats = await ASIN.aggregate([
    {
      $group: {
        _id: '$reviewedBy',
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    }
  ]);
  res.send(stats);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
