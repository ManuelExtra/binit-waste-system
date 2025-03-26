const mongoose = require('mongoose');

const truckSchema = new mongoose.Schema({
  name: { type: String, required: true },
  wasteName: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true, default: 0 }, // Latitude
    lng: { type: Number, required: true, default: 0 }, // Longitude
  },
});

module.exports = mongoose.model('Truck', truckSchema);
