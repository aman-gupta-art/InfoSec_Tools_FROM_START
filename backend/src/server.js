require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./models');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const serverRoutes = require('./routes/server.routes');
const activityLogRoutes = require('./routes/activityLog.routes');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// Simple route for API health check
app.get('/api/health', (req, res) => {
  res.json({ message: "InfoSec Tools API is running." });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Set port
const PORT = process.env.PORT || 5000;

// Initialize database and start server
const initDb = async () => {
  try {
    await db.sequelize.sync();
    console.log('Database synchronized successfully.');
    
    // Check if admin user exists, create if not
    const User = db.users;
    const adminExists = await User.findOne({
      where: {
        username: process.env.ADMIN_USERNAME || 'admin'
      }
    });
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (!adminExists) {
      await User.create({
        username: adminUsername,
        password: bcrypt.hashSync(adminPassword, 8),
        role: 'admin',
        firstName: process.env.ADMIN_FIRSTNAME || 'Admin',
        lastName: process.env.ADMIN_LASTNAME || 'User'
      });
      console.log(`Default admin user created. Username: ${adminUsername}, Password: ${adminPassword}`);
      
      if (process.env.NODE_ENV !== 'development') {
        console.warn('WARNING: Using default admin credentials in non-development environment!');
        console.warn('Please change the admin password immediately after first login.');
      }
    }

    // Create a read-only user for testing (only in development)
    const regularUsername = process.env.USER_USERNAME || 'user';
    const regularPassword = process.env.USER_PASSWORD || 'user123';
    
    if (process.env.NODE_ENV === 'development') {
      const readonlyExists = await User.findOne({
        where: {
          username: regularUsername
        }
      });
      
      if (!readonlyExists) {
        await User.create({
          username: regularUsername,
          password: bcrypt.hashSync(regularPassword, 8),
          role: 'readonly',
          firstName: process.env.USER_FIRSTNAME || 'Regular',
          lastName: process.env.USER_LASTNAME || 'User'
        });
        console.log(`Development read-only user created. Username: ${regularUsername}, Password: ${regularPassword}`);
      }
    }
    
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
};

// Start server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await initDb();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  db.sequelize.close().then(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
}); 