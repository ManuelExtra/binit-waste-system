const users = [];
const express = require('express');
const app = express();
const path = require('path');
const PORT = 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Parse incoming request bodies
app.use(express.urlencoded({ extended: true }));

// Route for the homepage
app.get('/', (req, res) => {
  const data = {
    title: 'Welcome to Binit',
    description: 'A simple booking and waste management platform.',
    page: 'home',
  };
  res.render('', data);
});

app.get('/about-us', (req, res) => {
  res.render('about-us', { page: 'about-us' });
});

app.get('/services', (req, res) => {
  res.render('services', { page: 'services' });
});

app.get('/pricing', (req, res) => {
  res.render('pricing', { page: 'pricing' });
});

app.get('/contact', (req, res) => {
  res.render('contact', { page: 'contact' });
});

// Route for Sign-In page
app.get('/signin', (req, res) => {
  res.render('signin', {
    page: 'signin',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Sign-Up page
app.get('/signup', (req, res) => {
  res.render('signup', {
    page: 'signup',
    errors: {},
    fullname: '',
    email: '',
    phone: '',
    address: '',
    province: '',
    password: '',
    confirmPassword: '',
  });
});

// Route for Admin Sign-In page
app.get('/admin-signin', (req, res) => {
  res.render('admin-signin', {
    page: 'admin-signin',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Admin Landing page
app.get('/admin/landing', (req, res) => {
  res.render('admin/index', {
    page: 'admin/landing',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Admin Requests page
app.get('/admin/requests', (req, res) => {
  res.render('admin/requests', {
    page: 'admin/requests',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Admin History page
app.get('/admin/history', (req, res) => {
  res.render('admin/history', {
    page: 'admin/history',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Admin Transactions page
app.get('/admin/transactions', (req, res) => {
  res.render('admin/transactions', {
    page: 'admin/transactions',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Admin Trucks page
app.get('/admin/trucks', (req, res) => {
  res.render('admin/trucks', {
    page: 'admin/trucks',
    errors: {},
    username: '',
    password: '',
  });
});

// Route for Admin Settings page
app.get('/admin/settings', (req, res) => {
  res.render('admin/settings', {
    page: 'admin/settings',
    errors: {},
    username: '',
    password: '',
  });
});

// Handle Sign-In POST request
app.post('/signin', (req, res) => {
  const { username, password } = req.body;
  let errors = {};

  if (!username || username.trim() === '') {
    errors.username = 'Username is required.';
  }

  if (!password || password.trim() === '') {
    errors.password = 'Password is required.';
  }

  if (Object.keys(errors).length > 0) {
    return res.render('signin', { errors, username, password });
  }

  // Simulate user authentication (replace with actual logic)
  if (username === 'test' && password === '1234') {
    res.redirect('/profile');
  } else {
    errors.general = 'Invalid credentials.';
    res.render('signin', { errors, username, password });
  }
});

function signup(req, res) {
  const {
    fullname,
    email,
    phone,
    address,
    province,
    password,
    confirmPassword,
  } = req.body;
  let errors = {};
  console.log('password', password);
  console.log('confirmPassword', confirmPassword);

  // Email pattern (simplified for this example)
  let emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;
  let phonePattern = /^[0-9]{10}$/;

  if (!fullname || fullname.trim() === '') {
    errors.fullname = 'Full name is required.';
  }

  if (!email || !emailPattern.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!phone || !phonePattern.test(phone)) {
    errors.phone = 'Enter a valid 10-digit phone number.';
  }

  if (!address || address.trim() === '') {
    errors.address = 'Address is required.';
  }

  if (!province || province.trim() === '') {
    errors.province = 'Please select a province.';
  }

  if (!password || password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  // If there are errors, re-render the signup page with the errors and form values
  if (Object.keys(errors).length > 0) {
    return res.render('signup', {
      errors,
      fullname,
      email,
      phone,
      address,
      province,
      password,
      confirmPassword,
    });
  }

  // Simulate saving user data (you can save it to a database here)
  let newuser = {
    fullname,
    email,
    phone,
    address,
    province,
    password,
    confirmPassword,
  };
  const existingUser = users.find((user) => user.email == newuser.email);

  if (!existingUser) {
    console.log('New User Signed Up:', newuser);
    users.push(newuser);
    return newuser;
    // res.redirect('/');
  }
}
// Handle Sign-Up POST request
app.post('/signup', signup);

// faq route
app.get('/faq', (req, res) => {
  const data = {
    pageTitle: 'Frequently Asked Questions', // Pass pageTitle here
    logoImagePath: 'path/to/your/logo.png', // Assuming you have this variable as well
    contactDetails: {
      address: '123 Street, City',
      phone: '+1234567890',
      email: 'contact@binit.com',
    },
    paymentIcons: ['path/to/icon1.png', 'path/to/icon2.png'], // Example payment icons
    userIconPath: 'path/to/default/user-icon.png',
  };
  res.render('faq', data); // Pass the data to faq.ejs
});

// Route for the User's Profile (example page)
app.get('/profile', (req, res) => {
  res.render('profile'); // Assuming you have a 'profile.ejs' template
});

// Trash Pickup Request Route (optional for other routes)
app.post('/trash-pickup', (req, res) => {
  const { address, postalCode, trashType, province } = req.body;
  let errors = {};

  if (!address || address.trim() === '') {
    errors.address = 'Address is required.';
  }

  if (!postalCode || postalCode.trim() === '') {
    errors.postalCode = 'Postal Code is required.';
  }

  if (!trashType || trashType.trim() === '') {
    errors.trashType = 'Trash Type is required.';
  }

  if (!province || province.trim() === '') {
    errors.province = 'Province is required.';
  }

  if (Object.keys(errors).length > 0) {
    return res.render('trashPickup', {
      errors,
      address,
      postalCode,
      trashType,
      province,
    });
  }

  let pickupRequest = {
    address,
    postalCode,
    trashType,
    province,
    requestDate: new Date().toLocaleString(),
  };
  console.log('Trash Pickup Request:', pickupRequest);
  res.redirect('/payment');
});

// Route for the Payment Page
app.get('/payment', (req, res) => {
  res.render('payment'); // Assuming you have a 'payment.ejs' template
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = { signup, users };
