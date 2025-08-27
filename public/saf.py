pconst mongoose = require('mongoose');
const faker = require('faker/locale/ar');
const moment = require('moment');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Database connection successful'))
  .catch(err => console.error("Error connecting to Database:", err));

// Import models
const User = require('./models/User');
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const Classroom = require('./models/Classroom');
const Class = require('./models/Class');
const Attendance = require('./models/Attendance');
const Card = require('./models/Card');
const Payment = require('./models/Payment');
const FinancialTransaction = require('./models/FinancialTransaction');
const LiveClass = require('./models/LiveClass');

// Arabic names and data
faker.locale = 'ar';

// Subjects and academic years
const subjects = ['رياضيات', 'فيزياء', 'علوم', 'لغة عربية', 'لغة فرنسية', 'لغة انجليزية', 'تاريخ', 'جغرافيا', 'فلسفة', 'إعلام آلي'];
const academicYears = ['1AS', '2AS', '3AS', '1MS', '2MS', '3MS', '4MS', '5MS'];
const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

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
        fullName: faker.name.findName(),
        phone: `05${faker.random.number({min: 10000000, max: 99999999})}`,
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
        name: faker.name.findName(),
        subjects: randomItems(subjects, faker.random.number({min: 1, max: 3})),
        phone: `05${faker.random.number({min: 10000000, max: 99999999})}`,
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
      const subject = randomItem(subjects);
      const teacher = randomItem(teachers.filter(t => t.subjects.includes(subject)));
      const academicYear = randomItem(academicYears);
      const price = faker.random.number({min: 30, max: 60}) * 5; // 150-300 KD
      
      // Generate schedule (1-3 sessions per week)
      const scheduleDays = randomItems(days, faker.random.number({min: 1, max: 3}));
      const schedule = scheduleDays.map(day => ({
        day,
        time: `${faker.random.number({min: 8, max: 18})}:${faker.random.arrayElement(['00', '30'])}`,
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
      const academicYear = randomItem(academicYears);
      const studentClasses = randomItems(
        classes.filter(c => c.academicYear === academicYear), 
        faker.random.number({min: 1, max: 4})
      );
      
      const student = new Student({
        name: faker.name.findName(),
        studentId: `STU${faker.random.number({min: 1000, max: 9999})}`,
        birthDate: randomDate(new Date(1995, 0, 1), new Date(2010, 0, 1)),
        parentName: faker.name.findName(),
        parentPhone: `05${faker.random.number({min: 10000000, max: 99999999})}`,
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
        uid: faker.random.uuid().substring(0, 8).toUpperCase(),
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
                         faker.random.arrayElement(['paid', 'paid', 'paid', 'pending', 'late']);
          
          const payment = new Payment({
            student: student._id,
            class: classObj._id,
            amount: classObj.price,
            month,
            status,
            paymentMethod: status === 'paid' ? 
              faker.random.arrayElement(['cash', 'bank', 'online']) : undefined,
            paymentDate: status === 'paid' ? 
              randomDate(new Date(month), new Date()) : null,
            recordedBy: admin._id,
            invoiceNumber: status === 'paid' ? `INV-${faker.random.number({min: 1000, max: 9999})}` : undefined
          });
          await payment.save();

          if (status === 'paid') {
            // Record financial transaction
            const transaction = new FinancialTransaction({
              type: 'income',
              amount: classObj.price,