const rateLimit = require('express-rate-limit');

// General API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000000, // Limit each IP to 1 million requests per windowMs (effectively no limit)
  message: {
    success: false,
    data: null,
    errors: ['Too many requests from this IP, please try again later']
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth routes
exports.authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 attempts per hour
  message: {
    success: false,
    data: null,
    errors: ['Too many authentication attempts, please try again later']
  },
  standardHeaders: true,
  legacyHeaders: false,
  
});