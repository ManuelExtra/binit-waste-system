const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const requestSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User', // Relates to Users collection
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
      default: 'Pending',
    },
    pickupDate: {
      type: Date,
      required: true,
    },
    wasteType: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    coordinates: {
      lat: { type: String, required: true }, // Latitude
      lng: { type: String, required: true }, // Longitude
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // transactionId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'Transaction', // Relates to Transactions model
    //   // required: true,
    // },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Request', requestSchema);
