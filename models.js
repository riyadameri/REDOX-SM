// models.js
const mongoose = require('mongoose');

// نموذج الطالب
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  birthDate: Date,
  parentName: String,
  parentPhone: String,
  address: String,
  registrationDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

// نموذج الأستاذ
const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  specialization: String,
  phone: String,
  hireDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

// نموذج الحصة
const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  schedule: {
    day: { type: String, enum: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] },
    time: String
  },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  price: { type: Number, required: true }
});

// نموذج البطاقة
const cardSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  issueDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

// نموذج الدفع
const paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true }, // شكل: YYYY-MM
  paymentDate: { type: Date, default: Date.now },
  paymentMethod: String,
  notes: String
});

const Student = mongoose.model('Student', studentSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);
const Class = mongoose.model('Class', classSchema);
const Card = mongoose.model('Card', cardSchema);
const Payment = mongoose.model('Payment', paymentSchema);

module.exports = { Student, Teacher, Class, Card, Payment };