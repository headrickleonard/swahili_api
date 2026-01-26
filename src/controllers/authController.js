require('dotenv').config();
const {User} = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadToCloudinary } = require('../config/cloudinary');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');

// Rate Limiting Middleware
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 login attempts
  message: {
    success: false,
    errors: ['Too many login attempts, please try again later'],
    data: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Token Generation Functions
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      user: {
        id: user.id,
        userType: user.userType,
        email: user.email
      }
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      user: {
        id: user.id,
        userType: user.userType,
        email: user.email
      }
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

exports.registerUser = async (req, res) => {
  const { username, email, password, userType, profile } = req.body;
  const errors = [];

  // Validation
  if (!username) errors.push('Username is required');
  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (!['BUYER', 'SELLER'].includes(userType)) errors.push('Invalid user type');

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      data: null,
      errors: errors
    });
  }

  try {
    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({
        success: false,
        data: null,
        errors: ['User already exists']
      });
    }

    // Create new user
    user = new User({
      username,
      email,
      password,
      userType,
      profile
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          profile: {
            avatar: user.profile.avatar || null
          }
        },
        tokens: {
          access: accessToken,
          refresh: refreshToken
        }
      },
      errors: [],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      data: null,
      errors: [err.message]
    });
  }
};

// exports.loginUser = [
//   loginLimiter,
//   async (req, res) => {
//     const { email, password } = req.body;
//     const errors = [];

//     // Validation
//     if (!email) errors.push('Email is required');
//     if (!password) errors.push('Password is required');

//     if (errors.length > 0) {
//       return res.status(400).json({
//         success: false,
//         errors: errors,
//         data: null
//       });
//     }

//     try {
//       // Check if user exists
//       const user = await User.findOne({ email });
//       if (!user) {
//         return res.status(400).json({
//           success: false,
//           errors: ['Invalid credentials'],
//           data: null
//         });
//       }

//       // Compare passwords
//       const isMatch = await bcrypt.compare(password, user.password);
//       if (!isMatch) {
//         return res.status(400).json({
//           success: false,
//           errors: ['Invalid credentials'],
//           data: null
//         });
//       }

//       // Generate tokens
//       const accessToken = generateAccessToken(user);
//       const refreshToken = generateRefreshToken(user);

//       // Save refresh token to user
//       user.refreshToken = refreshToken;
//       await user.save();

//       res.json({
//         success: true,
//         data: {
//           user: {
//             id: user._id,
//             username: user.username,
//             email: user.email,
//             userType: user.userType,
//             profile: {
//               avatar: user.profile.avatar || null
//             }
//           },
//           tokens: {
//             access: accessToken,
//             refresh: refreshToken
//           }
//         },
//         errors: []
//       });
//     } catch (err) {
//       res.status(500).json({
//         success: false,
//         errors: [err.message],
//         data: null
//       });
//     }
//   }
// ];

// Refresh Token Endpoint

exports.loginUser = [
  loginLimiter,
  async (req, res) => {
    const { email, password } = req.body;
    const errors = [];

    // Validation
    if (!email) errors.push('Email is required');
    if (!password) errors.push('Password is required');

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors,
        data: null
      });
    }

    try {
      // Check if user exists
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({
          success: false,
          errors: ['Invalid credentials'],
          data: null
        });
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        return res.status(403).json({
          success: false,
          errors: ['Account is temporarily locked due to too many failed attempts. Please try again later.'],
          data: null
        });
      }

      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        // Increment login attempts on failed login
        await user.incrementLoginAttempts();
        
        return res.status(400).json({
          success: false,
          errors: ['Invalid credentials'],
          data: null
        });
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Save refresh token to user
      user.refreshToken = refreshToken;
      await user.save();

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            userType: user.userType,
            hasShop: user.hasShop,
            profile: {
              avatar: user.profile.avatar || null
            }
          },
          tokens: {
            access: accessToken,
            refresh: refreshToken
          }
        },
        errors: []
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        errors: [err.message],
        data: null
      });
    }
  }
];

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      errors: ['Refresh token is required'],
      data: null
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Find user with this refresh token
    const user = await User.findOne({
      _id: decoded.user.id,
      refreshToken: refreshToken
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        errors: ['Invalid refresh token'],
        data: null
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Update user's refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      data: {
        tokens: {
          access: newAccessToken,
          refresh: newRefreshToken
        },
        errors: []
      }
    });
  } catch (err) {
    res.status(403).json({
      success: false,
      errors: ['Invalid or expired refresh token'],
      data: null
    });
  }
};
