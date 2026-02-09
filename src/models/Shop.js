const mongoose = require('mongoose');

const ShopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    trim: true,
    required: true
  },
  logo: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: false
    },
    country: {
      type: String,
      required: false
    },
    zipCode: {
      type: String,
      required: false
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  contactInfo: {
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    website: String,
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String
    }
  },
  businessHours: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    open: String,
    close: String,
    isClosed: {
      type: Boolean,
      default: false
    }
  }],
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'closed'],
    default: 'active'
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  verificationStatus: {
    isVerified: {
      type: Boolean,
      default: false
    },
    documents: [{
      type: String
    }],
    verifiedAt: Date
  },
  metrics: {
    totalProducts: {
      type: Number,
      default: 0
    },
    totalOrders: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  wallet: {
  currentBalance: { type: Number, default: 0 },
  lockedBalance: { type: Number, default: 0 }, 
  currency: { type: String, default: 'TZS' }
}

});

ShopSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

// Update timestamp on save
ShopSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Shop', ShopSchema);