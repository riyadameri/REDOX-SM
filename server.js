require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const socketio = require('socket.io');
const path = require('path');
const cors = require('cors');
const moment = require('moment');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const smsGateway = require('./sms-gateway');

const app = express();
const server = require('http').createServer(app);

const io = socketio(server, {
  cors: {
    origin: "http://localhost:3000", // or "*" for development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  },
  transports: ['websocket', 'polling'] // Add this line

});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'secretary', 'accountant', 'teacher'], required: true },
  fullName: String,
  phone: String,
  email: String,
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
});

const StudentsAccountsSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: String,
  studentId : { type: String, required: true, unique: true },
  role: { type: String, enum: ['student'], required: true },
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' } // Add this line

},{  strictPopulate: false 
})

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true }, 
  studentId: { 
    type: String, 
    unique: true,
    default: function() {
      // إنشاء معرف فريد عند الإنشاء
      return 'STU-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }
  },
  birthDate: Date,
  parentName: String,
  parentPhone: { type: String, required: true },
  parentEmail: { type: String, required: false },
  registrationDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }, // Changed default to false
  academicYear: { 
    type: String, 
    enum: ['1AS', '2AS', '3AS', '1MS', '2MS', '3MS', '4MS', '5MS' ,'1AP','2AP','3AP','4AP','5AP','NS', null , 'اولى ابتدائي', 'ثانية ابتدائي', 'ثالثة ابتدائي', 'رابعة ابتدائي', 'خامسة ابتدائي', 'غير محدد'],
    required: true
  },
  new : { type: Boolean, default: true }, 
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
  status: { 
    type: String, 
    enum: ['pending', 'active', 'inactive', 'banned'], 
    default: 'pending' // New status for registration flow
  },
  registrationData: { // Store additional registration info
    address: String,
    previousSchool: String,
    healthInfo: String,
    documents: [{
      name: String,
      url: String,
      verified: { type: Boolean, default: false }
    }]
  }
}, { strictPopulate: false });

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subjects: [{ type: String, enum: ['رياضيات', 'فيزياء', 'علوم', 'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'تاريخ', 'جغرافيا', 'فلسفة', 'إعلام آلي'] }],
  phone: String,
  email: String,
  hireDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  salaryPercentage: { type: Number, default: 0.7 }
});

const classroomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  capacity: Number,
  location: String
});

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, enum: ['رياضيات', 'فيزياء', 'علوم', 'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'تاريخ', 'جغرافيا', 'فلسفة', 'إعلام آلي'] },
  description: String,
  schedule: [{
    day: { type: String, enum: ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'] },
    time: String,
    classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }
  }],
  academicYear: { type: String, enum: ['1AS', '2AS', '3AS', '1MS', '2MS', '3MS', '4MS', '5MS','1AP','2AP','3AP','4AP','5AP','NS'] },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  price: { type: Number, required: true }
});

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const cardSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  issueDate: { type: Date, default: Date.now }
});
// Add this schema near your other schemas
const authorizedCardSchema = new mongoose.Schema({
  uid: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  cardName: { 
    type: String, 
    required: true 
  },
  description: String,
  issueDate: { 
    type: Date, 
    default: Date.now 
  },
  expirationDate: { 
    type: Date, 
    required: true 
  },
  active: { 
    type: Boolean, 
    default: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: false , 
  },
  notes: String
}, { timestamps: true });


const paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true },
  paymentDate: { type: Date, default: null },
  status: { type: String, enum: ['paid', 'pending', 'late'], default: 'pending' },
  paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
  invoiceNumber: String,
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    parentPhone: String,
    parentEmail: String
  }],
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  content: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
  messageType: { type: String, enum: ['individual', 'group', 'class', 'payment'] },
  status: { type: String, enum: ['sent', 'failed'], default: 'sent' }
});

const financialTransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  description: String,
  category: { type: String, enum: ['tuition', 'salary', 'rent', 'utilities', 'supplies', 'other'] },
  date: { type: Date, default: Date.now },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reference: String
});
// Add this near other schemas
const liveClassSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  classroom: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' },
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
  attendance: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
    joinedAt: { type: Date },
    leftAt: { type: Date }
  }],
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });




// Add these schemas near your other schemas

