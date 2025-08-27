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

const { faker } = require('@faker-js/faker/locale/ar'); // or just require('@faker-js/faker')

const app = express();
const server = require('http').createServer(app);
const io = socketio(server);

// Middleware
app.use(cors({
  origin: true, // or specify your client's origin
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

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  birthDate: Date,
  parentName: String,
  parentPhone: String,
  parentEmail: String,
  registrationDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  academicYear: { type: String, enum: ['1AS', '2AS', '3AS', '1MS', '2MS', '3MS', '4MS', '5MS'] },
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }]
}, { strictPopulate: false });

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subjects: [{ type: String, enum: ['رياضيات', 'فيزياء', 'علوم', 'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'تاريخ', 'جغرافيا', 'فلسفة', 'إعلام آلي'] }],
  phone: String,
  email: String,
  hireDate: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  salaryPercentage: { type: Number, default: 0.7 } // 70% من إيرادات الحصة
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
  academicYear: { type: String, enum: ['1AS', '2AS', '3AS', '1MS', '2MS', '3MS', '4MS', '5MS'] },
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

const paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  amount: { type: Number, required: true },
  month: { type: String, required: true }, // YYYY-MM
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
  reference: String // Payment ID or other referencez
});

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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log(' Database connection successful ');
        seedData().then(() => {
      console.log('Seeding complete');
      mongoose.disconnect();
    });
  })
  .catch(err => console.error("err  connecting to Database : ", err));
async function seedData() {
  await Student.deleteMany({});
  await Teacher.deleteMany({});
  await Class.deleteMany({});
  const teachers = [];
  for (let i = 0; i < 10; i++) {
    const teacher = new Teacher({
      name: faker.person.fullName(),
      subjects: faker.helpers.arrayElements(['رياضيات', 'علوم', 'لغة فرنسية'], 2),
      phone: faker.phone.number('+2136########'),
      email: faker.internet.email(),
      hireDate: faker.date.past(),
      salaryPercentage: 0.7
    });
    await teacher.save();
    teachers.push(teacher);
  }



  // إضافة طلاب
  for (let i = 0; i < 100; i++) {
    const student = new Student({
      name: faker.person.fullName(),
      studentId: faker.string.uuid(),
      birthDate: faker.date.birthdate({ min: 10, max: 18, mode: 'age' }),
      parentName: faker.person.fullName(),
      parentPhone: faker.phone.number('+2136########'),
      parentEmail: faker.internet.email(),
      academicYear: '1AS',
      classes: faker.helpers.arrayElements(classes, faker.number.int({ min: 1, max: 3 })).map(c => c._id)
    });
    await student.save();
  }
}
// JWT Authentication Middleware
const authenticate = (roles = []) => {
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

// RFID Reader
let serialPort;
try {
  serialPort = new SerialPort({
    path: process.env.RFID_PORT,
    baudRate: 9600
  });

  const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  parser.on('data', async (data) => {
    if (data.startsWith('UID:')) {
      const uid = data.trim().substring(4).trim();
      console.log('تم الكشف عن البطاقة:', uid);

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
            const smsContent = `تم تسجيل حضور الطالب ${student.name} في حصة ${currentClass.name} في ${now.toLocaleString()}`;

            try {
              await smsGateway.send(student.parentPhone, smsContent);
              await Message.create({
                sender: null, // System message
                recipients: [{ student: student._id, parentPhone: student.parentPhone }],
                class: currentClass._id,
                content: smsContent,
                messageType: 'individual'
              });
            } catch (smsErr) {
              console.error('فشل إرسال الرسالة:', smsErr);
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
        console.error('خطأ في معالجة البطاقة:', err);
        io.emit('card-error', { error: 'حدث خطأ في معالجة البطاقة' });
      }
    }
  });

  serialPort.on('error', err => console.error('خطأ في منفذ RFID:', err));
} catch (err) {
  console.error('فشل في تهيئة قارئ RFID:', err);
}

// Email and SMS Configuration
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
app.get('/api/students', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
  try {
    const { academicYear, active } = req.query;
    const query = {};

    if (academicYear) query.academicYear = academicYear;
    if (active) query.active = active === 'true';

    const students = await Student.find(query).sort({ name: 1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/students/:id', authenticate(['admin', 'secretary', 'accountant']), async (req, res) => {
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
app.post('/api/classes/:classId/enroll/:studentId', authenticate(['admin', 'secretary']), async (req, res) => {
  try {
    // 1. Check if class and student exist
    const classObj = await Class.findById(req.params.classId);
    const student = await Student.findById(req.params.studentId);

    if (!classObj || !student) {
      return res.status(404).json({ error: 'الحصة أو الطالب غير موجود' });
    }

    // 2. Add student to class if not already enrolled
    if (!classObj.students.includes(req.params.studentId)) {
      classObj.students.push(req.params.studentId);
      await classObj.save();
    }

    // 3. Add class to student if not already added
    if (!student.classes.includes(req.params.classId)) {
      student.classes.push(req.params.classId);
      await student.save();
    }

    // 4. Create monthly payments for student
    const startDate = moment(student.registrationDate);
    const currentDate = moment();
    const endDate = currentDate.clone().add(1, 'year');

    const months = [];
    let currentDateIter = startDate.clone();

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
    // Check if card already exists
    const existingCard = await Card.findOne({ uid: req.body.uid });
    if (existingCard) {
      return res.status(400).json({ error: 'البطاقة مسجلة بالفعل لطالب آخر' });
    }

    const card = new Card(req.body);
    await card.save();
    res.status(201).json(card);
  } catch (err) {
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
app.put('/api/payments/:id/pay',  async (req, res) => {
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

    // Calculate teacher's share (70%)
    const teacherShare = payment.amount * 0.7;
    const teacherTransaction = new FinancialTransaction({
      type: 'expense',
      amount: teacherShare,
      description: `حصة الأستاذ من دفعة طالب ${payment.student.name} في حصة ${payment.class.name}`,
      category: 'salary',
      recordedBy: req.user.id,
      reference: payment._id
    });
    await teacherTransaction.save();

    // Send payment confirmation to parent
    const smsContent = `تم تسديد دفعة شهر ${payment.month} بمبلغ ${payment.amount} د.ك لحصة ${payment.class.name}. رقم الفاتورة: ${payment.invoiceNumber}`;

    try {
      await smsGateway.send(payment.student.parentPhone, smsContent);
      await Message.create({
        sender: req.user.id,
        recipients: [{ student: payment.student._id, parentPhone: payment.student.parentPhone }],
        class: payment.class._id,
        content: smsContent,
        messageType: 'payment'
      });
    } catch (smsErr) {
      console.error('فشل إرسال الرسالة:', smsErr);
    }

    res.json({
      message: `تم تسديد الدفعة بنجاح`,
      payment,
            invoiceNumber: payment.invoiceNumber
    });
  } catch (err) {
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

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(` server is working on : http://localhost:${PORT}`);
});
