const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  birthDate: Date,
  parentName: String,
  parentPhone: String,
  registrationDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  classes: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }]
}, { strictPopulate: false }); // أضف هذا الخيار

module.exports = mongoose.model('Student', studentSchema);