// School Fee Schema (one-time registration fee)
const schoolFeeSchema = new mongoose.Schema({
student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
amount: { type: Number, required: true, default: 60 }, // 60 DZD
paymentDate: { type: Date, default: null },
status: { type: String, enum: ['paid', 'pending'], default: 'pending' },
paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
invoiceNumber: String,
recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Teacher Payment Schema (monthly payments)
const teacherPaymentSchema = new mongoose.Schema({
teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
month: { type: String, required: true }, // Format: YYYY-MM
amount: { type: Number, required: true }, // 70% of class price
status: { type: String, enum: ['paid', 'pending', 'late'], default: 'pending' },
paymentDate: { type: Date, default: null },
paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
invoiceNumber: String,
recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Staff Salary Schema
const staffSalarySchema = new mongoose.Schema({
employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
month: { type: String, required: true }, // Format: YYYY-MM
amount: { type: Number, required: true },
status: { type: String, enum: ['paid', 'pending', 'late'], default: 'pending' },
paymentDate: { type: Date, default: null },
paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
notes: String,
recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Expense Schema
const expenseSchema = new mongoose.Schema({
description: { type: String, required: true },
amount: { type: Number, required: true },
category: { 
  type: String, 
  enum: ['rent', 'utilities', 'supplies', 'maintenance', 'marketing', 'other'],
  required: true 
},
date: { type: Date, default: Date.now },
paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
receiptNumber: String,
recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Invoice Schema
const invoiceSchema = new mongoose.Schema({
invoiceNumber: { type: String, required: true, unique: true },
type: { 
  type: String, 
  enum: ['tuition', 'teacher', 'staff', 'school-fee', 'other'],
  required: true 
},
recipient: {
  type: { type: String, enum: ['student', 'teacher', 'staff', 'other'] },
  id: mongoose.Schema.Types.ObjectId, // Could be Student, Teacher, or User ID
  name: String
},
items: [{
  description: String,
  amount: Number,
  quantity: { type: Number, default: 1 }
}],
totalAmount: { type: Number, required: true },
date: { type: Date, default: Date.now },
dueDate: Date,
status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
notes: String,
recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Create models
const SchoolFee = mongoose.model('SchoolFee', schoolFeeSchema);
const TeacherPayment = mongoose.model('TeacherPayment', teacherPaymentSchema);
const StaffSalary = mongoose.model('StaffSalary', staffSalarySchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Invoice = mongoose.model('Invoice', invoiceSchema);
const AuthorizedCard = mongoose.model('AuthorizedCard', authorizedCardSchema);


























const LiveClass = mongoose.model('LiveClass', liveClassSchema);

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const Teacher = mongoose.model('Teacher', teacherSchema);
const Classroom = mongoose.model('Classroom', classroomSchema);
const Class = mongoose.model('Class', classSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Card = mongoose.model('Card', cardSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Message = mongoose.model('Message', messageSchema);
const FinancialTransaction = mongoose.model('FinancialTransaction', financialTransactionSchema);
const StudentAccount = mongoose.model('StudentAccount', StudentsAccountsSchema);
// RFID Reader Implementation



// Authorized Cards Management
app.get('/api/authorized-cards',  async (req, res) => {
  try {
    const { active, expired } = req.query;
    const query = {};

    if (active !== undefined) query.active = active === 'true';
    if (expired === 'true') {
      query.expirationDate = { $lt: new Date() };
    } else if (expired === 'false') {
      query.expirationDate = { $gte: new Date() };
    }

    const cards = await AuthorizedCard.find(query)
      .populate('createdBy', 'username fullName')
      .sort({ createdAt: -1 });
    
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/authorized-cards', async (req, res) => {
  try {
    const { uid, cardName, description, expirationDate, notes } = req.body;
    
    // Check if card already exists
    const existingCard = await AuthorizedCard.findOne({ uid });
    if (existingCard) {
      return res.status(400).json({ error: 'البطاقة مسجلة مسبقاً في النظام' });
    }

    const authorizedCard = new AuthorizedCard({
      uid,
      cardName,
      description,
      expirationDate: new Date(expirationDate),
      notes,
    });

    await authorizedCard.save();
    
    // Populate createdBy field for response
    await authorizedCard.populate('createdBy', 'username fullName');
    
    res.status(201).json(authorizedCard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/authorized-cards/:id',  async (req, res) => {
  try {
    const { cardName, description, expirationDate, active, notes } = req.body;
    
    const authorizedCard = await AuthorizedCard.findByIdAndUpdate(
      req.params.id,
      {
        cardName,
        description,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        active,
        notes
      },
      { new: true }
    ).populate('createdBy', 'username fullName');

    if (!authorizedCard) {
      return res.status(404).json({ error: 'البطاقة غير موجودة' });
    }

    res.json(authorizedCard);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/authorized-cards/:id', async (req, res) => {
  try {
    const authorizedCard = await AuthorizedCard.findByIdAndDelete(req.params.id);
    
    if (!authorizedCard) {
      return res.status(404).json({ error: 'البطاقة غير موجودة' });
    }

    res.json({ message: 'تم حذف البطاقة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if card is authorized before assignment
app.get('/api/authorized-cards/check/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    const authorizedCard = await AuthorizedCard.findOne({ 
      uid, 
      active: true,
      expirationDate: { $gte: new Date() }
    });

    if (!authorizedCard) {
      return res.status(404).json({ 
        error: 'البطاقة غير مصرحة أو منتهية الصلاحية',
        authorized: false 
      });
    }

    res.json({
      authorized: true,
      card: authorizedCard,
      message: 'البطاقة مصرحة وصالحة'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



















let serialPort = null;

function initializeRFIDReader() {
  const portName = process.env.RFID_PORT;
  const baudRate = parseInt(process.env.RFID_BAUD_RATE) || 9600;

  if (!portName) {
    console.error('RFID_PORT not configured in .env file');
    return;
  }

  console.log(`Attempting to connect to RFID reader on ${portName}...`);

  // Close existing port if it exists
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }

  try {
    serialPort = new SerialPort({
      path: portName,
      baudRate: baudRate,
      lock: false
    }, (err) => {
      if (err) {
        console.error(`Failed to open RFID port ${portName}:`, err.message);
        console.log('Retrying in 5 seconds...');
        setTimeout(initializeRFIDReader, 5000);
        return;

      }
      console.log(`RFID reader connected successfully on ${portName}`);
    });

    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', async (data) => {
      console.log('Raw RFID data:', data); // Debug output
      
      if (data.length > 0) {
        const uid = data.trim();
        console.log('Potential UID:', uid);
        io.emit('raw-data', { data, uid }); // Send to frontend for debugging
      }

      if (data.startsWith('UID:')) {
        const uid = data.trim().substring(4).trim();
        console.log('Card detected:', uid);

        try {
          const card = await Card.findOne({ uid }).populate('student');
          if (card) {
            const student = await Student.findById(card.student._id)
              .populate({
                path: 'classes',
                populate: [
                  { path: 'teacher', model: 'Teacher' },
                  { path: 'students', model: 'Student' }
                ]
              });

            const payments = await Payment.find({ student: card.student._id, status: { $in: ['pending', 'late'] } })
              .populate('class');

            // Check if any class is scheduled now
            const now = new Date();
            const day = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][now.getDay()];
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            let currentClass = null;

            for (const cls of student.classes || []) {
              for (const schedule of cls.schedule || []) {
                if (schedule.day === day) {
                  const [hour, minute] = schedule.time.split(':').map(Number);
                  if (Math.abs((hour - currentHour) * 60 + (minute - currentMinute)) <= 30) {
                    currentClass = cls;
                    break;
                  }
                }
              }
              if (currentClass) break;
            }

            if (currentClass) {
              // Record attendance
              const attendance = new Attendance({
                student: student._id,
                class: currentClass._id,
                date: now,
                status: 'present'
              });
              await attendance.save();

              // Send SMS to parent
              // const smsContent = `تم تسجيل حضور الطالب ${student.name} في حصة ${currentClass.name} في ${now.toLocaleString()}`;

              try {
                await smsGateway.send(student.parentPhone, smsContent);
                await Message.create({
                  sender: null,
                  recipients: [{ student: student._id, parentPhone: student.parentPhone }],
                  class: currentClass._id,
                  content: smsContent,
                  messageType: 'individual'
                });
              } catch (smsErr) {
                console.error('Failed to send SMS:', smsErr);
              }
            }

            io.emit('student-detected', {
              student,
              card,
              classes: student.classes || [],
              payments: payments || [],
              currentClass
            });
          } else {
            io.emit('unknown-card', { uid });
          }
        } catch (err) {
          console.error('Error processing card:', err);
          io.emit('card-error', { error: 'Error processing card' });
        }
      }
    });

    serialPort.on('error', err => {
      console.error('RFID reader error:', err.message);
      setTimeout(initializeRFIDReader, 5000);
    });
    
    serialPort.on('close', () => {
      console.log('RFID port closed, attempting to reconnect...');
      setTimeout(initializeRFIDReader, 5000);
    });

  } catch (err) {
    console.error('RFID initialization error:', err.message);
    // setTimeout(initializeRFIDReader, 5000);
  }
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Database connection successful'))
  .catch(err => console.error("Error connecting to Database:", err));

// JWT Authentication Middleware
// Update authenticate middleware to check for accounting access
// Update your authenticate middleware to handle single role or array
const authenticate = (roles = []) => {
// Convert single role to array for consistency
if (typeof roles === 'string') {
  roles = [roles];
}

return (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'غير مصرح بالدخول' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    if (roles.length && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'غير مصرح بالوصول لهذه الصلاحية' });
    }

    next();
  } catch (err) {
    res.status(401).json({ error: 'رمز الدخول غير صالح' });
  }
};
};

// Email Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
// API Routes

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { username: user.username, role: user.role, fullName: user.fullName } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/change-password', authenticate(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Users Management (Admin only)
app.get('/api/users', authenticate(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, ...rest } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'اسم المستخدم موجود مسبقا' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashedPassword,
      role,
      ...rest
    });

    await user.save();

    res.status(201).json({
      _id: user._id,
      username: user.username,
      role: user.role,
      fullName: user.fullName
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Students
// get only active students
app.get('/api/students', /* authenticate(['admin', 'secretary', 'accountant']), */ async (req, res) => {
  try {
    const { academicYear, active } = req.query;

//   if (academicYear) query.academicYear = academicYear;
    if (active) query.active = active === true;

    const students = await Student.find({status : 'active' }).sort({ name: 1 });

    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
//get all students
app.get('/api/allstudents',/* authenticate(['admin', 'secretary', 'accountant']), */ ()=>{
  try {
    const students = Student.find();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
})
// activate student
app.put('/api/students/:id/activate', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    student.active = true;
    await student.save();
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/students', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const student = new Student(req.body);
    console.log(student) ;


    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
  
});

app.get('/api/students/:id', /* authenticate(['admin', 'secretary', 'accountant']),*/ async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('classes');
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/students/:id', authenticate(['admin']), async (req, res) => {
  try {
    // Remove student from classes first
    await Class.updateMany(
      { students: req.params.id },
      { $pull: { students: req.params.id } }
    );

    // Delete associated payments, cards and attendances
    await Payment.deleteMany({ student: req.params.id });
    await Card.deleteMany({ student: req.params.id });
    await Attendance.deleteMany({ student: req.params.id });

    // Finally delete the student
    await Student.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف الطالب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teachers
app.get('/api/teachers', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ name: 1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teachers', authenticate(['admin']), async (req, res) => {
  try {
    const teacher = new Teacher(req.body);
    await teacher.save();
    res.status(201).json(teacher);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/teachers/:id', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: 'الأستاذ غير موجود' });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teachers/:id', authenticate(['admin']), async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/teachers/:id', authenticate(['admin']), async (req, res) => {
  try {
    // Remove teacher from classes first
    await Class.updateMany(
      { teacher: req.params.id },
      { $unset: { teacher: "" } }
    );

    // Delete the teacher
    await Teacher.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف الأستاذ بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Classrooms
app.get('/api/classrooms', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const classrooms = await Classroom.find().sort({ name: 1 });
    res.json(classrooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/classrooms', authenticate(['admin']), async (req, res) => {
  try {
    const classroom = new Classroom(req.body);
    await classroom.save();
    res.status(201).json(classroom);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Classes
app.get('/api/classes', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { academicYear, subject, teacher } = req.query;
    const query = {};

    if (academicYear) query.academicYear = academicYear;
    if (subject) query.subject = subject;
    if (teacher) query.teacher = teacher;

    const classes = await Class.find(query)
      .populate('teacher')
      .populate('students')
      .populate('schedule.classroom');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/classes', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const classObj = new Class(req.body);
    await classObj.save();
    res.status(201).json(classObj);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/classes/:id', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const classObj = await Class.findById(req.params.id)
      .populate('teacher')
      .populate('students')
      .populate('schedule.classroom');
    if (!classObj) return res.status(404).json({ error: 'الحصة غير موجودة' });
    res.json(classObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/classes/:id', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const classObj = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('teacher')
      .populate('students')
      .populate('schedule.classroom');

    res.json(classObj);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/classes/:id', authenticate(['admin']), async (req, res) => {
  try {
    // Remove class from students first
    await Student.updateMany(
      { classes: req.params.id },
      { $pull: { classes: req.params.id } }
    );

    // Delete associated payments and attendances
    await Payment.deleteMany({ class: req.params.id });
    await Attendance.deleteMany({ class: req.params.id });

    // Delete the class
    await Class.findByIdAndDelete(req.params.id);

    res.json({ message: 'تم حذف الحصة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enroll Student in Class
// Enroll Student in Class
app.post('/api/classes/:classId/enroll/:studentId', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    // 1. Check if class and student exist
    const classObj = await Class.findById(req.params.classId);
    const student = await Student.findById(req.params.studentId);

    if (!classObj || !student) {
        return res.status(404).json({ error: 'الحصة أو الطالب غير موجود' });
    }

    // 2. Modified condition to allow enrollment in classes with no academic year
    const isAcademicYearMatch = (
        !classObj.academicYear || 
        classObj.academicYear === 'NS' || 
        classObj.academicYear === 'غير محدد' ||
        classObj.academicYear === student.academicYear
    );

    if (!isAcademicYearMatch) {
        return res.status(400).json({ 
            error: `لا يمكن تسجيل الطالب في هذه الحصة بسبب عدم تطابق السنة الدراسية (الحصة: ${classObj.academicYear}, الطالب: ${student.academicYear})`
        });
    }


    // 2. Add student to class if not already enrolled

    const isEnrolled = classObj.students.includes(req.params.studentId);
    if (isEnrolled) {
      return res.status(400).json({ error: 'الطالب مسجل بالفعل في هذه الحصة' });
    }

    if (!classObj.students.includes(req.params.studentId)) {
      classObj.students.push(req.params.studentId);
      await classObj.save();
    }

    if (!student.classes.includes(req.params.classId)) {
      student.classes.push(req.params.classId);
      await student.save();
    }

    // 4. Create monthly payments for student starting from enrollment date (now)
    const enrollmentDate = new Date(); // Use current date as enrollment date
    const currentDate = moment();
    const endDate = currentDate.clone().add(1, 'year');

    const months = [];
    let currentDateIter = moment(enrollmentDate); // Start from enrollment date

    while (currentDateIter.isBefore(endDate)) {
      months.push(currentDateIter.format('YYYY-MM'));
      currentDateIter.add(1, 'month');
    }

    const createdPayments = [];
    for (const month of months) {
      const paymentExists = await Payment.findOne({
        student: req.params.studentId,
        class: req.params.classId,
        month
      });

      if (!paymentExists) {
        const payment = new Payment({
          student: req.params.studentId,
          class: req.params.classId,
          amount: classObj.price,
          month,
          status: moment(month).isBefore(currentDate, 'month') ? 'late' : 'pending',
          recordedBy: req.user.id
        });

        await payment.save();
        createdPayments.push(payment);

        // Record financial transaction (expected income)
        const transaction = new FinancialTransaction({
          type: 'income',
          amount: classObj.price,
          description: `دفعة شهرية متوقعة لطالب ${student.name} في حصة ${classObj.name} لشهر ${month}`,
          category: 'tuition',
          recordedBy: req.user.id,
          reference: payment._id
        });
        await transaction.save();
      }
    }

    res.json({
      message: `تم إضافة الطالب ${student.name} للحصة ${classObj.name} بنجاح`,
      class: classObj,
      payments: await Payment.find({
        student: req.params.studentId,
        class: req.params.classId
      }).sort({ month: 1 })
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Unenroll Student from Class
app.delete('/api/classes/:classId/unenroll/:studentId', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    // Remove student from class
    await Class.findByIdAndUpdate(
      req.params.classId,
      { $pull: { students: req.params.studentId } }
    );

    // Remove class from student
    await Student.findByIdAndUpdate(
      req.params.studentId,
      { $pull: { classes: req.params.classId } }
    );

    // Delete associated payments
    await Payment.deleteMany({
      student: req.params.studentId,
      class: req.params.classId,
      status: { $in: ['pending', 'late'] }
    });

    res.json({ message: 'تم إزالة الطالب من الحصة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance
app.get('/api/attendance', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { class: classId, student, date } = req.query;
    const query = {};

    if (classId) query.class = classId;
    if (student) query.student = student;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    const attendance = await Attendance.find(query)
      .populate('student')
      .populate('class')
      .populate('recordedBy');
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const attendance = new Attendance({
      ...req.body,
      recordedBy: req.user.id
    });
    await attendance.save();
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// Cards
app.get('/api/cards', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const cards = await Card.find().populate('student');
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cards', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const { uid, student } = req.body;

    // First check if card is authorized
    const authorizedCard = await AuthorizedCard.findOne({ 
      uid, 
      active: true,
      expirationDate: { $gte: new Date() }
    });

    if (!authorizedCard) {
      return res.status(400).json({ 
        error: 'البطاقة غير مصرحة أو منتهية الصلاحية. يرجى استخدام بطاقة مصرحة.' 
      });
    }

    // Check if card already assigned to another student
    const existingCard = await Card.findOne({ uid });
    if (existingCard) {
      return res.status(400).json({ error: 'البطاقة مسجلة بالفعل لطالب آخر' });
    }

    // Check if student exists
    const studentExists = await Student.findById(student);
    if (!studentExists) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    const card = new Card({
      uid,
      student,
      issueDate: new Date()
    });

    await card.save();
    
    // Update authorized card with student assignment info
    await AuthorizedCard.findByIdAndUpdate(authorizedCard._id, {
      $set: { 
        assignedTo: student,
        assignedAt: new Date()
      }
    });

    res.status(201).json(card);
  } catch (err) {
    console.error('Error creating card:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/cards/:id', authenticate(['admin']), async (req, res) => {
  try {
    await Card.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم حذف البطاقة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// get student data and hess classes and payments by card 
app.get('/api/cards/uid/:cardId',  async (req, res) => {
  const cardId = req.params.cardId;

  try {
    const card = await Card.findOne({ uid: cardId });
    if (!card) {
      return res.status(404).json({ error: 'البطاقة غير موجودة' });
    }

    const student = await Student.findById(card.student);
    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    const classes = await Class.find({ students: student._id });
    const payments = await Payment.find({ student: student._id });

    res.json({ student, classes, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Payments
app.get('/api/payments', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const { student, class: classId, month, status } = req.query;
    const query = {};

    if (student) query.student = student;
    if (classId) query.class = classId;
    if (month) query.month = month;
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('student')
      .populate('class')
      .populate('recordedBy')
      .sort({ month: 1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register Payment
// Register Payment - FIXED VERSION
// Enhanced payment registration with teacher share calculation
app.put('/api/payments/:id/pay', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
try {
  const payment = await Payment.findById(req.params.id)
    .populate('student')
    .populate('class')
    .populate('recordedBy');

  if (!payment) {
    return res.status(404).json({ error: 'الدفعة غير موجودة' });
  }

  payment.status = 'paid';
  payment.paymentDate = req.body.paymentDate || new Date();
  payment.paymentMethod = req.body.paymentMethod || 'cash';
  payment.recordedBy = req.user.id;
  payment.invoiceNumber = `INV-${Date.now()}`;

  await payment.save();
  
  // Calculate teacher's share (70%)
  const teacherShare = payment.amount * 0.7;
  
  // Create teacher payment record
  const teacherPayment = new TeacherPayment({
    teacher: payment.class.teacher,
    class: payment.class._id,
    student: payment.student._id,
    month: payment.month,
    amount: teacherShare,
    status: 'pending', // Will be paid separately
    recordedBy: req.user.id
  });
  await teacherPayment.save();

  // Record financial transaction (actual income)
  const transaction = new FinancialTransaction({
    type: 'income',
    amount: payment.amount,
    description: `دفعة شهرية لطالب ${payment.student.name} في حصة ${payment.class.name} لشهر ${payment.month}`,
    category: 'tuition',
    recordedBy: req.user.id,
    reference: payment._id
  });
  await transaction.save();

  res.json({
    message: `تم تسديد الدفعة بنجاح`,
    payment,
    invoiceNumber: payment.invoiceNumber,
    teacherShare: teacherShare
  });
} catch (err) {
  console.error('Payment registration error:', err);
  res.status(500).json({ error: err.message });
}
});
// Generate Invoice
app.get('/api/payments/:id', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('student')
            .populate('class')
            .populate('recordedBy');

        if (!payment) {
            return res.status(404).json({ error: 'الدفعة غير موجودة' });
        }

        res.json(payment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Messages
app.get('/api/messages', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const { messageType, class: classId, startDate, endDate } = req.query;
    const query = {};

    if (messageType) query.messageType = messageType;
    if (classId) query.class = classId;
    if (startDate || endDate) {
      query.sentAt = {};
      if (startDate) query.sentAt.$gte = new Date(startDate);
      if (endDate) query.sentAt.$lte = new Date(endDate);
    }

    const messages = await Message.find(query)
      .populate('sender')
      .populate('class')
      .populate('recipients.student')
      .sort({ sentAt: -1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const { recipients, content, messageType, class: classId } = req.body;

    // Validate recipients based on message type
    let validatedRecipients = [];

    if (messageType === 'individual' && recipients.student) {
      const student = await Student.findById(recipients.student);
      if (!student) {
        return res.status(400).json({ error: 'الطالب غير موجود' });
      }
      validatedRecipients.push({
        student: student._id,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail
      });
    }
    else if (messageType === 'class' && classId) {
      const classObj = await Class.findById(classId).populate('students');
      if (!classObj) {
        return res.status(400).json({ error: 'الحصة غير موجودة' });
      }
      validatedRecipients = classObj.students.map(student => ({
        student: student._id,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail
      }));
    }
    else if (messageType === 'group' && recipients.length) {
      for (const recipient of recipients) {
        const student = await Student.findById(recipient.student);
        if (student) {
          validatedRecipients.push({
            student: student._id,
            parentPhone: student.parentPhone,
            parentEmail: student.parentEmail
          });
        }
      }
    }
    else if (messageType === 'payment') {
      // This is handled in the payment route
      return res.status(400).json({ error: 'يجب استخدام طريق الدفع لإرسال رسائل الدفع' });
    }

    if (!validatedRecipients.length) {
      return res.status(400).json({ error: 'لا يوجد مستلمين للرسالة' });
    }

    // Send messages
    const failedRecipients = [];

    for (const recipient of validatedRecipients) {
      try {
        if (recipient.parentPhone) {
          await smsGateway.send(recipient.parentPhone, content);
        }
        if (recipient.parentEmail) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: recipient.parentEmail,
            subject: 'رسالة من المدرسة',
            text: content
          });
        }
      } catch (err) {
        console.error(`فشل إرسال الرسالة لـ ${recipient.parentPhone || recipient.parentEmail}`, err);
        failedRecipients.push(recipient);
      }
    }

    // Save message record
    const message = new Message({
      sender: req.user.id,
      recipients: validatedRecipients,
      class: classId,
      content,
      messageType,
      status: failedRecipients.length ? 'failed' : 'sent'
    });
    await message.save();

    if (failedRecipients.length) {
      return res.status(207).json({
        message: 'تم إرسال بعض الرسائل وفشل البعض الآخر',
        failedRecipients,
        messageId: message._id
      });
    }

    res.status(201).json({
      message: 'تم إرسال جميع الرسائل بنجاح',
      messageId: message._id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Financial Transactions
app.get('/api/transactions', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const { type, category, startDate, endDate } = req.query;
    const query = {};

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await FinancialTransaction.find(query)
      .populate('recordedBy')
      .sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Financial Reports
app.get('/api/reports/financial', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const { year } = req.query;
    const matchStage = {};

    if (year) {
      matchStage.date = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`)
      };
    }

    const report = await FinancialTransaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category',
            month: { $month: '$date' },
            year: { $year: '$date' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            type: '$_id.type',
            category: '$_id.category'
          },
          monthlyData: {
            $push: {
              month: '$_id.month',
              year: '$_id.year',
              totalAmount: '$totalAmount',
              count: '$count'
            }
          },
          totalAmount: { $sum: '$totalAmount' },
          totalCount: { $sum: '$count' }
        }
      },
      {
        $project: {
          type: '$_id.type',
          category: '$_id.category',
          monthlyData: 1,
          totalAmount: 1,
          totalCount: 1,
          _id: 0
        }
      }
    ]);

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });

  }
});





// Live Classes Routes
app.get('/api/live-classes', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { status, date, class: classId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }
    if (classId) query.class = classId;

    const liveClasses = await LiveClass.find(query)
      .populate('class')
      .populate('teacher')
      .populate('classroom')
      .populate('attendance.student')
      .sort({ date: -1, startTime: -1 });
    
    res.json(liveClasses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/live-classes', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const liveClass = new LiveClass({
      ...req.body,
      createdBy: req.user.id
    });
    
    await liveClass.save();
    
    // Populate the saved data for response
    const populated = await LiveClass.findById(liveClass._id)
      .populate('class')
      .populate('teacher')
      .populate('classroom');
    
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/live-classes/:id', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const liveClass = await LiveClass.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('class')
      .populate('teacher')
      .populate('classroom')
      .populate('attendance.student');
    
    res.json(liveClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/live-classes/:id', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id)
      .populate('class')
      .populate('teacher')
      .populate('classroom')
      .populate('attendance.student');
    
    if (!liveClass) return res.status(404).json({ error: 'الحصة غير موجودة' });
    
    res.json(liveClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Auto Mark Absent , student hows not attendance  on lesson 

app.post('/api/live-classes/:id/auto-mark-absent', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const liveClassId = req.params.id;
    
    // Get the live class with populated students
    const liveClass = await LiveClass.findById(liveClassId)
      .populate({
        path: 'class',
        populate: {
          path: 'students',
          model: 'Student'
        }
      })
      .populate('attendance.student');

    if (!liveClass) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }

    if (liveClass.status !== 'completed') {
      return res.status(400).json({ error: 'الحصة لم تنته بعد' });
    }

    // Get all students enrolled in this class
    const enrolledStudents = liveClass.class.students || [];
    
    // Get students who have already been marked as present/late
    const attendedStudents = liveClass.attendance.map(att => att.student._id.toString());
    
    // Find students who haven't attended (absent)
    const absentStudents = enrolledStudents.filter(student => 
      !attendedStudents.includes(student._id.toString())
    );

    // Mark absent students
    const absentRecords = [];
    for (const student of absentStudents) {
      // Check if student already has an attendance record
      const existingAttendanceIndex = liveClass.attendance.findIndex(
        att => att.student._id.toString() === student._id.toString()
      );

      if (existingAttendanceIndex === -1) {
        // Add absent record
        liveClass.attendance.push({
          student: student._id,
          status: 'absent',
          joinedAt: null,
          leftAt: null
        });
        absentRecords.push(student.name);
      }
    }

    // Save the updated live class
    await liveClass.save();

    // Send notifications to parents of absent students
    if (absentRecords.length > 0) {
      await sendAbsenceNotifications(absentStudents, liveClass);
    }

    res.json({
      message: `تم تسجيل ${absentRecords.length} طالب كغائبين`,
      absentStudents: absentRecords,
      totalEnrolled: enrolledStudents.length,
      totalAttended: attendedStudents.length,
      totalAbsent: absentRecords.length
    });

  } catch (err) {
    console.error('Error in auto-mark-absent:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الغائبين' });
  }
});

// Helper function to send absence notifications
async function sendAbsenceNotifications(absentStudents, liveClass) {
  const absentStudentIds = absentStudents.map(student => student._id);
  
  try {
    // Get detailed student information with parent contacts
    const students = await Student.find({ 
      _id: { $in: absentStudentIds } 
    }).select('name parentPhone parentEmail');

    for (const student of students) {
      if (student.parentPhone) {
        const smsContent = `تنبيه: الطالب ${student.name} غائب عن حصة ${liveClass.class.name} بتاريخ ${new Date(liveClass.date).toLocaleDateString('ar-EG')}`;
        
        try {
          await smsGateway.send(student.parentPhone, smsContent);
          
          // Record the message
          await Message.create({
            sender: null, // System message
            recipients: [{
              student: student._id,
              parentPhone: student.parentPhone
            }],
            class: liveClass.class._id,
            content: smsContent,
            messageType: 'individual',
            status: 'sent'
          });
        } catch (smsErr) {
          console.error(`Failed to send SMS to ${student.parentPhone}:`, smsErr);
        }
      }

      if (student.parentEmail) {
        const emailContent = `
          <div dir="rtl">
            <h2>تنبيه غياب</h2>
            <p>الطالب: ${student.name}</p>
            <p>الحصة: ${liveClass.class.name}</p>
            <p>التاريخ: ${new Date(liveClass.date).toLocaleDateString('ar-EG')}</p>
            <p>الوقت: ${liveClass.startTime}</p>
            <p>نرجو التواصل مع الإدارة لمعرفة سبب الغياب</p>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: student.parentEmail,
            subject: `غياب الطالب ${student.name}`,
            html: emailContent
          });
        } catch (emailErr) {
          console.error(`Failed to send email to ${student.parentEmail}:`, emailErr);
        }
      }
    }
  } catch (err) {
    console.error('Error sending absence notifications:', err);
  }
}

// Enhanced attendance endpoint
app.post('/api/live-classes/:id/attendance', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { studentId, status, method } = req.body; // Added method parameter
    
    const liveClass = await LiveClass.findById(req.params.id)
      .populate('class')
      .populate('teacher');
      
    if (!liveClass) return res.status(404).json({ error: 'الحصة غير موجودة' });
    
    // Get student (either by ID or card UID)
    let student;
    if (method === 'rfid') {
      const card = await Card.findOne({ uid: studentId }).populate('student');
      if (!card) return res.status(404).json({ error: 'البطاقة غير مسجلة' });
      student = card.student;
    } else {
      student = await Student.findById(studentId);
      if (!student) return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // Check if student is enrolled in this class
    const isEnrolled = liveClass.class.students.some(s => s.equals(student._id));
    if (!isEnrolled) {
      return res.status(400).json({ error: 'الطالب غير مسجل في هذه الحصة' });
    }

    // Update attendance
    const existingIndex = liveClass.attendance.findIndex(a => 
      a.student.equals(student._id)
    );
    
    const attendanceRecord = {
      student: student._id,
      status,
      method: method || 'manual', // Track how attendance was recorded
      timestamp: new Date()
    };

    if (existingIndex >= 0) {
      liveClass.attendance[existingIndex] = attendanceRecord;
    } else {
      liveClass.attendance.push(attendanceRecord);
    }

    await liveClass.save();

    // Send notification if via RFID
    if (method === 'rfid' && student.parentPhone) {
      const smsContent = `تم تسجيل حضور الطالب ${student.name} في حصة ${liveClass.class.name} في ${new Date().toLocaleString('ar-EG')}`;
      try {
        await smsGateway.send(student.parentPhone, smsContent);
      } catch (smsErr) {
        console.error('Failed to send SMS:', smsErr);
      }
    }

    res.json({
      message: 'تم تسجيل الحضور بنجاح',
      attendance: attendanceRecord,
      student
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/live-classes/:classId/report', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    
    const query = { class: req.params.classId };
    if (fromDate && toDate) {
      query.date = { 
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    
    const liveClasses = await LiveClass.find(query)
      .populate('attendance.student')
      .sort({ date: 1 });
    
    // Create attendance report
    const report = {
      class: req.params.classId,
      totalClasses: liveClasses.length,
      attendance: {}
    };
    
    // Initialize attendance for all students
    const classObj = await Class.findById(req.params.classId).populate('students');
    classObj.students.forEach(student => {
      report.attendance[student._id] = {
        student: student,
        present: 0,
        absent: 0,
        late: 0,
        total: 0
      };
    });
    
    // Calculate attendance for each student
    liveClasses.forEach(liveClass => {
      liveClass.attendance.forEach(att => {
        if (report.attendance[att.student]) {
          report.attendance[att.student][att.status]++;
          report.attendance[att.student].total++;
        }
      });
    });
    
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// Student Registration Endpoint
app.post('/api/student/register', async (req, res) => {
  try {
    console.log('Received registration data:', req.body);

    // Validate required fields
    const requiredFields = ['name', 'academicYear', 'parentName', 'parentPhone'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ 
          error: `حقل ${field} مطلوب` 
        });
      }
    }

    // Create student record
    const student = new Student({
      name: req.body.name,
      academicYear: req.body.academicYear,
      parentName: req.body.parentName,
      parentPhone: req.body.parentPhone,
      birthDate: req.body.birthDate,
      parentEmail: req.body.parentEmail,
      address: req.body.address,
      previousSchool: req.body.previousSchool,
      healthInfo: req.body.healthInfo,
      status: 'pending',
      active: false,
      registrationDate: new Date(),
      status: 'pending',
      active: false,
      registrationDate: new Date()
    });

    await student.save();
    const schoolFee = new SchoolFee({
      student: student._id,
      amount: 600, // 60 DZD
      status: 'pending'
    });
    await schoolFee.save();
    console.log('Student registered successfully:', student);

    res.status(201).json({
      message: 'تم استلام طلب التسجيل بنجاح',
      studentId: student._id
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      error: 'حدث خطأ أثناء تسجيل الطلب',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Get Registration Requests (Admin only)
app.get('/api/registration-requests', authenticate(['admin']), async (req, res) => {
  try {
    const { status } = req.query;
    const query = { status: status || 'pending' };
    
    const requests = await Student.find(query)
      .sort({ registrationDate: -1 });
    
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve Student
app.put('/api/admin/approve-student/:id', authenticate(['admin']), async (req, res) => {
  try {
    // Generate official student ID
    const year = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const studentId = `STU-${year}-${randomNum}`;

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      {
        status: 'active',
        active: true,
        studentId,
        $unset: { 'registrationData.tempId': 1 }
      },
      { new: true }
    );

    // Send approval notification
    io.to(`student-${student.studentId}`).emit('registration-update', {
      studentId: student.studentId,
      status: 'active',
      name: student.name,
      registrationDate: student.registrationDate
    });

    res.json({
      message: 'تم تفعيل حساب الطالب بنجاح',
      studentId: student.studentId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Reject Student
app.put('/api/admin/reject-student/:id', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
  try {
    const { reason } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive', active: false },
      { new: true }
    );

    io.to(`student-${student.studentId}`).emit('registration-update', {
      studentId: student.studentId,
      status: 'inactive',
      name: student.name,
      registrationDate: student.registrationDate,
      reason: req.body.reason
    });

    res.json({ message: 'تم رفض طلب التسجيل' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add this endpoint
app.post('/api/student/status', async (req, res) => {
  try {
    const { studentId, parentPhone } = req.body;
    const student = await Student.findOne({ 
      studentId,
      parentPhone 
    });

    if (!student) {
      return res.status(404).json({ error: 'لم يتم العثور على الطالب' });
    }

    // Subscribe client to updates for this student
    const socketId = req.headers['socket-id'];
    if (socketId && io.sockets.sockets[socketId]) {
      io.sockets.sockets[socketId].join(`student-${studentId}`);
    }

    res.json({
      name: student.name,
      studentId: student.studentId,
      status: student.status,
      registrationDate: student.registrationDate,
      academicYear: student.academicYear
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe-to-status', (studentId) => {
    socket.join(`student-${studentId}`);
    console.log(`Client subscribed to student ${studentId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// create student account for ta3limi by user id 
// req student id 

// Add these routes to your backend (server.js or routes file)

// Get all student accounts with filtering
// Get all student accounts with filtering
app.get('/api/student-accounts', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
try {
  const { status, search } = req.query;
  const query = { role: 'student' };

  if (status) query.active = status === 'active';
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } }
    ];
  }

  const accounts = await StudentAccount.find(query)
    .select('-password')
    .populate('student', 'name studentId parentPhone parentEmail academicYear');

  res.json(accounts);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});
// Create student account
app.post('/api/student-accounts', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
  const { studentId, username, password, email } = req.body;

  try {
    // Validate required fields
    if (!studentId || !username || !password) {
      return res.status(400).json({ error: 'يجب إدخال جميع الحقول المطلوبة' });
    }

    // Check if student exists
    const student = await Student.findOne({ _id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // Check if account already exists
    const existingAccount = await StudentAccount.findOne({ 
      $or: [{ username }, { studentId: student.studentId }] 
    });
    
    if (existingAccount) {
      return res.status(400).json({ 
        error: 'اسم المستخدم أو حساب الطالب موجود بالفعل' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create account
    const newAccount = new StudentAccount({
      username,
      password: hashedPassword,
      fullName: student.name,
      studentId: student.studentId,
      student: student._id,
      email: email || student.parentEmail,
      role: 'student'
    });

    await newAccount.save();

    // Update student record to mark as having account
    student.hasAccount = true;
    await student.save();

    res.status(201).json({
      message: 'تم إنشاء حساب الطالب بنجاح',
      account: {
        _id: newAccount._id,
        username: newAccount.username,
        studentId: newAccount.studentId,
        studentName: student.name
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Delete student account
app.delete('/api/student-accounts/:id', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
  try {
    const account = await StudentAccount.findByIdAndDelete(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'الحساب غير موجود' });
    }

    // Update student record to mark as no account
    await Student.updateOne(
      { studentId: account.studentId },
      { $set: { hasAccount: false } }
    );

    res.json({ message: 'تم حذف الحساب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset password
app.put('/api/student-accounts/:id/reset-password', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
  const { password } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ error: 'يجب إدخال كلمة مرور جديدة' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const account = await StudentAccount.findByIdAndUpdate(
      req.params.id,
      { password: hashedPassword },
      { new: true }
    ).select('-password');

    if (!account) {
      return res.status(404).json({ error: 'الحساب غير موجود' });
    }

    res.json({ 
      message: 'تم تحديث كلمة المرور بنجاح',
      account
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle account status (active/inactive)
app.put('/api/student-accounts/:id/toggle-status', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
  try {
    const account = await StudentAccount.findById(req.params.id);
    
    if (!account) {
      return res.status(404).json({ error: 'الحساب غير موجود' });
    }

    account.active = !account.active;
    await account.save();

    res.json({ 
      message: `تم ${account.active ? 'تفعيل' : 'تعطيل'} الحساب بنجاح`,
      account
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Login Route
app.post('/api/student/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const studentAccount = await StudentAccount.findOne({ username });

    if (!studentAccount || !(await bcrypt.compare(password, studentAccount.password))) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { 
        id: studentAccount._id, 
        username: studentAccount.username, 
        role: studentAccount.role,
        studentId: studentAccount.studentId
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ 
      token, 
      user: { 
        username: studentAccount.username,
        role: studentAccount.role,
        fullName: studentAccount.fullName,
        studentId: studentAccount.studentId
      } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Student Data
app.get('/api/student/data', authenticate(['student', 'secretary', 'admin','accountant']), async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.user.studentId })
      .populate({
        path: 'classes',
        populate: [
          { path: 'teacher', model: 'Teacher' },
          { path: 'schedule.classroom', model: 'Classroom' }
        ]
      });

    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // Get upcoming classes (next 7 days)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const upcomingClasses = [];
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    
    student.classes.forEach(cls => {
      cls.schedule.forEach(session => {
        const dayIndex = days.indexOf(session.day);
        if (dayIndex >= 0) {
          const classDate = new Date(today);
          const daysToAdd = (dayIndex - today.getDay() + 7) % 7;
          classDate.setDate(today.getDate() + daysToAdd);
          
          if (classDate >= today && classDate <= nextWeek) {
            const [hours, minutes] = session.time.split(':').map(Number);
            classDate.setHours(hours, minutes, 0, 0);
            
            upcomingClasses.push({
              classId: cls._id,
              className: cls.name,
              subject: cls.subject,
              teacher: cls.teacher.name,
              day: session.day,
              time: session.time,
              classroom: session.classroom?.name || 'غير محدد',
              date: classDate,
              formattedDate: classDate.toLocaleDateString('ar-EG')
            });
          }
        }
      });
    });

    // Sort by date
    upcomingClasses.sort((a, b) => a.date - b.date);

    // Get payment status
    const payments = await Payment.find({ 
      student: student._id 
    }).populate('class').sort({ month: -1 });

    res.json({
      student: {
        name: student.name,
        studentId: student.studentId,
        academicYear: student.academicYear,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        parentEmail: student.parentEmail
      },
      upcomingClasses,
      payments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Change Password
app.post('/api/student/change-password', authenticate(['student','student', 'secretary', 'admin','accountant']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const studentAccount = await StudentAccount.findById(req.user.id);

    if (!(await bcrypt.compare(currentPassword, studentAccount.password))) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    studentAccount.password = await bcrypt.hash(newPassword, 10);
    await studentAccount.save();

    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/student/status/:studentId', async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });
    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }
    res.json({
      status: student.status,
      active: student.active,
      name: student.name,
      registrationDate: student.registrationDate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


initializeRFIDReader();

// Main application entry point
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Admin dashboard
app.get('/admin', authenticate(['admin','student', 'secretary', 'admin','accountant']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Teacher dashboard
app.get('/teacher', authenticate(['teacher','student', 'secretary', 'admin','accountant']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
});

// Student routes
app.get('/student', (req, res) => {
  res.redirect('/student/login');
});

app.get('/student/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student-register.html'));
});

app.get('/student/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student-login.html'));
});

app.get('/student/dashboard', authenticate(['student', 'secretary', 'admin','accountant']), (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

// Accounting Login Route
app.post('/api/accounting/login', async (req, res) => {
try {
  const { username, password } = req.body;
  const user = await User.findOne({ username, role: { $in: ['admin', 'accountant'] } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ 
    token, 
    user: { 
      username: user.username, 
      role: user.role, 
      fullName: user.fullName 
    } 
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});


// Employee Management Routes
// Get all staff members (employees)
app.get('/api/employees', async (req, res) => {
try {
  const employees = await User.find({ 
    role: { $in: ['admin', 'secretary', 'accountant'] } 
  }).select('-password');
  res.json(employees);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Add new employee
app.post('/api/employees', async (req, res) => {
try {
  const { username, password, role, fullName, phone, email } = req.body;
  
  if (!['admin', 'secretary', 'accountant'].includes(role)) {
    return res.status(400).json({ error: 'الدور غير صالح للموظف' });
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ error: 'اسم المستخدم موجود مسبقا' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    username,
    password: hashedPassword,
    role,
    fullName,
    phone,
    email
  });

  await user.save();

  res.status(201).json({
    _id: user._id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email
  });
} catch (err) {
  res.status(400).json({ error: err.message });
}
});
// Expense categories
const EXPENSE_CATEGORIES = [
'rent', 'utilities', 'supplies', 'maintenance', 
'marketing', 'salaries', 'other'
];

// Get expense categories
app.get('/api/accounting/expense-categories', authenticate(['admin', 'accountant']), (req, res) => {
res.json(EXPENSE_CATEGORIES);
});

// Add expense with validation
app.post('/api/accounting/expenses', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { description, amount, category, paymentMethod, date } = req.body;
  
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: 'فئة المصروف غير صحيحة' });
  }
  
  const expense = new Expense({
    description,
    amount: parseFloat(amount),
    category,
    paymentMethod: paymentMethod || 'cash',
    date: date ? new Date(date) : new Date(),
    receiptNumber: `EXP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    recordedBy: req.user.id
  });
  
  await expense.save();
  
  // Record financial transaction
  const transaction = new FinancialTransaction({
    type: 'expense',
    amount: expense.amount,
    description: expense.description,
    category: expense.category,
    recordedBy: req.user.id,
    reference: expense._id
  });
  await transaction.save();
  
  res.status(201).json(expense);
} catch (err) {
  res.status(400).json({ error: err.message });
}
});

// Monthly expense report
app.get('/api/accounting/expense-report', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { year, month } = req.query;
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const expenses = await Expense.aggregate([
    {
      $match: {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const totalExpenses = expenses.reduce((sum, item) => sum + item.total, 0);
  
  res.json({
    expenses,
    totalExpenses,
    period: `${year}-${month.toString().padStart(2, '0')}`
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Financial dashboard data
app.get('/api/accounting/dashboard', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { year } = req.query;
  const currentYear = year || new Date().getFullYear();
  
  // Monthly income
  const monthlyIncome = await FinancialTransaction.aggregate([
    {
      $match: {
        type: 'income',
        date: {
          $gte: new Date(`${currentYear}-01-01`),
          $lte: new Date(`${currentYear}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$date' },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  // Monthly expenses
  const monthlyExpenses = await FinancialTransaction.aggregate([
    {
      $match: {
        type: 'expense',
        date: {
          $gte: new Date(`${currentYear}-01-01`),
          $lte: new Date(`${currentYear}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$date' },
        total: { $sum: '$amount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
  
  // Expense by category
  const expensesByCategory = await FinancialTransaction.aggregate([
    {
      $match: {
        type: 'expense',
        date: {
          $gte: new Date(`${currentYear}-01-01`),
          $lte: new Date(`${currentYear}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  // Current month summary
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthIncome = monthlyIncome.find(m => m._id === currentMonth)?.total || 0;
  const currentMonthExpenses = monthlyExpenses.find(m => m._id === currentMonth)?.total || 0;
  
  res.json({
    monthlyIncome,
    monthlyExpenses,
    expensesByCategory,
    currentMonthSummary: {
      income: currentMonthIncome,
      expenses: currentMonthExpenses,
      profit: currentMonthIncome - currentMonthExpenses
    },
    year: currentYear
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});




// ==============================================
// Accounting Routes
// ==============================================

// School Fees (Registration Fees)
app.get('/api/accounting/school-fees', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { status, student } = req.query;
  const query = {};

  if (status) query.status = status;
  if (student) query.student = student;

  const fees = await SchoolFee.find(query)
    .populate('student')
    .populate('recordedBy')
    .sort({ paymentDate: -1 });

  res.json(fees);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

app.post('/api/accounting/school-fees', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { studentId } = req.body;
  
  // Check if student exists
  const student = await Student.findById(studentId);
  if (!student) {
    return res.status(404).json({ error: 'الطالب غير موجود' });
  }

  // Check if fee already paid
  const existingFee = await SchoolFee.findOne({ student: studentId, status: 'paid' });
  if (existingFee) {
    return res.status(400).json({ error: 'تم دفع رسوم التسجيل مسبقاً لهذا الطالب' });
  }

  const fee = new SchoolFee({
    student: studentId,
    amount: 60, // 60 DZD
    recordedBy: req.user.id
  });

  await fee.save();

  res.status(201).json(fee);
} catch (err) {
  res.status(400).json({ error: err.message });
}
});

app.put('/api/accounting/school-fees/:id/pay', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const fee = await SchoolFee.findById(req.params.id).populate('student');
  if (!fee) {
    return res.status(404).json({ error: 'رسوم التسجيل غير موجودة' });
  }

  fee.status = 'paid';
  fee.paymentDate = req.body.paymentDate || new Date();
  fee.paymentMethod = req.body.paymentMethod || 'cash';
  fee.invoiceNumber = `INV-SF-${Date.now()}`;
  fee.recordedBy = req.user.id;

  await fee.save();

  // Create invoice
  const invoice = new Invoice({
    invoiceNumber: fee.invoiceNumber,
    type: 'school-fee',
    recipient: {
      type: 'student',
      id: fee.student._id,
      name: fee.student.name
    },
    items: [{
      description: 'رسوم تسجيل الطالب',
      amount: fee.amount,
      quantity: 1
    }],
    totalAmount: fee.amount,
    status: 'paid',
    paymentMethod: fee.paymentMethod,
    recordedBy: req.user.id
  });
  await invoice.save();

  // Record financial transaction
  const transaction = new FinancialTransaction({
    type: 'income',
    amount: fee.amount,
    description: `رسوم تسجيل الطالب ${fee.student.name}`,
    category: 'tuition',
    recordedBy: req.user.id,
    reference: fee._id
  });
  await transaction.save();

  res.json({
    message: 'تم تسديد رسوم التسجيل بنجاح',
    fee,
    invoiceNumber: fee.invoiceNumber
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Teacher Payments (70% of class fees)
app.get('/api/accounting/teacher-payments', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { teacher, class: classId, student, month, status } = req.query;
  const query = {};

  if (teacher) query.teacher = teacher;
  if (classId) query.class = classId;
  if (student) query.student = student;
  if (month) query.month = month;
  if (status) query.status = status;

  const payments = await TeacherPayment.find(query)
    .populate('teacher')
    .populate('class')
    .populate('student')
    .populate('recordedBy')
    .sort({ month: -1 });

  res.json(payments);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

app.post('/api/accounting/teacher-payments', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { teacherId, classId, studentId, month } = req.body;
  
  // Validate required fields
  if (!teacherId || !classId || !studentId || !month) {
    return res.status(400).json({ error: 'يجب إدخال جميع الحقول المطلوبة' });
  }

  // Check if payment already exists
  const existingPayment = await TeacherPayment.findOne({
    teacher: teacherId,
    class: classId,
    student: studentId,
    month
  });

  if (existingPayment) {
    return res.status(400).json({ error: 'تم تسجيل الدفع مسبقاً لهذا الأستاذ لهذا الشهر' });
  }

  // Get class to calculate teacher's share (70%)
  const classObj = await Class.findById(classId);
  if (!classObj) {
    return res.status(404).json({ error: 'الحصة غير موجودة' });
  }

  const teacherShare = classObj.price * 0.7;

  const payment = new TeacherPayment({
    teacher: teacherId,
    class: classId,
    student: studentId,
    month,
    amount: teacherShare,
    recordedBy: req.user.id
  });

  await payment.save();

  res.status(201).json(payment);
} catch (err) {
  res.status(400).json({ error: err.message });
}
});

app.put('/api/accounting/teacher-payments/:id/pay', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const payment = await TeacherPayment.findById(req.params.id)
    .populate('teacher')
    .populate('class')
    .populate('student');

  if (!payment) {
    return res.status(404).json({ error: 'الدفع غير موجود' });
  }

  payment.status = 'paid';
  payment.paymentDate = req.body.paymentDate || new Date();
  payment.paymentMethod = req.body.paymentMethod || 'cash';
  payment.invoiceNumber = `INV-TP-${Date.now()}`;
  payment.recordedBy = req.user.id;

  await payment.save();

  // Create invoice
  const invoice = new Invoice({
    invoiceNumber: payment.invoiceNumber,
    type: 'teacher',
    recipient: {
      type: 'teacher',
      id: payment.teacher._id,
      name: payment.teacher.name
    },
    items: [{
      description: `حصة الأستاذ من دفعة الطالب ${payment.student.name} لحصة ${payment.class.name} لشهر ${payment.month}`,
      amount: payment.amount,
      quantity: 1
    }],
    totalAmount: payment.amount,
    status: 'paid',
    paymentMethod: payment.paymentMethod,
    recordedBy: req.user.id
  });
  await invoice.save();

  // Record financial transaction (expense - teacher salary)
  const transaction = new FinancialTransaction({
    type: 'expense',
    amount: payment.amount,
    description: `حصة الأستاذ ${payment.teacher.name} من دفعة الطالب ${payment.student.name} لشهر ${payment.month}`,
    category: 'salary',
    recordedBy: req.user.id,
    reference: payment._id
  });
  await transaction.save();

  res.json({
    message: 'تم تسديد حصة الأستاذ بنجاح',
    payment,
    invoiceNumber: payment.invoiceNumber
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Staff Salaries
app.get('/api/accounting/staff-salaries', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { employee, month, status } = req.query;
  const query = {};

  if (employee) query.employee = employee;
  if (month) query.month = month;
  if (status) query.status = status;

  const salaries = await StaffSalary.find(query)
    .populate('employee')
    .populate('recordedBy')
    .sort({ month: -1 });

  res.json(salaries);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

app.post('/api/accounting/staff-salaries', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { employeeId, month, amount } = req.body;
  
  // Validate required fields
  if (!employeeId || !month || !amount) {
    return res.status(400).json({ error: 'يجب إدخال جميع الحقول المطلوبة' });
  }

  // Check if salary already exists for this month
  const existingSalary = await StaffSalary.findOne({
    employee: employeeId,
    month
  });

  if (existingSalary) {
    return res.status(400).json({ error: 'تم تسجيل الراتب مسبقاً لهذا الموظف لهذا الشهر' });
  }

  const salary = new StaffSalary({
    employee: employeeId,
    month,
    amount,
    recordedBy: req.user.id
  });

  await salary.save();

  res.status(201).json(salary);
} catch (err) {
  res.status(400).json({ error: err.message });
}
});

app.put('/api/accounting/staff-salaries/:id/pay', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const salary = await StaffSalary.findById(req.params.id)
    .populate('employee');

  if (!salary) {
    return res.status(404).json({ error: 'الراتب غير موجود' });
  }

  salary.status = 'paid';
  salary.paymentDate = req.body.paymentDate || new Date();
  salary.paymentMethod = req.body.paymentMethod || 'cash';
  salary.invoiceNumber = `INV-SS-${Date.now()}`;
  salary.recordedBy = req.user.id;

  await salary.save();

  // Create invoice
  const invoice = new Invoice({
    invoiceNumber: salary.invoiceNumber,
    type: 'staff',
    recipient: {
      type: 'staff',
      id: salary.employee._id,
      name: salary.employee.fullName
    },
    items: [{
      description: `راتب الموظف لشهر ${salary.month}`,
      amount: salary.amount,
      quantity: 1
    }],
    totalAmount: salary.amount,
    status: 'paid',
    paymentMethod: salary.paymentMethod,
    recordedBy: req.user.id
  });
  await invoice.save();

  // Record financial transaction (expense - staff salary)
  const transaction = new FinancialTransaction({
    type: 'expense',
    amount: salary.amount,
    description: `راتب الموظف ${salary.employee.fullName} لشهر ${salary.month}`,
    category: 'salary',
    recordedBy: req.user.id,
    reference: salary._id
  });
  await transaction.save();

  res.json({
    message: 'تم تسديد الراتب بنجاح',
    salary,
    invoiceNumber: salary.invoiceNumber
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Expenses
app.get('/api/accounting/expenses', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { category, startDate, endDate } = req.query;
  const query = {};

  if (category) query.category = category;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const expenses = await Expense.find(query)
    .populate('recordedBy')
    .sort({ date: -1 });

  res.json(expenses);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

app.post('/api/accounting/expenses', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { description, amount, category, paymentMethod } = req.body;
  
  // Validate required fields
  if (!description || !amount || !category) {
    return res.status(400).json({ error: 'يجب إدخال جميع الحقول المطلوبة' });
  }

  const expense = new Expense({
    description,
    amount,
    category,
    paymentMethod: paymentMethod || 'cash',
    receiptNumber: `EXP-${Date.now()}`,
    recordedBy: req.user.id
  });

  await expense.save();

  // Record financial transaction
  const transaction = new FinancialTransaction({
    type: 'expense',
    amount: expense.amount,
    description: expense.description,
    category: expense.category,
    recordedBy: req.user.id,
    reference: expense._id
  });
  await transaction.save();

  res.status(201).json(expense);
} catch (err) {
  res.status(400).json({ error: err.message });
}
});

// Invoices
app.get('/api/accounting/invoices', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { type, status, startDate, endDate } = req.query;
  const query = {};

  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const invoices = await Invoice.find(query)
    .populate('recordedBy')
    .sort({ date: -1 });

  res.json(invoices);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

app.get('/api/accounting/invoices/:id', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const invoice = await Invoice.findById(req.params.id)
    .populate('recordedBy');

  if (!invoice) {
    return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  }

  // Get recipient details based on type
  let recipientDetails = {};
  if (invoice.recipient.type === 'student') {
    const student = await Student.findById(invoice.recipient.id);
    recipientDetails = {
      name: student?.name,
      id: student?.studentId,
      phone: student?.parentPhone,
      email: student?.parentEmail
    };
  } else if (invoice.recipient.type === 'teacher') {
    const teacher = await Teacher.findById(invoice.recipient.id);
    recipientDetails = {
      name: teacher?.name,
      phone: teacher?.phone,
      email: teacher?.email
    };
  } else if (invoice.recipient.type === 'staff') {
    const staff = await User.findById(invoice.recipient.id);
    recipientDetails = {
      name: staff?.fullName,
      phone: staff?.phone,
      email: staff?.email
    };
  }

  res.json({
    ...invoice.toObject(),
    recipientDetails
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});
// Generate invoice for any payment type
app.get('/api/accounting/invoices/generate/:type/:id', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { type, id } = req.params;
  
  let invoiceData = null;
  
  switch (type) {
    case 'school-fee':
      const fee = await SchoolFee.findById(id).populate('student');
      if (!fee) return res.status(404).json({ error: 'رسوم التسجيل غير موجودة' });
      
      invoiceData = {
        invoiceNumber: fee.invoiceNumber || `INV-SF-${Date.now()}`,
        type: 'school-fee',
        recipient: {
          type: 'student',
          id: fee.student._id,
          name: fee.student.name
        },
        items: [{
          description: 'رسوم تسجيل الطالب',
          amount: fee.amount,
          quantity: 1
        }],
        totalAmount: fee.amount,
        date: fee.paymentDate || new Date(),
        status: fee.status,
        paymentMethod: fee.paymentMethod
      };
      break;
      
    case 'teacher-payment':
      const teacherPayment = await TeacherPayment.findById(id)
        .populate('teacher')
        .populate('student')
        .populate('class');
      
      if (!teacherPayment) return res.status(404).json({ error: 'دفع الأستاذ غير موجود' });
      
      invoiceData = {
        invoiceNumber: teacherPayment.invoiceNumber || `INV-TP-${Date.now()}`,
        type: 'teacher',
        recipient: {
          type: 'teacher',
          id: teacherPayment.teacher._id,
          name: teacherPayment.teacher.name
        },
        items: [{
          description: `حصة الأستاذ من دفعة الطالب ${teacherPayment.student.name} لحصة ${teacherPayment.class.name} لشهر ${teacherPayment.month}`,
          amount: teacherPayment.amount,
          quantity: 1
        }],
        totalAmount: teacherPayment.amount,
        date: teacherPayment.paymentDate || new Date(),
        status: teacherPayment.status,
        paymentMethod: teacherPayment.paymentMethod
      };
      break;
      
    case 'staff-salary':
      const salary = await StaffSalary.findById(id).populate('employee');
      if (!salary) return res.status(404).json({ error: 'الراتب غير موجود' });
      
      invoiceData = {
        invoiceNumber: salary.invoiceNumber || `INV-SS-${Date.now()}`,
        type: 'staff',
        recipient: {
          type: 'staff',
          id: salary.employee._id,
          name: salary.employee.fullName
        },
        items: [{
          description: `راتب الموظف لشهر ${salary.month}`,
          amount: salary.amount,
          quantity: 1
        }],
        totalAmount: salary.amount,
        date: salary.paymentDate || new Date(),
        status: salary.status,
        paymentMethod: salary.paymentMethod
      };
      break;
      
    default:
      return res.status(400).json({ error: 'نوع الفاتورة غير صالح' });
  }
  
  res.json(invoiceData);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});
// Detailed financial report with filtering
app.get('/api/accounting/reports/detailed', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { startDate, endDate, category, type } = req.query;
  const matchStage = {};
  
  // Date filtering
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = new Date(startDate);
    if (endDate) matchStage.date.$lte = new Date(endDate);
  }
  
  // Category and type filtering
  if (category) matchStage.category = category;
  if (type) matchStage.type = type;
  
  const transactions = await FinancialTransaction.find(matchStage)
    .populate('recordedBy')
    .sort({ date: -1 });
  
  // Calculate totals
  const incomeTotal = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const expenseTotal = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Group by category
  const incomeByCategory = {};
  const expenseByCategory = {};
  
  transactions.forEach(transaction => {
    if (transaction.type === 'income') {
      incomeByCategory[transaction.category] = 
        (incomeByCategory[transaction.category] || 0) + transaction.amount;
    } else {
      expenseByCategory[transaction.category] = 
        (expenseByCategory[transaction.category] || 0) + transaction.amount;
    }
  });
  
  res.json({
    summary: {
      income: incomeTotal,
      expenses: expenseTotal,
      profit: incomeTotal - expenseTotal
    },
    incomeByCategory,
    expenseByCategory,
    transactions
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});
// Financial Reports
app.get('/api/accounting/reports/summary', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { year, month } = req.query;
  const matchStage = {};

  if (year) {
    matchStage.date = {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31`)
    };
  }

  if (month) {
    const [year, monthNum] = month.split('-');
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);
    matchStage.date = {
      $gte: startDate,
      $lte: endDate
    };
  }

  // Get income (tuition + school fees)
  const income = await FinancialTransaction.aggregate([
    { $match: { ...matchStage, type: 'income' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Get expenses (teacher payments + staff salaries + other expenses)
  const expenses = await FinancialTransaction.aggregate([
    { $match: { ...matchStage, type: 'expense' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Get teacher payments
  const teacherPayments = await FinancialTransaction.aggregate([
    { $match: { ...matchStage, type: 'expense', category: 'salary' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Get staff salaries
  const staffSalaries = await FinancialTransaction.aggregate([
    { $match: { ...matchStage, type: 'expense', category: 'salary' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  // Get other expenses
  const otherExpenses = await FinancialTransaction.aggregate([
    { $match: { ...matchStage, type: 'expense', category: { $ne: 'salary' } } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  res.json({
    income: income[0]?.total || 0,
    expenses: expenses[0]?.total || 0,
    teacherPayments: teacherPayments[0]?.total || 0,
    staffSalaries: staffSalaries[0]?.total || 0,
    otherExpenses: otherExpenses[0]?.total || 0,
    profit: (income[0]?.total || 0) - (expenses[0]?.total || 0)
  });
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Teacher Payment Reports
app.get('/api/accounting/reports/teacher-payments', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { teacherId, year } = req.query;
  const matchStage = { teacher: mongoose.Types.ObjectId(teacherId) };

  if (year) {
    matchStage.month = { $regex: `^${year}` };
  }

  const payments = await TeacherPayment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { $substr: ['$month', 0, 7] }, // Group by year-month
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  res.json(payments);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

// Student Payment Reports
app.get('/api/accounting/reports/student-payments', authenticate(['admin', 'accountant']), async (req, res) => {
try {
  const { studentId, year } = req.query;
  const matchStage = { student: mongoose.Types.ObjectId(studentId) };

  if (year) {
    matchStage.month = { $regex: `^${year}` };
  }

  const payments = await Payment.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { $substr: ['$month', 0, 7] }, // Group by year-month
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);

  res.json(payments);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});




const PORT = process.env.PORT || 4200;
server.listen(PORT, () => {
console.log(` server is working on : http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason, p) => {
console.error('Unhandled Rejection at:', p, 'reason:', reason);
// application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (err, origin) => {
console.error('Uncaught Exception at:', origin, 'error:', err);
// application specific logging, throwing an error, or other logic here
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
console.error('Uncaught Exception Monitor at:', origin, 'error:', err);
// application specific logging, throwing an error, or other logic here
});

process.on('unhandledRejectionMonitor', (reason, p) => {
console.error('Unhandled Rejection Monitor at:', p, 'reason:', reason);
// application specific logging, throwing an error, or other logic here
});

process.on('warning', (warning) => {
console.error('Warning:', warning);
// application specific logging, throwing an error, or other logic here
});

