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
const Request = require('../models/Request');

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
router.get('/trucks', async (req, res) => {
  try {
    const trucks = await Truck.find();
    res.json(trucks);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Schedule Pickup (for users)
router.post('/schedule', auth, async (req, res) => {
  const { truckId, amount, pickupDate, wasteType, location, coordinates } =
    req.body;

  // Ensure location is a string
  if (typeof location !== 'string') {
    return res.status(400).json({ message: 'Invalid location format' });
  }

  try {
    const truck = await Truck.findById(truckId);
    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    const amount = truck.price;
    const wasteType = truck.wasteName;

    // Step 1: Create a new Request
    const newRequest = new Request({
      userId: req.user.id,
      pickupDate,
      location,
      wasteType,
      coordinates,
      status: 'Pending',
    });

    await newRequest.save();

    // Step 2: Create a new Transaction and link it to the Request
    const transaction = new Transaction({
      userId: req.user.id,
      truckId,
      amount,
      requestId: newRequest._id, // Linking transaction to request
    });

    await transaction.save();

    // Step 3: Update Request with transactionId
    newRequest.transactionId = transaction._id;
    await newRequest.save();

    res.status(201).json({
      message: 'Pickup scheduled successfully',
      request: newRequest,
      transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Manage Trucks
router.post('/admin/trucks', auth, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Access denied' });

  const { name, wasteName, price, location, coordinates } = req.body;
  try {
    const truck = new Truck({
      name,
      wasteName,
      price,
      location,
      coordinates,
    });
    await truck.save();
    res.status(201).json(truck);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a truck
router.put('/admin/trucks/:id', auth, async (req, res) => {
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
});

// Delete a truck
router.delete('/admin/trucks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Check if the truck is associated with a transaction
    const existingTransaction = await Transaction.findOne({ truckId: id });

    if (existingTransaction) {
      return res.status(400).json({
        message:
          'Cannot delete truck. It is associated with an existing transaction.',
      });
    }

    // Delete the truck if no transaction is linked
    const deletedTruck = await Truck.findByIdAndDelete(id);

    if (!deletedTruck) {
      return res.status(404).json({ message: 'Truck not found.' });
    }

    res.json({ message: 'Truck deleted successfully.' });
  } catch (error) {
    console.error('Error deleting truck:', error);
    res.status(500).json({ message: 'Server error. Please try again later.' });
  }
});

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
router.get('/admin/histories', auth, async (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Access denied' });

  try {
    // Fetch only transactions with status "completed"
    const histories = await Transaction.find({
      status: 'completed',
    }).populate('userId truckId');

    res.json(histories);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch total requests (trucks) and users
router.get('/stats', auth, async (req, res) => {
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
router.get('/latest-request', auth, async (req, res) => {
  try {
    const latestRequest = await Transaction.findOne() // Get the latest request
      .sort({ createdAt: -1 }) // Sort by newest first
      .populate('userId') // Populate all user details
      .populate('truckId') // Populate all truck details
      .populate('requestId'); // Populate all truck details

    if (!latestRequest) {
      return res.status(404).json({ message: 'No transactions found' });
    }

    res.json(latestRequest);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch transactions with pagination & filtering
router.get('/admin/transactions', auth, async (req, res) => {
  try {
    let { page = 1, limit = 10, status } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const query = status ? { status } : {}; // Optional filtering by status

    const transactions = await Transaction.find(query)
      .populate({
        path: 'truckId',
      })
      .sort({ createdAt: -1 }) // Latest transactions first
      .skip((page - 1) * limit)
      .limit(limit);

    const totalTransactions = await Transaction.countDocuments(query);

    res.status(200).json({
      success: true,
      totalPages: Math.ceil(totalTransactions / limit),
      currentPage: page,
      transactions,
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update transaction status to "Completed"
router.put('/admin/transactions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    // Find and update the transaction
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      id,
      { status: 'completed' },
      { new: true } // Return updated document
    );

    if (!updatedTransaction) {
      return res
        .status(404)
        .json({ success: false, message: 'Transaction not found' });
    }

    res.json({
      success: true,
      message: 'Transaction marked as completed',
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user details
router.put(
  '/update-profile',
  auth,
  [
    body('username').optional().trim().isLength({ min: 3 }),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').optional().isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { username, email, password } = req.body;
    const userId = req.user.id; // Assuming authMiddleware sets req.user

    try {
      let updatedData = {};
      if (username) updatedData.username = username;
      if (email) updatedData.email = email;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updatedData.password = await bcrypt.hash(password, salt);
      }

      const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
        new: true,
        select: '-password',
      });

      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      console.error('Update error:', error);
      res
        .status(500)
        .json({ success: false, message: 'Internal Server Error' });
    }
  }
);

// Logout Route
router.post('/auth/logout', (req, res) => {
  res.clearCookie('connect.sid'); // Clear session cookie
  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/auth/check', auth, (req, res) => {
  res.json({ authenticated: true });
});

module.exports = router;
