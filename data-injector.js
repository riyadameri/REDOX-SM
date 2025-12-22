const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker/locale/ar'); // Updated faker import
const moment = require('moment');
require('dotenv').config();
const bcrypt = require('bcryptjs');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Database connection successful'))
  .catch(err => console.error("Error connecting to Database:", err));

// Database Models (same as before)
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

// Subjects and academic years
const subjectsList = ['رياضيات', 'فيزياء', 'علوم', 'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'تاريخ', 'جغرافيا', 'فلسفة', 'إعلام آلي'];
const academicYearsList = ['1AS', '2AS', '3AS', '1MS', '2MS', '3MS', '4MS', '5MS'];
const daysList = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

// Helper functions
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomItems = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

// Generate test data
async function generateTestData() {
  try {
    // Clear existing data
    await mongoose.connection.dropDatabase();
    console.log('Database cleared');

    // Create admin user
    const admin = new User({
      username: 'admin',
      password: await bcrypt.hash('admin123', 10),
      role: 'admin',
      fullName: 'مدير النظام',
      phone: '0512345678',
      email: 'admin@school.com',
      active: true
    });
    await admin.save();

    // Create other users
    const users = [];
    const userRoles = ['secretary', 'accountant', 'teacher'];
    
    for (let i = 0; i < 5; i++) {
      const role = i < 3 ? userRoles[i] : randomItem(userRoles);
      const user = new User({
        username: `user${i+1}`,
        password: await bcrypt.hash(`user${i+1}123`, 10),
        role,
        fullName: faker.person.fullName(),
        phone: `05${faker.number.int({min: 10000000, max: 99999999})}`,
        email: faker.internet.email(),
        active: true
      });
      await user.save();
      users.push(user);
    }

    // Create classrooms
    const classrooms = [];
    const classroomNames = ['الصف الأول', 'الصف الثاني', 'الصف الثالث', 'المختبر', 'قاعة الرياضيات', 'قاعة العلوم'];
    
    for (let i = 0; i < 6; i++) {
      const classroom = new Classroom({
        name: classroomNames[i],
        capacity: [25, 25, 25, 20, 30, 30][i],
        location: ['الطابق الأول', 'الطابق الأول', 'الطابق الثاني', 'الطابق الأرضي', 'الطابق الأول', 'الطابق الثاني'][i]
      });
      await classroom.save();
      classrooms.push(classroom);
    }

    // Create teachers
    const teachers = [];
    for (let i = 0; i < 10; i++) {
      const teacher = new Teacher({
        name: faker.person.fullName(),
        subjects: randomItems(subjectsList, faker.number.int({min: 1, max: 3})),
        phone: `05${faker.number.int({min: 10000000, max: 99999999})}`,
        email: faker.internet.email(),
        active: true,
        salaryPercentage: 0.7
      });
      await teacher.save();
      teachers.push(teacher);
    }

    // Create classes
    const classes = [];
    for (let i = 0; i < 15; i++) {
      const subject = randomItem(subjectsList);
      const teacher = randomItem(teachers.filter(t => t.subjects.includes(subject)));
      const academicYear = randomItem(academicYearsList);
      const price = faker.number.int({min: 30, max: 60}) * 5; // 150-300 KD
      
      // Generate schedule (1-3 sessions per week)
      const scheduleDays = randomItems(daysList, faker.number.int({min: 1, max: 3}));
      const schedule = scheduleDays.map(day => ({
        day,
        time: `${faker.number.int({min: 8, max: 18})}:${randomItem(['00', '30'])}`,
        classroom: randomItem(classrooms)._id
      }));

      const classObj = new Class({
        name: `${subject} ${academicYear}`,
        subject,
        description: `حصة ${subject} لطلاب ${academicYear}`,
        schedule,
        academicYear,
        teacher: teacher._id,
        students: [],
        price
      });
      await classObj.save();
      classes.push(classObj);
    }

    // Create students
    const students = [];
    for (let i = 0; i < 100; i++) {
      const academicYear = randomItem(academicYearsList);
      const studentClasses = randomItems(
        classes.filter(c => c.academicYear === academicYear), 
        faker.number.int({min: 1, max: 4})
      );
      
      const student = new Student({
        name: faker.person.fullName(),
        studentId: `STU${faker.number.int({min: 1000, max: 9999})}`,
        birthDate: randomDate(new Date(1995, 0, 1), new Date(2010, 0, 1)),
        parentName: faker.person.fullName(),
        parentPhone: `05${faker.number.int({min: 10000000, max: 99999999})}`,
        parentEmail: faker.internet.email(),
        academicYear,
        classes: studentClasses.map(c => c._id),
        active: true
      });
      await student.save();
      students.push(student);

      // Add student to classes
      for (const classObj of studentClasses) {
        classObj.students.push(student._id);
        await classObj.save();
      }

      // Create RFID card for student
      const card = new Card({
        uid: faker.string.uuid().substring(0, 8).toUpperCase(),
        student: student._id
      });
      await card.save();

      // Create payments for each class
      for (const classObj of studentClasses) {
        const registrationDate = randomDate(new Date(2023, 0, 1), new Date());
        const months = [];
        let currentDate = moment(registrationDate).startOf('month');
        const endDate = moment().add(1, 'year').startOf('month');

        while (currentDate.isBefore(endDate)) {
          months.push(currentDate.format('YYYY-MM'));
          currentDate.add(1, 'month');
        }

        for (const month of months) {
          const status = moment(month).isAfter(moment()) ? 'pending' : 
                         randomItem(['paid', 'paid', 'paid', 'pending', 'late']);
          
          const payment = new Payment({
            student: student._id,
            class: classObj._id,
            amount: classObj.price,
            month,
            status,
            paymentMethod: status === 'paid' ? 
              randomItem(['cash', 'bank', 'online']) : undefined,
            paymentDate: status === 'paid' ? 
              randomDate(new Date(month), new Date()) : null,
            recordedBy: admin._id,
            invoiceNumber: status === 'paid' ? `INV-${faker.number.int({min: 1000, max: 9999})}` : undefined
          });
          await payment.save();

          if (status === 'paid') {
            // Record financial transaction
            const transaction = new FinancialTransaction({
              type: 'income',
              amount: classObj.price,
              description: `دفعة شهرية لطالب ${student.name} في حصة ${classObj.name} لشهر ${month}`,
              category: 'tuition',
              recordedBy: admin._id,
              reference: payment._id,
              date: payment.paymentDate
            });
            await transaction.save();

            // Teacher share transaction
            const teacherTransaction = new FinancialTransaction({
              type: 'expense',
              amount: classObj.price * 0.7,
              description: `حصة الأستاذ من دفعة طالب ${student.name} في حصة ${classObj.name}`,
              category: 'salary',
              recordedBy: admin._id,
              reference: payment._id,
              date: payment.paymentDate
            });
            await teacherTransaction.save();
          }
        }
      }

      // Create attendance records
      for (const classObj of studentClasses) {
        // Get all scheduled dates for this class up to now
        const scheduleDates = [];
        const startDate = moment().subtract(3, 'months');
        const endDate = moment();
        
        let currentDate = startDate.clone();
        while (currentDate.isBefore(endDate)) {
          for (const session of classObj.schedule) {
            if (currentDate.day() === daysList.indexOf(session.day)) {
              const dateTime = moment(currentDate)
                .set('hour', parseInt(session.time.split(':')[0]))
                .set('minute', parseInt(session.time.split(':')[1]));
              
              if (dateTime.isBefore(endDate)) {
                scheduleDates.push(dateTime.toDate());
              }
            }
          }
          currentDate.add(1, 'day');
        }

        // Create attendance records for 70% of sessions
        const attendedSessions = randomItems(scheduleDates, Math.floor(scheduleDates.length * 0.7));
        for (const date of attendedSessions) {
          const attendance = new Attendance({
            student: student._id,
            class: classObj._id,
            date,
            status: randomItem(['present', 'present', 'present', 'late']),
            recordedBy: randomItem(users)._id
          });
          await attendance.save();
        }
      }
    }

    // Create live classes
    for (let i = 0; i < 30; i++) {
      const classObj = randomItem(classes);
      const session = randomItem(classObj.schedule);
      const date = randomDate(new Date(2023, 0, 1), new Date());
      date.setHours(parseInt(session.time.split(':')[0]));
      date.setMinutes(parseInt(session.time.split(':')[1]));
      
      const liveClass = new LiveClass({
        class: classObj._id,
        date,
        startTime: session.time,
        endTime: `${parseInt(session.time.split(':')[0]) + 1}:${session.time.split(':')[1]}`,
        teacher: classObj.teacher,
        classroom: session.classroom,
        status: date > new Date() ? 'scheduled' : 'completed',
        createdBy: admin._id
      });

      // Add attendance for 70% of students
      if (date < new Date()) {
        const studentsInClass = await Student.find({ classes: classObj._id });
        const attendedStudents = randomItems(studentsInClass, Math.floor(studentsInClass.length * 0.7));
        
        liveClass.attendance = attendedStudents.map(student => ({
          student: student._id,
          status: randomItem(['present', 'present', 'present', 'late']),
          joinedAt: randomDate(date, new Date(date.getTime() + 30 * 60000)),
          leftAt: randomDate(new Date(date.getTime() + 45 * 60000), new Date(date.getTime() + 90 * 60000))
        }));
      }

      await liveClass.save();
    }

    // Create some financial transactions (expenses)
    const expenseCategories = ['rent', 'utilities', 'supplies', 'other'];
    for (let i = 0; i < 20; i++) {
      const transaction = new FinancialTransaction({
        type: 'expense',
        amount: faker.number.int({min: 50, max: 500}),
        description: faker.lorem.sentence(),
        category: randomItem(expenseCategories),
        date: randomDate(new Date(2023, 0, 1), new Date()),
        recordedBy: admin._id
      });
      await transaction.save();
    }

    console.log('Test data generation completed successfully!');
    console.log('==========================================');
    console.log('Admin credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('==========================================');
    console.log('Generated data summary:');
    console.log(`- Users: ${1 + users.length} (1 admin + ${users.length} others)`);
    console.log(`- Teachers: ${teachers.length}`);
    console.log(`- Classrooms: ${classrooms.length}`);
    console.log(`- Classes: ${classes.length}`);
    console.log(`- Students: ${students.length}`);
    console.log('==========================================');

    process.exit(0);
  } catch (err) {
    console.error('Error generating test data:', err);
    process.exit(1);
  }
}

// Run the data generation
generateTestData();