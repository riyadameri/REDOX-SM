const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  class: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  month: { 
    type: String, 
    required: true, 
    match: /^\d{4}-\d{2}$/ // تنسيق YYYY-MM
  },
  paymentDate: { 
    type: Date 
  },
  status: { 
    type: String, 
    enum: ['paid', 'pending', 'late'], 
    default: 'pending' 
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank', 'online'],
    default: 'cash'
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);