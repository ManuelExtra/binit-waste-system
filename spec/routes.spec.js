const request = require('supertest');
const app = require('../app'); // Assuming your Express app is exported from app.js
const User = require('../models/User');
const Truck = require('../models/Truck');
const Transaction = require('../models/Transaction');
const Request = require('../models/Request');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Add at top of test file
const { addMatchers } = require('jasmine-expect');
// addMatchers();

describe('API Routes', () => {
  let testUser;
  let testAdmin;
  let testTruck;
  let userToken;
  let adminToken;
  let testTransaction;

  const BASE_PATH = '/api'; // Add this constant

  beforeAll(async () => {
    // Connect to a test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI_TEST, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // Create test users
    testUser = new User({
      name: 'Test User',
      email: 'user@test.com',
      password: 'test123',
      role: 'user',
      location: 'Test Location',
    });
    await testUser.save();

    testAdmin = new User({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'admin123',
      role: 'admin',
      location: 'Admin Location',
    });
    await testAdmin.save();

    // Generate tokens
    userToken = jwt.sign(
      { id: testUser._id, role: testUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    adminToken = jwt.sign(
      { id: testAdmin._id, role: testAdmin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test truck
    testTruck = new Truck({
      name: 'Test Truck',
      wasteName: 'General Waste',
      price: 100,
      location: 'Test Location',
      coordinates: { lat: 0, lng: 0 },
    });
    await testTruck.save();

    // Create test transaction
    testTransaction = new Transaction({
      userId: testUser._id,
      truckId: testTruck._id,
      amount: 100,
      status: 'pending',
    });
    await testTransaction.save();
  });

  afterAll(async () => {
    // Clean up test database
    await User.deleteMany({});
    await Truck.deleteMany({});
    await Transaction.deleteMany({});
    await Request.deleteMany({});
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('Authentication', () => {
    it('should sign up a new user', async () => {
      const response = await request(app).post(`${BASE_PATH}/signup`).send({
        name: 'New User',
        email: 'new@test.com',
        password: 'newpass123',
        role: 'user',
        location: 'New Location',
      });

      expect(response.statusCode).toBe(201);
      // expect(response.body).toHaveProperty('token', jasmine.any(String));
    });

    it('should reject signup with invalid email', async () => {
      const response = await request(app).post(`${BASE_PATH}/signup`).send({
        name: 'Invalid User',
        email: 'invalid-email',
        password: 'test123',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should sign in an existing user', async () => {
      const response = await request(app).post(`${BASE_PATH}/signin`).send({
        email: 'user@test.com',
        password: 'test123',
      });

      expect(response.statusCode).toBe(200);
      // expect(response.body).toHaveProperty('token', jasmine.any(String));
    });

    it('should reject signin with wrong credentials', async () => {
      const response = await request(app).post(`${BASE_PATH}/signin`).send({
        email: 'user@test.com',
        password: 'wrongpassword',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('Truck Operations', () => {
    it('should fetch all trucks', async () => {
      const response = await request(app).get(`${BASE_PATH}/trucks`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow admin to create a truck', async () => {
      const response = await request(app)
        .post(`${BASE_PATH}/admin/trucks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Truck',
          wasteName: 'Hazardous Waste',
          price: 200,
          location: 'Admin Location',
          coordinates: { lat: 1, lng: 1 },
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('Admin Truck');
    });

    it('should prevent non-admin from creating trucks', async () => {
      const response = await request(app)
        .post(`${BASE_PATH}/admin/trucks`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'User Truck',
          wasteName: 'General Waste',
          price: 50,
          location: 'User Location',
        });

      expect(response.statusCode).toBe(403);
    });

    it('should update a truck', async () => {
      const response = await request(app)
        .put(`${BASE_PATH}/admin/trucks/${testTruck._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          price: 150,
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.price).toBe(150);
    });

    it('should get a specific truck by ID', async () => {
      const response = await request(app).get(
        `${BASE_PATH}/admin/trucks/${testTruck._id}`
      );

      expect(response.statusCode).toBe(200);
      expect(response.body._id).toBe(testTruck._id.toString());
    });

    it('should delete a truck', async () => {
      // Create a truck that can be deleted (not associated with transactions)
      const tempTruck = new Truck({
        name: 'Temp Truck',
        wasteName: 'Temp Waste',
        price: 50,
        location: 'Temp Location',
      });
      await tempTruck.save();

      const response = await request(app)
        .delete(`${BASE_PATH}/admin/trucks/${tempTruck._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.message).toBe('Truck deleted successfully.');
    });
  });

  describe('Transaction Operations', () => {
    it('should schedule a pickup', async () => {
      const response = await request(app)
        .post(`${BASE_PATH}/schedule`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          truckId: testTruck._id,
          pickupDate: new Date(),
          wasteType: 'General Waste',
          location: 'Test Location',
          coordinates: { lat: 0, lng: 0 },
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.message).toBe('Pickup scheduled successfully');
    });

    it('should fetch transaction stats', async () => {
      const response = await request(app)
        .get(`${BASE_PATH}/stats`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      // expect(response.body).toHaveProperty(
      //   'totalRequests',
      //   jasmine.any(Number)
      // );
      // expect(response.body).toHaveProperty('totalUsers', jasmine.any(Number));
      // expect(response.body).toHaveProperty('totalRevenue', jasmine.any(Number));
    });

    it('should fetch latest request', async () => {
      const response = await request(app)
        .get(`${BASE_PATH}/latest-request`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      // expect(response.body).toHaveProperty('userId', jasmine.any(String));
    });

    it('should fetch transactions with pagination', async () => {
      const response = await request(app)
        .get(`${BASE_PATH}/admin/transactions?page=1&limit=10`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      // expect(response.body).toHaveProperty('transactions', jasmine.any(Array));
      // expect(response.body).toHaveProperty('totalPages', jasmine.any(Number));
    });

    it('should complete a transaction', async () => {
      const response = await request(app)
        .put(`${BASE_PATH}/admin/transactions/${testTransaction._id}/complete`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.transaction.status).toBe('completed');
    });
  });

  describe('User Profile Operations', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put(`${BASE_PATH}/update-profile`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'Updated User',
          email: 'updated@test.com',
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.user.email).toBe('updated@test.com');
    });

    it('should validate profile update data', async () => {
      const response = await request(app)
        .put(`${BASE_PATH}/update-profile`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'invalid-email',
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should check authentication status', async () => {
      const response = await request(app)
        .get(`${BASE_PATH}/auth/check`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.authenticated).toBe(true);
    });

    it('should logout user', async () => {
      const response = await request(app)
        .post(`${BASE_PATH}/auth/logout`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
