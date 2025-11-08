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
  const ExcelJS = require('exceljs');
  const app = express();
  const server = require('http').createServer(app);

  const io = socketio(server, {
    cors: {
      origin: "*", // or "*" for development
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
        return 'STU-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      }
    },
    birthDate: Date,
    parentName: String,
    parentPhone: { type: String, required: true },
    parentEmail: { type: String, required: false },
    registrationDate: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
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
      default: 'pending'
    },
    // Add this field to track registration payment
    hasPaidRegistration: { 
      type: Boolean, 
      default: false 
    },
    registrationData: {
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


  // في paymentSchema، أضف حقل العمولة
  const paymentSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: false },
    amount: { type: Number, required: true },
    month: { type: String, required: true },
    paymentDate: { type: Date, default: null },
    status: { type: String, enum: ['paid', 'pending', 'late'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
    invoiceNumber: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // حقل جديد للعمولة
    commissionRecorded: { type: Boolean, default: false },
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherCommission' }
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
    category: { 
        type: String, 
        enum: ['tuition', 'salary', 'rent', 'utilities', 'supplies', 'other', 'registration','refund'],
        required: true 
    },
    date: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reference: String,
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' } // إضافة مرجع للطالب
});
  // Add this near other schemas
  const liveClassSchema = new mongoose.Schema({
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: Date, required: true },
    month: { type: String, default: new Date().toISOString().slice(0, 7), required: true }, // تنسيق: YYYY-MM

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

// دالة لتحديث حقل الشهر تلقائياً قبل حفظ LiveClass
liveClassSchema.pre('save', function(next) {
  if (this.date) {
    const date = new Date(this.date);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    this.month = `${year}-${month}`;
  }
  next();
});


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
  // Budget Schema
  const budgetSchema = new mongoose.Schema({
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { 
      type: String, 
      enum: ['operational', 'salaries', 'development', 'marketing', 'other'],
      required: true 
    },
    description: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actualSpending: { type: Number, default: 0 },
    remainingBudget: { type: Number, default: function() { return this.amount; } }
  }, { timestamps: true });


  // Expense Schema (محدث)
  const expenseSchema = new mongoose.Schema({
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { 
      type: String, 
      enum: ['salary', 'rent', 'utilities', 'supplies', 'maintenance', 'marketing', 'other'],
      required: true 
    },
    type: { type: String, enum: ['teacher_payment', 'staff_salary', 'operational'], required: true },
    recipient: {
      type: { type: String, enum: ['teacher', 'staff', 'other'] },
      id: mongoose.Schema.Types.ObjectId,
      name: String
    },
    date: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
    receiptNumber: String,
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  });

  // Teacher Commission Schema
  const teacherCommissionSchema = new mongoose.Schema({
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    month: { type: String, required: true },
    amount: { type: Number, required: true },
    percentage: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    paymentDate: { type: Date, default: null },
    paymentMethod: { type: String, enum: ['cash', 'bank', 'online'], default: 'cash' },
    receiptNumber: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  });

  // Create models
  const Budget = mongoose.model('Budget', budgetSchema);
  const TeacherCommission = mongoose.model('TeacherCommission', teacherCommissionSchema);
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
  // const authenticate = (roles = []) => {
  //   return (req, res, next) => {
  //     try {
  //       const token = req.headers.authorization?.split(' ')[1];
        
  //       if (!token) {
  //         // For count endpoints, you might want to allow public access
  //         if (req.path.includes('/count')) {
  //           return next();
  //         }
  //         return res.status(401).json({ error: 'غير مصرح بالدخول' });
  //       }
  
  //       const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //       req.user = decoded;
  
  //       if (roles.length && !roles.includes(decoded.role)) {
  //         return res.status(403).json({ error: 'غير مصرح بالوصول لهذه الصلاحية' });
  //       }
  
  //       next();
  //     } catch (err) {
  //       // For count endpoints, allow continuation even if token is invalid
  //       if (req.path.includes('/count')) {
  //         return next();
  //       }
  //       res.status(401).json({ error: 'رمز الدخول غير صالح' });
  //     }
  //   };
  // };


  const authenticate = (roles = []) => {
    return (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ error: 'غير مصرح بالدخول' });
            }
            
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
const optionalAuth = (req, res, next) => {
  try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          req.user = decoded;
      }
      next();
  } catch (err) {
      next(); // استمر حتى لو فشلت المصادقة
  }
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
// Replace this problematic code in /api/students endpoint:
app.get('/api/students', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const { academicYear, active } = req.query;
    const query = { status: 'active' };

    if (academicYear) query.academicYear = academicYear;
    if (active !== undefined) query.active = active === 'true';

    const students = await Student.find(query)
      .populate('classes')
      .sort({ name: 1 });
    
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ObjectId validation middleware
const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'معرف غير صالح' });
  }
  
  next();
};



  //get all students
  // app.get('/api/allstudents',/* authenticate(['admin', 'secretary', 'accountant']), */ ()=>{
  //   try {
  //     const students = Student.find();
  //     res.json(students);
  //   } catch (err) {
  //     res.status(500).json({ error: err.message });
  //   }
  // })




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
      const { name, parentPhone, studentId } = req.body;
      
      // التحقق من وجود طالب بنفس الاسم ورقم هاتف ولي الأمر
      const existingStudent = await Student.findOne({
        name,
        parentPhone
      });
  
      // أو التحقق من وجود طالب بنفس المعرف إذا تم تقديمه
      if (studentId) {
        const existingById = await Student.findOne({ studentId });
        if (existingById) {
          return res.status(200).json({ 
            message: "تم تحديث المعلومات بنجاح",
            student: existingById,
            existed: true
          });
        }
      }
  
      if (existingStudent) {
        return res.status(200).json({ 
          message: "تم تحديث المعلومات بنجاح",
          student: existingStudent,
          existed: true
        });
      }
  
      const student = new Student(req.body);
      await student.save();
      
      // إنشاء رسوم التسجيل فقط إذا كان الطالب نشطاً
      if (req.body.active !== false) {
        const schoolFee = new SchoolFee({
          student: student._id,
          amount: req.body.registrationFee || 600,
          status: 'pending'
        });
        await schoolFee.save();
        
  
      }
      
      res.status(201).json({
        message: "تم إنشاء الطالب بنجاح",
        student,
        existed: false
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  
  
  app.get('/api/accounting/budgets', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { status, category } = req.query;
      const query = {};
      
      if (status) query.status = status;
      if (category) query.category = category;
      
      const budgets = await Budget.find(query)
        .populate('createdBy')
        .sort({ createdAt: -1 });
      
      res.json(budgets);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/accounting/budgets', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { title, amount, category, description, startDate, endDate } = req.body;
      
      const budget = new Budget({
        title,
        amount,
        category,
        description,
        startDate,
        endDate,
        createdBy: req.user.id,
        remainingBudget: amount
      });
      
      await budget.save();
      await budget.populate('createdBy');
      
      res.status(201).json(budget);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  app.put('/api/accounting/budgets/:id', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const budget = await Budget.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      ).populate('createdBy');
      
      if (!budget) {
        return res.status(404).json({ error: 'الميزانية غير موجودة' });
      }
      
      res.json(budget);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  
  // تقرير المصروفات مقابل الميزانية
  app.get('/api/accounting/budget-report', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // الحصول على جميع الميزانيات النشطة
      const budgets = await Budget.find({ 
        status: 'active',
        startDate: { $lte: endDate ? new Date(endDate) : new Date() },
        endDate: { $gte: startDate ? new Date(startDate) : new Date() }
      });
      
      // الحصول على المصروفات في نفس الفترة
      const expenseQuery = { 
        status: 'paid',
        date: {}
      };
      
      if (startDate) expenseQuery.date.$gte = new Date(startDate);
      if (endDate) expenseQuery.date.$lte = new Date(endDate);
      
      const expenses = await Expense.find(expenseQuery);
      
      // تجميع المصروفات حسب الفئة
      const expensesByCategory = {};
      expenses.forEach(expense => {
        if (!expensesByCategory[expense.category]) {
          expensesByCategory[expense.category] = 0;
        }
        expensesByCategory[expense.category] += expense.amount;
      });
      
      // مقارنة مع الميزانية
      const report = budgets.map(budget => {
        const actualSpending = expensesByCategory[budget.category] || 0;
        const remaining = budget.amount - actualSpending;
        const utilizationRate = (actualSpending / budget.amount) * 100;
        
        return {
          budget: budget.toObject(),
          actualSpending,
          remaining,
          utilizationRate,
          status: utilizationRate > 90 ? 'over' : utilizationRate > 75 ? 'warning' : 'good'
        };
      });
      
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/api/accounting/all-transactions', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { type, category, startDate, endDate, status } = req.query;
      const query = {};
  
      if (type) query.type = type;
      if (category) query.category = category;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }
  
      // الحصول على جميع المعاملات المالية
      const transactions = await FinancialTransaction.find(query)
        .populate('recordedBy')
        .sort({ date: -1 });
      
      // الحصول على رسوم التسجيل
      const schoolFeeQuery = {};
      if (status) schoolFeeQuery.status = status;
      if (startDate || endDate) {
        schoolFeeQuery.paymentDate = {};
        if (startDate) schoolFeeQuery.paymentDate.$gte = new Date(startDate);
        if (endDate) schoolFeeQuery.paymentDate.$lte = new Date(endDate);
      }
      
      const schoolFees = await SchoolFee.find(schoolFeeQuery)
        .populate('student')
        .populate('recordedBy')
        .sort({ paymentDate: -1 });
      
      // دمج النتائج مع إضافة حقل للنوع
      const allTransactions = [
        ...transactions.map(t => ({
          _id: t._id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          category: t.category,
          date: t.date,
          recordedBy: t.recordedBy,
          transactionType: 'financial'
        })),
        ...schoolFees.map(f => ({
          _id: f._id,
          type: 'income', // تأكد من أن النوع income
          amount: f.amount,
          description: `رسوم تسجيل الطالب ${f.student?.name || 'غير معروف'}`,
          category: 'registration', // نفس التصنيف المستخدم في المعاملات المالية
          date: f.paymentDate || f.createdAt,
          recordedBy: f.recordedBy,
          status: f.status,
          transactionType: 'schoolFee'
        }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      res.json(allTransactions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  // get monthly atandance for class  using live classes shema

// الحصول على الغيابات الشهرية لحصة معينة
app.get('/api/classes/:classId/monthly-attendance', async (req, res) => {
  try {
      const { classId } = req.params;
      const { month, year } = req.query; // الصيغة: YYYY-MM

      // بناء تاريخ البداية والنهاية للشهر المطلوب
      const targetDate = month && year ? new Date(`${year}-${month}-01`) : new Date();
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

      // البحث عن الحصص الحية للحصة المطلوبة خلال الشهر
      const liveClasses = await LiveClass.find({
          class: classId,
          date: {
              $gte: startOfMonth,
              $lte: endOfMonth
          },
          status: { $in: ['completed', 'ongoing'] }
      })
      .populate('class', 'name subject')
      .populate('teacher', 'name')
      .populate('classroom', 'name')
      .populate({
          path: 'attendance.student',
          select: 'name studentId parentName academicYear'
      });

      if (!liveClasses || liveClasses.length === 0) {
          return res.status(404).json({
              message: 'لا توجد حصص مسجلة لهذه الفترة'
          });
      }

      // تجميع بيانات الطلاب والغيابات
      const studentsMap = new Map();
      const classDetails = {
          name: liveClasses[0].class.name,
          subject: liveClasses[0].class.subject,
          month: targetDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })
      };

      // معالجة كل حصة وجمع بيانات الحضور
      liveClasses.forEach(liveClass => {
          liveClass.attendance.forEach(att => {
              const studentId = att.student._id.toString();
              
              if (!studentsMap.has(studentId)) {
                  studentsMap.set(studentId, {
                      student: {
                          _id: att.student._id,
                          name: att.student.name,
                          studentId: att.student.studentId,
                          parentName: att.student.parentName,
                          academicYear: att.student.academicYear
                      },
                      attendanceRecords: []
                  });
              }

              const studentData = studentsMap.get(studentId);
              studentData.attendanceRecords.push({
                  date: liveClass.date,
                  status: att.status,
                  classTime: liveClass.startTime,
                  teacher: liveClass.teacher.name,
                  classroom: liveClass.classroom.name,
                  notes: liveClass.notes
              });
          });
      });

      // حساب الإحصائيات
      const totalClasses = liveClasses.length;
      const studentsAttendance = Array.from(studentsMap.values()).map(studentData => {
          const presentCount = studentData.attendanceRecords.filter(record => 
              record.status === 'present').length;
          const absentCount = studentData.attendanceRecords.filter(record => 
              record.status === 'absent').length;
          const lateCount = studentData.attendanceRecords.filter(record => 
              record.status === 'late').length;

          const attendanceRate = totalClasses > 0 ? 
              Math.round((presentCount / totalClasses) * 100) : 0;

          return {
              ...studentData,
              statistics: {
                  totalClasses,
                  present: presentCount,
                  absent: absentCount,
                  late: lateCount,
                  attendanceRate
              }
          };
      });

      res.json({
          class: classDetails,
          period: {
              start: startOfMonth,
              end: endOfMonth,
              totalClasses: totalClasses
          },
          students: studentsAttendance,
          summary: {
              totalStudents: studentsAttendance.length,
              averageAttendance: studentsAttendance.length > 0 ?
                  Math.round(studentsAttendance.reduce((sum, student) => 
                      sum + student.statistics.attendanceRate, 0) / studentsAttendance.length) : 0
          }
      });

  } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      res.status(500).json({
          message: 'حدث خطأ أثناء جلب بيانات الغيابات',
          error: error.message
      });
  }
});  // نقطة نهاية جديدة للحصول على تفاصيل الأستاذ مع حصصه ومدفوعاته



// تصدير الغيابات الشهرية إلى Excel
app.get('/api/classes/:classId/monthly-attendance/export', async (req, res) => {
  try {
      const { classId } = req.params;
      const { month } = req.query;

      // جلب البيانات (نفس كود endpoint السابق)
      const attendanceData = await getMonthlyAttendanceData(classId, month);

      // إنشاء workbook جديد
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('الغيابات الشهرية');

      // إضافة headers
      worksheet.columns = [
          { header: 'اسم الطالب', key: 'studentName', width: 25 },
          { header: 'رقم الطالب', key: 'studentId', width: 15 },
          { header: 'الصف', key: 'academicYear', width: 15 },
          { header: 'الحضور', key: 'present', width: 10 },
          { header: 'الغياب', key: 'absent', width: 10 },
          { header: 'التأخير', key: 'late', width: 10 },
          { header: 'نسبة الحضور%', key: 'attendanceRate', width: 15 }
      ];

      // إضافة البيانات
      attendanceData.students.forEach(student => {
          worksheet.addRow({
              studentName: student.student.name,
              studentId: student.student.studentId,
              academicYear: getAcademicYearName(student.student.academicYear),
              present: student.statistics.present,
              absent: student.statistics.absent,
              late: student.statistics.late,
              attendanceRate: student.statistics.attendanceRate
          });
      });

      // إعداد response للتحميل
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_${classId}_${month}.xlsx`);

      // كتابة workbook إلى response
      await workbook.xlsx.write(res);
      res.end();

  } catch (error) {
      console.error('Error exporting attendance:', error);
      res.status(500).json({ message: 'حدث خطأ أثناء التصدير' });
  }
});

// نقطة نهاية جديدة للحصول على غيابات حصة معينة من الحصص الحية
app.get('/api/live-classes/class/:classId/attendance', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ error: 'معرف الحصة غير صالح' });
    }

    // الحصول على بيانات الحصة
    const classObj = await Class.findById(classId)
      .populate('teacher')
      .populate('students');
    
    if (!classObj) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }

    // بناء استعلام للحصص الحية
    const query = { 
      class: classId,
      status: { $in: ['completed', 'ongoing'] }
    };

    // إضافة فلترة التاريخ إذا وجدت
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      // افتراضي: آخر 30 يوم
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.date = { $gte: thirtyDaysAgo };
    }

    // الحصول على الحصص الحية
    const liveClasses = await LiveClass.find(query)
      .populate('attendance.student')
      .populate('classroom')
      .sort({ date: 1, startTime: 1 });

    // ✅ تحقق إذا لم توجد حصص
    if (!liveClasses.length) {
      return res.status(200).json({
        message: 'لا توجد حصص حية لهذه الحصة في الفترة المحددة',
        class: {
          _id: classObj._id,
          name: classObj.name,
          subject: classObj.subject,
          teacher: classObj.teacher?.name
        },
        students: classObj.students.map(student => ({
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          statistics: { present: 0, absent: 0, late: 0 }
        })),
        summary: {
          totalClasses: 0,
          totalStudents: classObj.students.length,
          totalPresent: 0,
          totalAbsent: 0,
          totalLate: 0
        }
      });
    }

    // تجميع بيانات الطلاب
    const studentsData = classObj.students.map(student => {
      const studentStats = {
        present: 0,
        absent: 0,
        late: 0
      };

      // حساب الإحصائيات لكل طالب
      liveClasses.forEach(lc => {
        const attendanceRecord = lc.attendance.find(
          att => att.student._id.toString() === student._id.toString()
        );
        
        if (attendanceRecord) {
          studentStats[attendanceRecord.status]++;
        } else {
          studentStats.absent++; // إذا لم يوجد سجل، يعتبر غائب
        }
      });

      return {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        statistics: studentStats
      };
    });

    // إعداد البيانات للاستجابة
    const responseData = {
      class: {
        _id: classObj._id,
        name: classObj.name,
        subject: classObj.subject,
        teacher: classObj.teacher?.name
      },
      period: startDate && endDate 
        ? `من ${new Date(startDate).toLocaleDateString('ar-EG')} إلى ${new Date(endDate).toLocaleDateString('ar-EG')}`
        : 'آخر 30 يوم',
      liveClasses: liveClasses.map(lc => ({
        _id: lc._id,
        date: lc.date,
        startTime: lc.startTime,
        endTime: lc.endTime,
        classroom: lc.classroom?.name,
        attendance: lc.attendance
      })),
      students: studentsData,
      summary: {
        totalClasses: liveClasses.length,
        totalStudents: classObj.students.length,
        totalPresent: studentsData.reduce((sum, student) => sum + student.statistics.present, 0),
        totalAbsent: studentsData.reduce((sum, student) => sum + student.statistics.absent, 0),
        totalLate: studentsData.reduce((sum, student) => sum + student.statistics.late, 0)
      }
    };

    res.json(responseData);

  } catch (error) {
    console.error('Error fetching class attendance:', error);
    res.status(500).json({ 
      error: 'حدث خطأ أثناء جلب بيانات الحضور',
      message: error.message 
    });
  }
});


// نقطة نهاية لتصدير البيانات إلى Excel
app.get('/api/live-classes/class/:classId/attendance/export', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
      const { classId } = req.params;

      // جلب البيانات (نفس كود النقطة السابقة)
      const attendanceData = await getClassAttendanceData(classId, req.query);

      // إنشاء ملف Excel
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('غيابات الحصة');

      // إضافة العناوين
      worksheet.columns = [
          { header: 'اسم الطالب', key: 'studentName', width: 25 },
          { header: 'رقم الطالب', key: 'studentId', width: 15 }
      ];

      // إضافة تواريخ الحصص كعناوين أعمدة
      attendanceData.liveClasses.forEach((lc, index) => {
          const dateHeader = new Date(lc.date).toLocaleDateString('ar-EG');
          worksheet.columns.push(
              { header: `${dateHeader} (حاضر)`, key: `present_${index}`, width: 12 },
              { header: `${dateHeader} (غائب)`, key: `absent_${index}`, width: 12 },
              { header: `${dateHeader} (متأخر)`, key: `late_${index}`, width: 12 }
          );
      });

      worksheet.columns.push(
          { header: 'إجمالي الحضور', key: 'totalPresent', width: 15 },
          { header: 'إجمالي الغياب', key: 'totalAbsent', width: 15 },
          { header: 'إجمالي التأخير', key: 'totalLate', width: 15 }
      );

      // إضافة البيانات
      attendanceData.students.forEach(student => {
          const rowData = {
              studentName: student.name,
              studentId: student.studentId
          };

          // بيانات كل حصة
          attendanceData.liveClasses.forEach((lc, index) => {
              const attendance = lc.attendance.find(a => a.student._id === student._id);
              rowData[`present_${index}`] = attendance?.status === 'present' ? '✓' : '';
              rowData[`absent_${index}`] = attendance?.status === 'absent' ? '✗' : '';
              rowData[`late_${index}`] = attendance?.status === 'late' ? '⌚' : '';
          });

          // الإجماليات
          rowData.totalPresent = student.statistics.present;
          rowData.totalAbsent = student.statistics.absent;
          rowData.totalLate = student.statistics.late;

          worksheet.addRow(rowData);
      });

      // إعداد الاستجابة للتحميل
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=class_attendance_${classId}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();

  } catch (error) {
      console.error('Error exporting class attendance:', error);
      res.status(500).json({ error: 'حدث خطأ أثناء التصدير' });
  }
});

// دالة مساعدة لجلب بيانات الغيابات
async function getClassAttendanceData(classId, queryParams = {}) {
  const { startDate, endDate } = queryParams;

  const classObj = await Class.findById(classId)
      .populate('teacher')
      .populate('students');

  const query = { 
      class: classId,
      status: { $in: ['completed', 'ongoing'] }
  };

  if (startDate && endDate) {
      query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
      };
  } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query.date = { $gte: thirtyDaysAgo };
  }

  const liveClasses = await LiveClass.find(query)
      .populate('attendance.student')
      .populate('classroom')
      .sort({ date: 1, startTime: 1 });

  const studentsData = classObj.students.map(student => {
      const studentStats = { present: 0, absent: 0, late: 0 };

      liveClasses.forEach(lc => {
          const attendanceRecord = lc.attendance.find(
              att => att.student._id.toString() === student._id.toString()
          );
          
          if (attendanceRecord) {
              studentStats[attendanceRecord.status]++;
          } else {
              studentStats.absent++;
          }
      });

      return {
          _id: student._id,
          name: student.name,
          studentId: student.studentId,
          statistics: studentStats
      };
  });

  return {
      class: {
          _id: classObj._id,
          name: classObj.name,
          subject: classObj.subject,
          teacher: classObj.teacher?.name
      },
      liveClasses: liveClasses.map(lc => ({
          _id: lc._id,
          date: lc.date,
          startTime: lc.startTime,
          endTime: lc.endTime,
          classroom: lc.classroom?.name,
          attendance: lc.attendance
      })),
      students: studentsData,
      summary: {
          totalClasses: liveClasses.length,
          totalStudents: classObj.students.length,
          totalPresent: studentsData.reduce((sum, student) => sum + student.statistics.present, 0),
          totalAbsent: studentsData.reduce((sum, student) => sum + student.statistics.absent, 0),
          totalLate: studentsData.reduce((sum, student) => sum + student.statistics.late, 0)
      }
  };
}


app.get('/api/teachers/:id/details', authenticate(['admin', 'accountant', 'teacher']), async (req, res) => {
  try {
    const teacherId = req.params.id;
    
    // الحصول على بيانات الأستاذ
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'الأستاذ غير موجود' });
    }
    
    // الحصول على جميع حصص الأستاذ
    const classes = await Class.find({ teacher: teacherId })
      .populate('students')
      .populate('schedule.classroom');
    
    // الحصول على عمولات الأستاذ
    const commissions = await TeacherCommission.find({ teacher: teacherId })
      .populate('student')
      .populate('class')
      .sort({ month: -1 });
    
    // الحصول على المدفوعات التي تمت للأستاذ
    const payments = await TeacherPayment.find({ teacher: teacherId })
      .populate('student')
      .populate('class')
      .sort({ paymentDate: -1 });
    
    res.json({
      teacher,
      classes,
      commissions,
      payments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

    app.get('/api/teachers/salaries-summary', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { month } = req.query;
      const query = {};
      if (month) query.month = month;
      
      const teachers = await Teacher.find({ active: true });
      
      let totalPending = 0;
      let totalPaid = 0;
      const teachersSummary = [];
      
      for (const teacher of teachers) {
        // الحصول على عمولات الأستاذ
        const commissionsQuery = { teacher: teacher._id };
        if (month) commissionsQuery.month = month;
        
        const commissions = await TeacherCommission.find(commissionsQuery)
          .populate('class');
        
        // حساب الإجماليات
        const pendingAmount = commissions
          .filter(c => c.status === 'pending')
          .reduce((sum, c) => sum + c.amount, 0);
        
        const paidAmount = commissions
          .filter(c => c.status === 'paid')
          .reduce((sum, c) => sum + c.amount, 0);
        
        totalPending += pendingAmount;
        totalPaid += paidAmount;
        
        // الحصول على عدد الحصص والطلاب
        const classes = await Class.find({ teacher: teacher._id })
          .populate('students');
        
        const studentsCount = classes.reduce((sum, cls) => sum + cls.students.length, 0);
        
        teachersSummary.push({
          id: teacher._id,
          name: teacher.name,
          classesTaught: classes.length,
          studentsCount,
          pendingAmount,
          paidAmount,
          month: month || 'جميع الأشهر'
        });
      }
      
      res.json({
        totalPending,
        totalPaid,
        teachersCount: teachers.length,
        teachers: teachersSummary
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  
  
// endpoint جديد للحصول على مدفوعات الأستاذ
app.get('/api/teachers/:id/payments', authenticate(['admin', 'accountant', 'teacher']), async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = { teacher: req.params.id };
    
    if (status) query.status = status;
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }
    
    const payments = await TeacherPayment.find(query)
      .populate('class')
      .populate('student')
      .sort({ paymentDate: -1 });
    
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// endpoint جديد لدفع راتب الأستاذ
app.post('/api/teachers/:id/pay-salary', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const { month, paymentMethod, paymentDate } = req.body;
    const teacherId = req.params.id;
    
    // الحصول على جميع عمولات الأستاذ للشهر المحدد
    const commissionsQuery = { 
      teacher: teacherId,
      status: 'pending'
    };
    
    if (month) commissionsQuery.month = month;
    
    const commissions = await TeacherCommission.find(commissionsQuery)
      .populate('class student teacher');
    
    if (commissions.length === 0) {
      return res.status(404).json({ error: 'لا توجد عمولات pending لهذا الأستاذ' });
    }
    
    let totalAmount = 0;
    const paidCommissions = [];
    
    // دفع كل عمولة على حدة
    for (const commission of commissions) {
      totalAmount += commission.amount;
      
      // تحديث حالة العمولة إلى مدفوعة
      commission.status = 'paid';
      commission.paymentDate = paymentDate || new Date();
      commission.paymentMethod = paymentMethod || 'cash';
      commission.recordedBy = req.user.id;
      await commission.save();
      
      // تسجيل المعاملة المالية (مصروف)
      const expense = new Expense({
        description: `راتب الأستاذ ${commission.teacher.name} عن الطالب ${commission.student.name} لشهر ${commission.month}`,
        amount: commission.amount,
        category: 'salary',
        type: 'teacher_payment',
        recipient: {
          type: 'teacher',
          id: commission.teacher._id,
          name: commission.teacher.name
        },
        paymentMethod: paymentMethod || 'cash',
        status: 'paid',
        recordedBy: req.user.id
      });
      await expense.save();
      
      paidCommissions.push({
        commissionId: commission._id,
        amount: commission.amount,
        student: commission.student.name
      });
    }
    
    res.json({
      message: `تم دفع راتب الأستاذ بنجاح بقيمة ${totalAmount} د.ج`,
      totalAmount,
      month: month || 'جميع الأشهر',
      paidCommissions,
      count: commissions.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post('/api/teachers/pay-all-salaries', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const { month, paymentMethod, paymentDate } = req.body;
    
    const teachers = await Teacher.find({ active: true });
    let totalPaid = 0;
    let teachersCount = 0;
    let commissionsCount = 0;
    
    for (const teacher of teachers) {
      // الحصول على عمولات الأستاذ pending
      const commissionsQuery = { 
        teacher: teacher._id,
        status: 'pending'
      };
      
      if (month) commissionsQuery.month = month;
      
      const commissions = await TeacherCommission.find(commissionsQuery)
        .populate('class student teacher');
      
      if (commissions.length === 0) continue;
      
      let teacherTotal = 0;
      
      // دفع كل عمولة على حدة
      for (const commission of commissions) {
        teacherTotal += commission.amount;
        
        // تحديث حالة العمولة إلى مدفوعة
        commission.status = 'paid';
        commission.paymentDate = paymentDate || new Date();
        commission.paymentMethod = paymentMethod || 'cash';
        commission.recordedBy = req.user.id;
        await commission.save();
        
        // تسجيل المعاملة المالية (مصروف)
        const expense = new Expense({
          description: `راتب الأستاذ ${commission.teacher.name} عن الطالب ${commission.student.name} لشهر ${commission.month}`,
          amount: commission.amount,
          category: 'salary',
          type: 'teacher_payment',
          recipient: {
            type: 'teacher',
            id: commission.teacher._id,
            name: commission.teacher.name
          },
          paymentMethod: paymentMethod || 'cash',
          status: 'paid',
          recordedBy: req.user.id
        });
        await expense.save();
        
        commissionsCount++;
      }
      
      totalPaid += teacherTotal;
      teachersCount++;
    }
    
    res.json({
      message: `تم دفع رواتب ${teachersCount} أستاذ بنجاح بإجمالي ${commissionsCount} عمولة بقيمة إجمالية ${totalPaid} د.ج`,
      totalPaid,
      teachersCount,
      commissionsCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة نقطة نهاية جديدة لدفع عمولة فردية
app.post('/api/accounting/teacher-commissions/pay-single', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      const { commissionId, paymentMethod, paymentDate } = req.body;
      
      const commission = await TeacherCommission.findById(commissionId)
          .populate('teacher')
          .populate('student')
          .populate('class');

      if (!commission) {
          return res.status(404).json({ error: 'سجل العمولة غير موجود' });
      }

      if (commission.status === 'paid') {
          return res.status(400).json({ error: 'تم دفع العمولة مسبقاً' });
      }

      commission.status = 'paid';
      commission.paymentDate = paymentDate || new Date();
      commission.paymentMethod = paymentMethod || 'cash';
      commission.receiptNumber = `COMM-${Date.now()}`;
      commission.recordedBy = req.user.id;

      await commission.save();
      
      // تسجيل المصروف
      const expense = new Expense({
          description: `عمولة الأستاذ ${commission.teacher.name} عن الطالب ${commission.student.name} لحصة ${commission.class.name} لشهر ${commission.month}`,
          amount: commission.amount,
          category: 'salary',
          type: 'teacher_payment',
          recipient: {
              type: 'teacher',
              id: commission.teacher._id,
              name: commission.teacher.name
          },
          paymentMethod: commission.paymentMethod,
          receiptNumber: commission.receiptNumber,
          status: 'paid',
          recordedBy: req.user.id
      });

      await expense.save();
      
      // تحديث الرصيد (خصم المبلغ)
      await updateTotalBalance(-commission.amount);

      res.json({
          message: 'تم دفع عمولة الأستاذ بنجاح',
          commission,
          receiptNumber: commission.receiptNumber
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// تحسين نقطة نهاية التقارير
app.get('/api/accounting/reports/financial', authenticate(['admin', 'accountant']), async (req, res) => {
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

      const report = await FinancialTransaction.aggregate([
          { $match: matchStage },
          {
              $group: {
                  _id: {
                      type: '$type',
                      category: '$category'
                  },
                  totalAmount: { $sum: '$amount' },
                  count: { $sum: 1 }
              }
          },
          {
              $project: {
                  type: '$_id.type',
                  category: '$_id.category',
                  totalAmount: 1,
                  count: 1,
                  _id: 0
              }
          }
      ]);

      res.json(report);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


  app.get('/api/students/:id', validateObjectId, authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
    try {
      const student = await Student.findById(req.params.id).populate('classes');
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
      const { name, phone, email } = req.body;
      
      // التحقق من وجود أستاذ بنفس الاسم أو الهاتف أو البريد الإلكتروني
      const existingTeacher = await Teacher.findOne({
        $or: [
          { name },
          { phone },
          { email }
        ]
      });
  
      if (existingTeacher) {
        return res.status(200).json({ 
          message: "تم تحديث المعلومات بنجاح",
          teacher: existingTeacher,
          existed: true
        });
      }
  
      const teacher = new Teacher(req.body);
      await teacher.save();
      
      res.status(201).json({
        message: "تم إنشاء الأستاذ بنجاح",
        teacher,
        existed: false
      });
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
      const { name, subject, teacher, academicYear } = req.body;
      
      // التحقق من وجود حصة بنفس الاسم والمادة والأستاذ والسنة الدراسية
      const existingClass = await Class.findOne({
        name,
        subject,
        teacher,
        academicYear
      });
  
      if (existingClass) {
        return res.status(200).json({ 
          message: "تم تحديث المعلومات بنجاح",
          class: existingClass,
          existed: true
        });
      }
  
      const classObj = new Class(req.body);
      await classObj.save();
      
      res.status(201).json({
        message: "تم إنشاء الحصة بنجاح",
        class: classObj,
        existed: false
      });
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

  // API للتسجيل الجماعي للطالب في عدة حصص
// API للتسجيل الجماعي للطالب في عدة حصص
app.post('/api/students/:studentId/enroll-multiple', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
      const { classIds } = req.body;
      
      const studentId = req.params.studentId;

      // التحقق من وجود الطالب
      const student = await Student.findById(studentId);
      if (!student) {
          return res.status(404).json({ error: 'الطالب غير موجود' });
      }

      const results = {
          successful: [],
          failed: []
      };

      // تسجيل الطالب في كل حصة على حدة
      for (const classId of classIds) {
          try {
              const classObj = await Class.findById(classId);
              if (!classObj) {
                  results.failed.push({
                      classId: classId,
                      error: 'الحصة غير موجودة'
                  });
                  continue;
              }

              // التحقق من توافق السنة الدراسية
              const isAcademicYearMatch = (
                  !classObj.academicYear || 
                  classObj.academicYear === 'NS' || 
                  classObj.academicYear === 'غير محدد' ||
                  classObj.academicYear === student.academicYear
              );

              if (!isAcademicYearMatch) {
                  results.failed.push({
                      classId: classId,
                      className: classObj.name,
                      error: `عدم تطابق السنة الدراسية (الحصة: ${classObj.academicYear}, الطالب: ${student.academicYear})`
                  });
                  continue;
              }

              // التحقق إذا كان الطالب مسجلاً مسبقاً
              const isEnrolled = classObj.students.includes(studentId);
              if (isEnrolled) {
                  results.failed.push({
                      classId: classId,
                      className: classObj.name,
                      error: 'الطالب مسجل مسبقاً في هذه الحصة'
                  });
                  continue;
              }

              // إضافة الطالب للحصة
              classObj.students.push(studentId);
              await classObj.save();

              // إضافة الحصة للطالب
              if (!student.classes.includes(classId)) {
                  student.classes.push(classId);
              }

              // إنشاء مدفوعات شهرية
              const enrollmentDate = new Date();
              const currentDate = moment();
              const endDate = currentDate.clone().add(1, 'year');

              const months = [];
              let currentDateIter = moment(enrollmentDate);

              while (currentDateIter.isBefore(endDate)) {
                  months.push(currentDateIter.format('YYYY-MM'));
                  currentDateIter.add(1, 'month');
              }

              for (const month of months) {
                  const paymentExists = await Payment.findOne({
                      student: studentId,
                      class: classId,
                      month
                  });

                  if (!paymentExists) {
                      const payment = new Payment({
                          student: studentId,
                          class: classId,
                          amount: classObj.price,
                          month,
                          status: moment(month).isBefore(currentDate, 'month') ? 'late' : 'pending',
                          recordedBy: req.user.id
                      });

                      await payment.save();

                      // تسجيل المعاملة المالية
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

              results.successful.push({
                  classId: classId,
                  className: classObj.name,
                  message: 'تم التسجيل بنجاح'
              });

          } catch (error) {
              results.failed.push({
                  classId: classId,
                  error: error.message
              });
          }
      }

      // حفظ التغييرات على الطالب
      await student.save();

      res.json({
          message: `تم معالجة ${classIds.length} حصة`,
          student: {
              id: student._id,
              name: student.name
          },
          results: results,
          summary: {
              total: classIds.length,
              successful: results.successful.length,
              failed: results.failed.length
          }
      });

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


  // تقرير الغيابات الشهرية لحصة معينة
app.get('/api/live-classes/:classId/monthly-attendance', authenticate(['admin', 'secretary', 'teacher']), async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year } = req.query; // month: 1-12, year: YYYY
    
    if (!month || !year) {
      return res.status(400).json({ error: 'يجب تحديد الشهر والسنة' });
    }

    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    
    // الحصول على الحصة الأساسية
    const classObj = await Class.findById(classId).populate('students');
    if (!classObj) {
      return res.status(404).json({ error: 'الحصة غير موجودة' });
    }

    // الحصول على جميع الحصص الحية لهذا الشهر
    const liveClasses = await LiveClass.find({
      class: classId,
      month: monthStr,
      status: 'completed'
    }).populate('attendance.student');

    // إنشاء هيكل البيانات للتقرير
    const report = {
      class: {
        _id: classObj._id,
        name: classObj.name,
        subject: classObj.subject
      },
      month: monthStr,
      totalClasses: liveClasses.length,
      students: []
    };

    // تهيئة بيانات كل طالب
    classObj.students.forEach(student => {
      const studentData = {
        studentId: student.studentId,
        name: student.name,
        totalAbsent: 0,
        totalPresent: 0,
        totalLate: 0,
        attendanceByDate: {}
      };

      // تهيئة بيانات الحضور لكل تاريخ
      liveClasses.forEach(liveClass => {
        const dateStr = new Date(liveClass.date).toISOString().split('T')[0];
        studentData.attendanceByDate[dateStr] = 'absent'; // افتراضي غائب
        
        // البحث عن سجل الحضور للطالب
        const attendanceRecord = liveClass.attendance.find(
          att => att.student._id.toString() === student._id.toString()
        );
        
        if (attendanceRecord) {
          studentData.attendanceByDate[dateStr] = attendanceRecord.status;
          
          // تحديث الإحصائيات
          if (attendanceRecord.status === 'present') {
            studentData.totalPresent++;
          } else if (attendanceRecord.status === 'late') {
            studentData.totalLate++;
          } else if (attendanceRecord.status === 'absent') {
            studentData.totalAbsent++;
          }
        } else {
          studentData.totalAbsent++;
        }
      });

      report.students.push(studentData);
    });

    // إضافة تواريخ الحصص
    report.classDates = liveClasses.map(lc => 
      new Date(lc.date).toISOString().split('T')[0]
    ).sort();

    res.json(report);
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

// تقرير الغيابات الشهرية لطالب معين
app.get('/api/students/:studentId/monthly-attendance', authenticate(['admin', 'secretary', 'teacher', 'student']), async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ error: 'يجب تحديد الشهر والسنة' });
    }

    const monthStr = `${year}-${month.toString().padStart(2, '0')}`;
    
    // التحقق من صلاحية المستخدم (الطالب يمكنه رؤية بياناته فقط)
    if (req.user.role === 'student' && req.user.studentId !== studentId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول لهذه البيانات' });
    }

    // الحصول على بيانات الطالب
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // الحصول على جميع الحصص الحية للطالب في هذا الشهر
    const liveClasses = await LiveClass.find({
      month: monthStr,
      status: 'completed',
      'class': { $in: student.classes }
    })
    .populate('class')
    .populate('attendance.student');

    // تجميع البيانات
    const report = {
      student: {
        _id: student._id,
        name: student.name,
        studentId: student.studentId,
        academicYear: student.academicYear
      },
      month: monthStr,
      attendanceByClass: {},
      summary: {
        totalClasses: 0,
        totalPresent: 0,
        totalAbsent: 0,
        totalLate: 0,
        attendanceRate: 0
      }
    };

    // معالجة كل حصة
    liveClasses.forEach(liveClass => {
      const classId = liveClass.class._id.toString();
      
      if (!report.attendanceByClass[classId]) {
        report.attendanceByClass[classId] = {
          class: {
            _id: liveClass.class._id,
            name: liveClass.class.name,
            subject: liveClass.class.subject
          },
          attendance: []
        };
      }

      // البحث عن سجل الحضور للطالب
      const attendanceRecord = liveClass.attendance.find(
        att => att.student._id.toString() === studentId
      );

      const status = attendanceRecord ? attendanceRecord.status : 'absent';
      const dateStr = new Date(liveClass.date).toLocaleDateString('ar-EG');
      
      report.attendanceByClass[classId].attendance.push({
        date: liveClass.date,
        dateString: dateStr,
        status: status,
        liveClassId: liveClass._id
      });

      // تحديث الإحصائيات
      report.summary.totalClasses++;
      if (status === 'present') report.summary.totalPresent++;
      else if (status === 'absent') report.summary.totalAbsent++;
      else if (status === 'late') report.summary.totalLate++;
    });

    // حساب نسبة الحضور
    if (report.summary.totalClasses > 0) {
      report.summary.attendanceRate = Math.round(
        (report.summary.totalPresent / report.summary.totalClasses) * 100
      );
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
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



  // في ملف الخادم (server.js أو app.js)
app.put('/api/payments/:id/cancel', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      const payment = await Payment.findById(req.params.id);
      
      if (!payment) {
          return res.status(404).json({ error: 'الدفعة غير موجودة' });
      }

      if (payment.status !== 'paid') {
          return res.status(400).json({ error: 'لا يمكن إلغاء دفعة غير مسددة' });
      }

      // تحديث حالة الدفعة
      payment.status = 'pending';
      payment.paymentDate = null;
      payment.paymentMethod = null;
      payment.recordedBy = req.user.id;
      
      await payment.save();

      // تسجيل معاملة مالية عكسية (إذا كان النظام يحتفظ بسجل للمعاملات)
      const reverseTransaction = new FinancialTransaction({
          type: 'expense',
          amount: payment.amount,
          description: `إلغاء دفعة - ${payment.student.name} - ${payment.class.name} - ${payment.month}`,
          category: 'refund',
          recordedBy: req.user.id,
          reference: payment._id
      });
      await reverseTransaction.save();

      res.json({ 
          message: 'تم إلغاء الدفعة بنجاح',
          payment: payment
      });

  } catch (err) {
      console.error('Error canceling payment:', err);
      res.status(500).json({ error: err.message });
  }
});

// Payments - Delete a payment
app.delete('/api/payments/:id', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const paymentId = req.params.id;

    // Optional: Check if the payment exists first
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'الدفعة غير موجودة' });
    }

    // Optional: Add logic to handle related records (e.g., reverse teacher commission)
    // For example, if a commission was recorded, you might want to delete or mark it as cancelled
    if (payment.commissionId) {
      // Example: Delete the commission record
      // await TeacherCommission.findByIdAndDelete(payment.commissionId);
      // Or mark it as cancelled:
      await TeacherCommission.findByIdAndUpdate(payment.commissionId, { status: 'cancelled' });
    }

    // Delete the payment
    await Payment.findByIdAndDelete(paymentId);

    // Alternatively, you might want to soft delete by updating status:
    // await Payment.findByIdAndUpdate(paymentId, { status: 'cancelled' });

    res.json({ message: 'تم حذف الدفعة بنجاح' });
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ error: err.message });
  }
});
  // Payments
// Payments - Update the GET endpoint to populate class data
// Update the GET /api/payments endpoint
// نقطة نهاية جديدة لعد المدفوعات
app.get('/api/payments/count', async (req, res) => {
  try {
      const { status } = req.query;
      const query = {};
      
      if (status) query.status = status;
      
      const count = await Payment.countDocuments(query);
      res.json({ count, status: 'success' });
  } catch (error) {
      res.status(500).json({ error: 'Failed to count payments', status: 'error' });
  }
});
// Get multiple payments by IDs (for printing multiple receipts)
// Get multiple payments by IDs (for printing multiple receipts)
app.post('/api/payments/bulk', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const { paymentIds } = req.body;
    
    if (!paymentIds || !Array.isArray(paymentIds)) {
      return res.status(400).json({ error: 'يجب تقديم مصفوفة من معرّفات الدفعات' });
    }

    const payments = await Payment.find({ _id: { $in: paymentIds } })
      .populate('student')
      .populate({
        path: 'class',
        populate: [
          { path: 'teacher', model: 'Teacher' },
          { path: 'schedule.classroom', model: 'Classroom' }
        ]
      })
      .populate('recordedBy')
      .sort({ paymentDate: -1 });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  // Register Payment
  // Register Payment - FIXED VERSION
  // Enhanced payment registration with teacher share calculation
  // تحديث مسار تسجيل الدفع
// Register Payment - FIXED VERSION - Update to return populated data
app.put('/api/payments/:id/pay', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('student')
      .populate({
        path: 'class',
        populate: [
          { path: 'teacher', model: 'Teacher' },
          { path: 'schedule.classroom', model: 'Classroom' }
        ]
      });

    if (!payment) {
      return res.status(404).json({ error: 'الدفعة غير موجودة' });
    }

    payment.status = 'paid';
    payment.paymentDate = req.body.paymentDate || new Date();
    payment.paymentMethod = req.body.paymentMethod || 'cash';
    payment.recordedBy = req.user.id;
    payment.invoiceNumber = `INV-${Date.now()}`;

    await payment.save();
    
    // تسجيل المعاملة المالية (إيراد)
    const transaction = new FinancialTransaction({
      type: 'income',
      amount: payment.amount,
      description: `دفعة شهرية لطالب ${payment.student.name} في حصة ${payment.class.name} لشهر ${payment.month}`,
      category: 'tuition',
      recordedBy: req.user.id,
      reference: payment._id
    });
    await transaction.save();
    
    // إذا لم يتم تسجيل عمولة للأستاذ بعد، قم بتسجيلها
    if (!payment.commissionRecorded && payment.class.teacher) {
      // الحصول على نسبة العمولة من إعدادات الأستاذ أو استخدام القيمة الافتراضية
      const commissionPercentage = payment.class.teacher.salaryPercentage || 0.7;
      const commissionAmount = payment.amount * commissionPercentage;
      
      const commission = new TeacherCommission({
        teacher: payment.class.teacher._id,
        student: payment.student._id,
        class: payment.class._id,
        month: payment.month,
        amount: commissionAmount,
        percentage: commissionPercentage * 100,
        status: 'pending', // وضع pending حتى يتم الدفع
        recordedBy: req.user.id
      });
      
      await commission.save();
      
      // تحديث سجل الدفع لتوثيق تسجيل العمولة
      payment.commissionRecorded = true;
      payment.commissionId = commission._id;
      await payment.save();
      
      // إشعار المحاسب بوجود عمولة جديدة需要 الدفع
      io.emit('new-commission', { 
        commissionId: commission._id,
        teacher: payment.class.teacher.name,
        amount: commissionAmount,
        month: payment.month
      });
    }

    // Get the updated payment with populated data
    const updatedPayment = await Payment.findById(req.params.id)
      .populate('student')
      .populate({
        path: 'class',
        populate: [
          { path: 'teacher', model: 'Teacher' },
          { path: 'schedule.classroom', model: 'Classroom' }
        ]
      })
      .populate('recordedBy');

    res.json({
      message: `تم تسديد الدفعة بنجاح`,
      payment: updatedPayment,
      invoiceNumber: payment.invoiceNumber
    });
  } catch (err) {
    console.error('Payment registration error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments',  async (req, res) => {
  try {
    const { student, class: classId, month, status } = req.query;
    const query = {};

    if (student) query.student = student;
    if (classId) query.class = classId;
    if (month) query.month = month;
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('student')
      .populate({
        path: 'class',
        populate: [
          { path: 'teacher', model: 'Teacher' },
          { path: 'schedule.classroom', model: 'Classroom' }
        ]
      })
      .populate('recordedBy')
      .sort({ month: 1 });
    
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  // Generate Invoice
// Generate Invoice - Update to populate class data
app.get('/api/payments/:id', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('student')
      .populate({
        path: 'class',
        populate: [
          { path: 'teacher', model: 'Teacher' },
          { path: 'schedule.classroom', model: 'Classroom' }
        ]
      })
      .populate('recordedBy');

    if (!payment) {
      return res.status(404).json({ error: 'الدفعة غير موجودة' });
    }

    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id/amount
app.put('/api/payments/:id/amount', async (req, res) => {
  try {
      const { amount } = req.body;
      const payment = await Payment.findByIdAndUpdate(
          req.params.id,
          { amount },
          { new: true }
      ).populate('student').populate('class');
      
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
        hasPaidRegistration: false, // Default to not paid
        registrationDate: new Date()
      });
  
      await student.save();
      
      // Create a pending school fee record
      const schoolFee = new SchoolFee({
        student: student._id,
        amount: 600, // 600 DZD
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



  // Main application entry point
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
  app.get('cards-auth',(req,res)=>{
    res.sendFile(path.join(__dirname, 'public', 'cards-auth.html'));
  })
  app.get('dore',(req,res)=>{
    res.sendFile(path.join(__dirname, 'public', 'dore.html'));
  })
  

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
  app.get('/accounting', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'accounting.html'));
  });


  app.get('/student/dashboard', authenticate(['student', 'secretary', 'admin','accountant']), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
  });

  // Accounting Login Route
  // إحصائيات اليوم
  app.get('/api/accounting/today-stats', authenticate(['admin', 'accountant', 'secretary']), async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // مدفوعات اليوم
      const todayPayments = await Payment.aggregate([
        {
          $match: {
            paymentDate: {
              $gte: today,
              $lt: tomorrow
            },
            status: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // مصروفات اليوم
      const todayExpenses = await Expense.aggregate([
        {
          $match: {
            date: {
              $gte: today,
              $lt: tomorrow
            },
            status: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      // عمولات اليوم
      const todayCommissions = await TeacherCommission.aggregate([
        {
          $match: {
            paymentDate: {
              $gte: today,
              $lt: tomorrow
            },
            status: 'paid'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);
      
      res.json({
        date: today,
        payments: {
          total: todayPayments[0]?.total || 0,
          count: todayPayments[0]?.count || 0
        },
        expenses: {
          total: todayExpenses[0]?.total || 0,
          count: todayExpenses[0]?.count || 0
        },
        commissions: {
          total: todayCommissions[0]?.total || 0,
          count: todayCommissions[0]?.count || 0
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // إضافة نقطة النهاية المطلوبة
app.get('/api/accounting/teacher-commissions/:id', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const commission = await TeacherCommission.findById(req.params.id)
      .populate('teacher')
      .populate('student')
      .populate('class')
      .populate('recordedBy');

    if (!commission) {
      return res.status(404).json({ error: 'العمولة غير موجودة' });
    }

    res.json(commission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// إضافة نقطة نهاية لدفع عمولة محددة
app.post('/api/accounting/teacher-commissions/:id/pay', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
    const { paymentMethod, paymentDate } = req.body;
    
    const commission = await TeacherCommission.findById(req.params.id)
      .populate('teacher')
      .populate('student')
      .populate('class');

    if (!commission) {
      return res.status(404).json({ error: 'العمولة غير موجودة' });
    }

    if (commission.status === 'paid') {
      return res.status(400).json({ error: 'تم دفع العمولة مسبقاً' });
    }

    commission.status = 'paid';
    commission.paymentDate = paymentDate || new Date();
    commission.paymentMethod = paymentMethod || 'cash';
    commission.recordedBy = req.user.id;

    await commission.save();

    // تسجيل المعاملة المالية (مصروف)
    const expense = new Expense({
      description: `عمولة الأستاذ ${commission.teacher.name} عن الطالب ${commission.student.name} لشهر ${commission.month}`,
      amount: commission.amount,
      category: 'salary',
      type: 'teacher_payment',
      recipient: {
        type: 'teacher',
        id: commission.teacher._id,
        name: commission.teacher.name
      },
      paymentMethod: commission.paymentMethod,
      status: 'paid',
      recordedBy: req.user.id
    });

    await expense.save();

    res.json({
      message: 'تم دفع العمولة بنجاح',
      commission
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



  app.post('/api/accounting/budget', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { type, amount, description } = req.body;
      
      const budget = new Budget({
        type,
        amount,
        description,
        recordedBy: req.user.id
      });

      await budget.save();
      
      // تحديث الرصيد الإجمالي
      await updateTotalBalance(amount);
      
      res.status(201).json(budget);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/accounting/balance', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const balance = await calculateCurrentBalance();
      res.json({ balance });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add expense with validation
  app.post('/api/accounting/expenses', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { description, amount, category, type, recipient, paymentMethod } = req.body;
      
      const expense = new Expense({
        description,
        amount,
        category,
        type,
        recipient,
        paymentMethod: paymentMethod || 'cash',
        receiptNumber: `EXP-${Date.now()}`,
        recordedBy: req.user.id
      });

      await expense.save();
      
      // تحديث الرصيد (خصم المبلغ)
      await updateTotalBalance(-amount);
      
      res.status(201).json(expense);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/accounting/teacher-commissions/pay', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { commissionId, paymentMethod, paymentDate } = req.body;
      
      const commission = await TeacherCommission.findById(commissionId)
        .populate('teacher')
        .populate('student')
        .populate('class');

      if (!commission) {
        return res.status(404).json({ error: 'سجل العمولة غير موجود' });
      }

      if (commission.status === 'paid') {
        return res.status(400).json({ error: 'تم دفع العمولة مسبقاً' });
      }

      commission.status = 'paid';
      commission.paymentDate = paymentDate || new Date();
      commission.paymentMethod = paymentMethod || 'cash';
      commission.receiptNumber = `COMM-${Date.now()}`;
      commission.recordedBy = req.user.id;

      await commission.save();
      
      // تسجيل المصروف
      const expense = new Expense({
        description: `عمولة الأستاذ ${commission.teacher.name} عن الطالب ${commission.student.name} لشهر ${commission.month}`,
        amount: commission.amount,
        category: 'salary',
        type: 'teacher_payment',
        recipient: {
          type: 'teacher',
          id: commission.teacher._id,
          name: commission.teacher.name
        },
        paymentMethod: commission.paymentMethod,
        receiptNumber: commission.receiptNumber,
        status: 'paid',
        recordedBy: req.user.id
      });

      await expense.save();
      
      // تحديث الرصيد (خصم المبلغ)
      await updateTotalBalance(-commission.amount);

      res.json({
        message: 'تم دفع عمولة الأستاذ بنجاح',
        commission,
        receiptNumber: commission.receiptNumber
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
// نقطة نهاية جديدة للحصول على العمولات مجمعة حسب الحصة
app.get('/api/accounting/teacher-commissions-by-class', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      const { teacher, month, status, class: classId } = req.query;
      const matchStage = {};
      
      if (teacher) matchStage.teacher = new mongoose.Types.ObjectId(teacher);
      if (month) matchStage.month = month;
      if (status) matchStage.status = status;
      if (classId) matchStage.class = new mongoose.Types.ObjectId(classId);
      
      const commissionsByClass = await TeacherCommission.aggregate([
          { $match: matchStage },
          {
              $group: {
                  _id: {
                      teacher: '$teacher',
                      class: '$class',
                      month: '$month'
                  },
                  commissions: { $push: '$$ROOT' },
                  totalAmount: { $sum: '$amount' }
              }
          },
          {
              $lookup: {
                  from: 'teachers',
                  localField: '_id.teacher',
                  foreignField: '_id',
                  as: 'teacher'
              }
          },
          {
              $lookup: {
                  from: 'classes',
                  localField: '_id.class',
                  foreignField: '_id',
                  as: 'class'
              }
          },
          {
              $lookup: {
                  from: 'students',
                  localField: 'commissions.student',
                  foreignField: '_id',
                  as: 'studentDetails'
              }
          },
          {
              $project: {
                  'teacher': { $arrayElemAt: ['$teacher', 0] },
                  'class': { $arrayElemAt: ['$class', 0] },
                  'month': '$_id.month',
                  'commissions': {
                      $map: {
                          input: '$commissions',
                          as: 'commission',
                          in: {
                              _id: '$$commission._id',
                              student: {
                                  $arrayElemAt: [
                                      {
                                          $filter: {
                                              input: '$studentDetails',
                                              as: 'student',
                                              cond: { $eq: ['$$student._id', '$$commission.student'] }
                                          }
                                      },
                                      0
                                  ]
                              },
                              amount: '$$commission.amount',
                              percentage: '$$commission.percentage',
                              status: '$$commission.status',
                              paymentDate: '$$commission.paymentDate'
                          }
                      }
                  },
                  'totalAmount': 1
              }
          }
      ]);
      
      res.json(commissionsByClass);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// نقطة نهاية لدفع عمولة حصة محددة
app.post('/api/accounting/teacher-commissions/pay-by-class', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      const { teacherId, classId, month, paymentMethod, paymentDate, percentage } = req.body;
      
      // البحث عن العمولات المعلقة للأستاذ والحصة والشهر المحددين
      const commissions = await TeacherCommission.find({
          teacher: teacherId,
          class: classId,
          month: month,
          status: 'pending'
      }).populate('student teacher class');
      
      if (commissions.length === 0) {
          return res.status(404).json({ error: 'لا توجد عمولات معلقة لهذا الأستاذ في هذه الحصة لهذا الشهر' });
      }
      
      let totalAmount = 0;
      const paidCommissions = [];
      
      // دفع كل عمولة على حدة مع تطبيق النسبة المحددة
      for (const commission of commissions) {
          // إعادة حساب مبلغ العمولة بناءً على النسبة الجديدة إذا تم تغييرها
          const originalPayment = await Payment.findOne({
              student: commission.student._id,
              class: commission.class._id,
              month: commission.month
          });
          
          let commissionAmount = commission.amount;
          if (percentage && percentage != commission.percentage) {
              // إعادة حساب العمولة بناءً على النسبة الجديدة
              commissionAmount = originalPayment.amount * (percentage / 100);
              commission.amount = commissionAmount;
              commission.percentage = percentage;
          }
          
          totalAmount += commissionAmount;
          
          // تحديث حالة العمولة إلى مدفوعة
          commission.status = 'paid';
          commission.paymentDate = paymentDate || new Date();
          commission.paymentMethod = paymentMethod || 'cash';
          commission.recordedBy = req.user.id;
          await commission.save();
          
          // تسجيل المعاملة المالية (مصروف)
          const expense = new Expense({
              description: `عمولة الأستاذ ${commission.teacher.name} عن الطالب ${commission.student.name} لحصة ${commission.class.name} لشهر ${commission.month}`,
              amount: commissionAmount,
              category: 'salary',
              type: 'teacher_payment',
              recipient: {
                  type: 'teacher',
                  id: commission.teacher._id,
                  name: commission.teacher.name
              },
              paymentMethod: paymentMethod || 'cash',
              status: 'paid',
              recordedBy: req.user.id
          });
          await expense.save();
          
          paidCommissions.push({
              student: commission.student.name,
              amount: commissionAmount,
              originalAmount: originalPayment.amount
          });
      }
      
      res.json({
          message: `تم دفع عمولة الحصة بنجاح بقيمة ${totalAmount.toLocaleString()} د.ج`,
          totalAmount,
          month: month,
          paidCommissions,
          count: commissions.length
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});
  app.get('/api/accounting/teacher-commissions', authenticate(['admin', 'accountant', 'teacher']), async (req, res) => {
    try {
      const { teacher, month, status } = req.query;
      const query = {};

      if (teacher) query.teacher = teacher;
      if (month) query.month = month;
      if (status) query.status = status;

      const commissions = await TeacherCommission.find(query)
        .populate('teacher')
        .populate('student')
        .populate('class')
        .populate('recordedBy')
        .sort({ month: -1 });

      res.json(commissions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/api/accounting/reports/financial', authenticate(['admin', 'accountant']), async (req, res) => {
    try {
      const { startDate, endDate, type } = req.query;
      const matchStage = {};
      
      if (startDate || endDate) {
        matchStage.date = {};
        if (startDate) matchStage.date.$gte = new Date(startDate);
        if (endDate) matchStage.date.$lte = new Date(endDate);
      }
      
      if (type) matchStage.type = type;

      // إيرادات (مدفوعات الطلاب)
      const revenueReport = await Payment.aggregate([
        { 
          $match: { 
            status: 'paid',
            paymentDate: matchStage.date || { $exists: true }
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$paymentDate' },
              month: { $month: '$paymentDate' },
              day: { $dayOfMonth: '$paymentDate' }
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // مصروفات
      const expensesReport = await Expense.aggregate([
        { 
          $match: { 
            status: 'paid',
            date: matchStage.date || { $exists: true }
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              day: { $dayOfMonth: '$date' },
              category: '$category'
            },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      // الرصيد الحالي
      const currentBalance = await calculateCurrentBalance();

      res.json({
        revenue: revenueReport,
        expenses: expensesReport,
        currentBalance,
        period: {
          startDate: startDate || await getFirstRecordDate(),
          endDate: endDate || new Date()
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // Fix the balance calculation function
  async function calculateCurrentBalance() {
    try {
      // Get all transactions (both income and expenses)
      const transactions = await FinancialTransaction.aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $cond: [
                  { $eq: ["$type", "income"] },
                  "$amount",
                  { $multiply: ["$amount", -1] }
                ]
              }
            }
          }
        }
      ]);
      
      return transactions[0]?.total || 0;
    } catch (err) {
      console.error('Error calculating balance:', err);
      return 0;
    }
  }

  async function updateTotalBalance(amount) {
    // في نظام حقيقي، قد نريد تخزين الرصيد في collection منفصل
    // للتبسيط، سنحسب الرصيد عند الطلب فقط
    console.log(`Updating balance by: ${amount}`);
  }

  async function getFirstRecordDate() {
    const firstPayment = await Payment.findOne().sort({ paymentDate: 1 });
    const firstExpense = await Expense.findOne().sort({ date: 1 });
    const firstBudget = await Budget.findOne().sort({ date: 1 });
    
    const dates = [];
    if (firstPayment) dates.push(new Date(firstPayment.paymentDate));
    if (firstExpense) dates.push(new Date(firstExpense.date));
    if (firstBudget) dates.push(new Date(firstBudget.date));
    
    return dates.length > 0 ? new Date(Math.min(...dates)) : new Date();
  }
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

// في نقطة نهاية دفع رسوم التسجيل (/api/accounting/school-fees/:id/pay)
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

    // إنشاء فاتورة
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

    // تسجيل المعاملة المالية - هذا هو الجزء الأهم
    const transaction = new FinancialTransaction({
      type: 'income', // يجب أن تكون من نوع income (إيراد)
      amount: fee.amount,
      description: `رسوم تسجيل الطالب ${fee.student.name}`,
      category: 'registration', // تأكد من أن هذا التصنيف موجود
      recordedBy: req.user.id,
      reference: fee._id,
      date: fee.paymentDate // تأكد من وجود تاريخ للمعاملة
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
// في نقطة نهاية دفع رسوم التسجيل (/api/students/:id/pay-registration)
// Mark registration as paid
app.post('/api/students/:id/pay-registration', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const { amount, paymentDate, paymentMethod } = req.body;
    const studentId = req.params.id;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // Update student payment status
    student.hasPaidRegistration = true;
    student.status = 'active'; // Activate student after payment
    student.active = true;
    await student.save();

    // Create a school fee record
    const schoolFee = new SchoolFee({
      student: studentId,
      amount: amount || 600, // 600 DZD default
      paymentDate: paymentDate || new Date(),
      paymentMethod: paymentMethod || 'cash',
      status: 'paid',
      invoiceNumber: `INV-SF-${Date.now()}`,
      recordedBy: req.user.id
    });
    await schoolFee.save();

    // Record financial transaction
    const transaction = new FinancialTransaction({
      type: 'income',
      amount: amount || 600,
      description: `رسوم تسجيل الطالب ${student.name}`,
      category: 'registration',
      recordedBy: req.user.id,
      reference: schoolFee._id
    });
    await transaction.save();

    res.json({
      message: 'تم دفع حقوق التسجيل بنجاح',
      student,
      receiptNumber: schoolFee.invoiceNumber,
      transactionId: transaction._id
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
        const { category, startDate, endDate, type } = req.query;
        const query = {};

        if (category) query.category = category;
        if (type) query.type = type;
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
// إضافة نقطة نهاية جديدة في الخادم
app.get('/api/accounting/summary', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      // حساب الإيرادات (مدفوعات الطلاب)
      const incomeResult = await Payment.aggregate([
          { $match: { status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      // حساب المصروفات
      const expenseResult = await Expense.aggregate([
          { $match: { status: 'paid' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      
      // حساب المدفوعات المعلقة
      const pendingCount = await Payment.countDocuments({ status: 'pending' });
      
      res.json({
          totalIncome: incomeResult[0]?.total || 0,
          totalExpenses: expenseResult[0]?.total || 0,
          pendingPayments: pendingCount
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});

// دالة محسنة باستخدام النقطة الجديدة

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


// Students count endpoint
app.get('/api/students/count', async (req, res) => {
  try {
      const count = await Student.countDocuments({ status: 'active' });
      res.json({ count, status: 'success' });
  } catch (error) {
      res.status(500).json({ error: 'Failed to count students', status: 'error' });
  }
});


// Teachers count endpoint
app.get('/api/teachers/count', async (req, res) => {
  try {
      const count = await Teacher.countDocuments({ active: true });
      res.json({ count, status: 'success' });
  } catch (error) {
      res.status(500).json({ error: 'Failed to count teachers', status: 'error' });
  }
});

// Classes count endpoint
app.get('/api/classes/count', async (req, res) => {
  try {
      const count = await Class.countDocuments({});
      res.json({ count, status: 'success' });
  } catch (error) {
      res.status(500).json({ error: 'Failed to count classes', status: 'error' });
  }
});



// Add the missing transactions endpoint
app.get('/api/accounting/transactions', async (req, res) => {
  try {
      const { limit = 1000, type, category, startDate, endDate } = req.query;
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
          .populate('student')
          .sort({ date: -1 })
          .limit(parseInt(limit));
      
      res.json(transactions);
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
});


// حساب مدخول اليوم
// حساب مدخول اليوم - الإصدار المصحح
app.get('/api/accounting/daily-income',  async (req, res) => {
  try {
    const { date } = req.query;
    
    // استخدام التاريخ المحدد أو تاريخ اليوم
    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      targetDate = new Date();
    }
    
    targetDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date(targetDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`بحث عن دخل يوم: ${targetDate} إلى ${tomorrow}`);

    // 1. حساب مدفوعات الحصص اليومية
    const dailyPayments = await Payment.aggregate([
      {
        $match: {
          paymentDate: {
            $gte: targetDate,
            $lt: tomorrow
          },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          payments: { $push: '$$ROOT' }
        }
      }
    ]);

    // 2. حساب رسوم التسجيل المدفوعة اليوم
    const dailySchoolFees = await SchoolFee.aggregate([
      {
        $match: {
          paymentDate: {
            $gte: targetDate,
            $lt: tomorrow
          },
          status: 'paid'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          fees: { $push: '$$ROOT' }
        }
      }
    ]);

    // 3. حساب الإيرادات الأخرى من المعاملات المالية
    const dailyTransactions = await FinancialTransaction.aggregate([
      {
        $match: {
          date: {
            $gte: targetDate,
            $lt: tomorrow
          },
          type: 'income'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          transactions: { $push: '$$ROOT' }
        }
      }
    ]);

    const paymentsTotal = dailyPayments[0]?.total || 0;
    const feesTotal = dailySchoolFees[0]?.total || 0;
    const otherIncomeTotal = dailyTransactions[0]?.total || 0;
    const totalIncome = paymentsTotal + feesTotal + otherIncomeTotal;

    // الحصول على تفاصيل إضافية للعرض
    const paymentDetails = await Payment.find({
      paymentDate: { $gte: targetDate, $lt: tomorrow },
      status: 'paid' 
    }).populate('student').populate('class').limit(10);

    const feeDetails = await SchoolFee.find({
      paymentDate: { $gte: targetDate, $lt: tomorrow },
      status: 'paid'
    }).populate('student').limit(10);

    res.json({
      success: true,
      dailyIncome: totalIncome,
      date: targetDate.toISOString().split('T')[0],
      formattedDate: targetDate.toLocaleDateString('ar-EG'),
      breakdown: {
        payments: {
          amount: paymentsTotal,
          count: dailyPayments[0]?.count || 0,
          details: paymentDetails
        },
        registrationFees: {
          amount: feesTotal,
          count: dailySchoolFees[0]?.count || 0,
          details: feeDetails
        },
        otherIncome: {
          amount: otherIncomeTotal,
          count: dailyTransactions[0]?.count || 0
        }
      },
      summary: {
        totalAmount: totalIncome,
        totalTransactions: (dailyPayments[0]?.count || 0) + 
                          (dailySchoolFees[0]?.count || 0) + 
                          (dailyTransactions[0]?.count || 0)
      }
    });

  } catch (err) {
    console.error('Error in daily-income endpoint:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      dailyIncome: 0
    });
  }
});
app.get('/api/accounting/weekly-income', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // الأحد كبداية الأسبوع
      
      const weeklyIncome = [];
      let totalWeeklyIncome = 0;
      
      // حساب الدخل لكل يوم من أيام الأسبوع
      for (let i = 0; i < 7; i++) {
          const currentDate = new Date(startOfWeek);
          currentDate.setDate(startOfWeek.getDate() + i);
          
          const dayIncome = await calculateDailyIncome(currentDate.toISOString().split('T')[0]);
          weeklyIncome.push({
              date: currentDate.toISOString().split('T')[0],
              dayName: currentDate.toLocaleDateString('ar-EG', { weekday: 'long' }),
              income: dayIncome.dailyIncome
          });
          
          totalWeeklyIncome += dayIncome.dailyIncome;
      }
      
      res.json({
          weeklyIncome,
          totalWeeklyIncome,
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
      });
  } catch (error) {
      res.status(500).json({ error: 'فشل في حساب الدخل الأسبوعي' });
  }
});

// دالة إضافية للحصول على إحصائيات الدخل للشهر الحالي
app.get('/api/accounting/monthly-income', authenticate(['admin', 'accountant']), async (req, res) => {
  try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      // حساب الدخل الشهري
      const monthlyResult = await Payment.aggregate([
          {
              $match: {
                  paymentDate: {
                      $gte: startOfMonth,
                      $lte: endOfMonth
                  },
                  status: 'paid'
              }
          },
          {
              $group: {
                  _id: null,
                  totalPayments: { $sum: '$amount' }
              }
          }
      ]);
      
      const feesResult = await SchoolFee.aggregate([
          {
              $match: {
                  paymentDate: {
                      $gte: startOfMonth,
                      $lte: endOfMonth
                  },
                  status: 'paid'
              }
          },
          {
              $group: {
                  _id: null,
                  totalFees: { $sum: '$amount' }
              }
          }
      ]);
      
      const otherIncomeResult = await FinancialTransaction.aggregate([
          {
              $match: {
                  date: {
                      $gte: startOfMonth,
                      $lte: endOfMonth
                  },
                  type: 'income',
                  category: { $ne: 'tuition' }
              }
          },
          {
              $group: {
                  _id: null,
                  totalOther: { $sum: '$amount' }
              }
          }
      ]);
      
      const totalMonthlyIncome = 
          (monthlyResult[0]?.totalPayments || 0) +
          (feesResult[0]?.totalFees || 0) +
          (otherIncomeResult[0]?.totalOther || 0);
      
      res.json({
          totalMonthlyIncome,
          payments: monthlyResult[0]?.totalPayments || 0,
          fees: feesResult[0]?.totalFees || 0,
          otherIncome: otherIncomeResult[0]?.totalOther || 0,
          month: today.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })
      });
  } catch (error) {
      res.status(500).json({ error: 'فشل في حساب الدخل الشهري' });
  }
});


// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
      // Check database connection
      await mongoose.connection.db.admin().ping();
      
      res.json({ 
          status: 'OK', 
          timestamp: new Date().toISOString(),
          database: 'connected'
      });
  } catch (error) {
      res.status(500).json({ 
          status: 'ERROR', 
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: error.message 
      });
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

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled Error:', error);
  res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// favicon.ico
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'assets', 'redox-icon.png'));

});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
}); 

