const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Truck = require('../models/Truck');
const Transaction = require('../models/Transaction');
const router = express.Router();
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

dotenv.config();

// User Signup
router.post(
  '/signup',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  async (req, res) => {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, role, location } = req.body;
    try {
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ message: 'User already exists' });

      user = new User({ name, email, password, role, location });
      await user.save();

      const payload = { id: user.id, role: user.role };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h',
      });

      res.status(201).json({ token });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// User Signin
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid credentials' });

    const payload = { id: user.id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch Trucks (for users)
router.get(
  '/trucks',
  //  auth,
  async (req, res) => {
    try {
      const trucks = await Truck.find();
      res.json(trucks);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Schedule Pickup (for users)
router.post('/schedule', auth, async (req, res) => {
  console.log(req.user);

  const { truckId, amount } = req.body;
  try {
    const transaction = new Transaction({
      userId: req.user.id,
      truckId,
      amount,
    });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    console.log(err);

    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Manage Trucks
router.post('/admin/trucks', auth, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Access denied' });

  const { name, wasteName, price, location } = req.body;
  try {
    const truck = new Truck({ name, wasteName, price, location });
    await truck.save();
    res.status(201).json(truck);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a truck
router.put(
  '/admin/trucks/:id',
  // auth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedTruck = await Truck.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      if (!updatedTruck) {
        return res.status(404).json({ message: 'Truck not found' });
      }

      res.json(updatedTruck);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get a specific truck by ID
router.get('/admin/trucks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate that the ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid truck ID' });
    }

    const truck = await Truck.findById(id); // Corrected query

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    res.json(truck);
  } catch (err) {
    console.error('Error fetching truck:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Fetch Histories
router.get(
  '/admin/histories',
  // auth,
  async (req, res) => {
    // if (req.user.role !== 'admin')
    //   return res.status(403).json({ message: 'Access denied' });

    try {
      // Fetch only transactions with status "completed"
      const histories = await Transaction.find({
        status: 'completed',
      }).populate('userId truckId');

      res.json(histories);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Fetch total requests (trucks) and users
router.get('/stats', async (req, res) => {
  try {
    const totalRequests = await Truck.countDocuments();
    const totalUsers = await User.countDocuments();

    const totalAmountProcessed = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]);

    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 }) // Sort by latest first
      .limit(10) // Limit to 10 transactions
      .populate('userId', '') // Populate all fields of userId
      .populate('truckId', ''); // Populate all fields of truckId

    // Calculate total revenue from completed transactions
    const totalRevenueResult = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } },
    ]);
    const totalRevenue =
      totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;

    // Aggregate total waste in from pending transactions
    const wasteInStats = await Transaction.aggregate([
      { $match: { status: 'pending' } }, // Consider only pending transactions for waste in
      {
        $group: {
          _id: { dayOfWeek: { $dayOfWeek: '$createdAt' } },
          totalWasteIn: { $sum: '$wasteIn' },
        },
      },
    ]);

    // Aggregate total waste out from completed transactions
    const wasteOutStats = await Transaction.aggregate([
      { $match: { status: 'completed' } }, // Consider only completed transactions for waste out
      {
        $group: {
          _id: { dayOfWeek: { $dayOfWeek: '$createdAt' } },
          totalWasteOut: { $sum: '$wasteOut' },
        },
      },
    ]);

    // Map MongoDB's dayOfWeek (1 = Sunday, 7 = Saturday) to readable names
    const weekDays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    const formattedWasteStats = Array(7)
      .fill({ totalWasteIn: 0, totalWasteOut: 0 })
      .map((_, index) => {
        const inData = wasteInStats.find(
          (item) => item._id.dayOfWeek === index + 1
        );
        const outData = wasteOutStats.find(
          (item) => item._id.dayOfWeek === index + 1
        );

        return {
          day: weekDays[index],
          totalWasteIn: inData ? inData.totalWasteIn : 0,
          totalWasteOut: outData ? outData.totalWasteOut : 0,
        };
      });

    res.json({
      totalRequests,
      totalUsers,
      recentTransactions,
      wasteStats: formattedWasteStats,
      totalRevenue,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch latest request
router.get('/latest-request', async (req, res) => {
  try {
    const latestRequest = await Transaction.findOne() // Get the latest request
      .sort({ createdAt: -1 }) // Sort by newest first
      .populate('userId') // Populate all user details
      .populate('truckId'); // Populate all truck details

    if (!latestRequest) {
      return res.status(404).json({ message: 'No transactions found' });
    }

    res.json(latestRequest);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
