document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('studentToken');
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    
    if (!token || !studentData) {
        window.location.href = 'student-login.html';
        return;
    }
    
    // Initialize dashboard
    initDashboard();
    
    // Navigation
    setupNavigation();
    
    // Load initial data
    loadStudentData();
    loadUpcomingClasses();
    loadRecentPayments();
    
    // Modal setup
    setupModals();
});

function initDashboard() {
    // Set student info in sidebar and header
    const studentData = JSON.parse(localStorage.getItem('studentData'));
    
    document.querySelectorAll('#sidebarStudentName, #headerStudentName, #welcomeStudentName, #profileName').forEach(el => {
        el.textContent = studentData.fullName;
    });
    
    document.querySelectorAll('#sidebarStudentId, #profileStudentId').forEach(el => {
        el.textContent = studentData.studentId;
    });
}

function setupNavigation() {
    // Sidebar navigation
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const contentSections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(navLink => {
                navLink.parentElement.classList.remove('active');
            });
            
            // Add active class to clicked link
            link.parentElement.classList.add('active');
            
            // Hide all content sections
            contentSections.forEach(section => {
                section.classList.add('hidden');
            });
            
            // Show the selected section
            const target = link.getAttribute('href').substring(1);
            document.getElementById(`${target}Section`).classList.remove('hidden');
            
            // Load data for the section if needed
            switch(target) {
                case 'classes':
                    loadClasses();
                    break;
                case 'schedule':
                    loadWeeklySchedule();
                    break;
                case 'payments':
                    loadPayments();
                    break;
                case 'attendance':
                    loadAttendance();
                    break;
                case 'profile':
                    loadProfile();
                    break;
            }
        });
    });
    
    // User dropdown menu
    const userMenuBtn = document.getElementById('userMenuBtn');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', () => {
            dropdownMenu.classList.toggle('hidden');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.add('hidden');
            }
        });
    }
}

async function loadStudentData() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Update student info
            document.getElementById('profileAcademicYear').textContent = getAcademicYearText(data.student.academicYear);
            document.getElementById('profileRegistrationDate').textContent = new Date(data.student.registrationDate).toLocaleDateString('ar-EG');
            document.getElementById('profileParentName').textContent = data.student.parentName;
            document.getElementById('profileParentPhone').textContent = data.student.parentPhone;
            document.getElementById('profileParentEmail').textContent = data.student.parentEmail || 'غير متوفر';
            
            // Update stats
            document.getElementById('classesCount').textContent = data.student.classes?.length || 0;
            
            // Calculate attendance rate (mock data - replace with real data from API)
            const attendanceRate = Math.floor(Math.random() * 30) + 70; // Random between 70-100%
            document.getElementById('attendanceRate').textContent = `${attendanceRate}%`;
            
            // Count pending payments
            const pendingPayments = data.payments?.filter(p => p.status !== 'paid').length || 0;
            document.getElementById('pendingPayments').textContent = pendingPayments;
        } else {
            console.error('Error loading student data:', data.error);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadUpcomingClasses() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.upcomingClasses) {
            const tbody = document.getElementById('upcomingClassesList');
            tbody.innerHTML = '';
            
            data.upcomingClasses.forEach(cls => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${cls.day}</td>
                    <td>${cls.className}</td>
                    <td>${cls.subject}</td>
                    <td>${cls.time}</td>
                    <td>${cls.classroom}</td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadRecentPayments() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.payments) {
            const tbody = document.getElementById('recentPaymentsList');
            tbody.innerHTML = '';
            
            // Get last 5 payments
            const recentPayments = data.payments.slice(0, 5);
            
            recentPayments.forEach(payment => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${payment.month}</td>
                    <td>${payment.class?.name || 'غير محدد'}</td>
                    <td>${payment.amount} د.ك</td>
                    <td><span class="status-badge status-${payment.status}">${getPaymentStatusText(payment.status)}</span></td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadClasses() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.student.classes) {
            const classesGrid = document.getElementById('classesGrid');
            classesGrid.innerHTML = '';
            
            data.student.classes.forEach(cls => {
                const classCard = document.createElement('div');
                classCard.className = 'class-card';
                
                let scheduleHTML = '';
                cls.schedule.forEach(session => {
                    scheduleHTML += `
                        <div class="class-schedule-item">
                            <span>${session.day}</span>
                            <span>${session.time}</span>
                        </div>
                    `;
                });
                
                classCard.innerHTML = `
                    <h3>${cls.name}</h3>
                    <p><strong>المادة:</strong> ${cls.subject}</p>
                    <p><strong>الأستاذ:</strong> ${cls.teacher?.name || 'غير محدد'}</p>
                    <p><strong>السعر الشهري:</strong> ${cls.price} د.ك</p>
                    
                    <div class="class-schedule">
                        <h4>جدول الحصص:</h4>
                        ${scheduleHTML}
                    </div>
                `;
                
                classesGrid.appendChild(classCard);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadWeeklySchedule() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.student.classes) {
            const tbody = document.getElementById('scheduleTableBody');
            tbody.innerHTML = '';
            
            // Group classes by day
            const scheduleByDay = {
                'الأحد': [],
                'الإثنين': [],
                'الثلاثاء': [],
                'الأربعاء': [],
                'الخميس': [],
                'الجمعة': [],
                'السبت': []
            };
            
            data.student.classes.forEach(cls => {
                cls.schedule.forEach(session => {
                    scheduleByDay[session.day].push({
                        className: cls.name,
                        subject: cls.subject,
                        teacher: cls.teacher?.name || 'غير محدد',
                        time: session.time,
                        classroom: session.classroom?.name || 'غير محدد'
                    });
                });
            });
            
            // Sort each day's classes by time
            Object.values(scheduleByDay).forEach(classes => {
                classes.sort((a, b) => {
                    const [aHours, aMinutes] = a.time.split(':').map(Number);
                    const [bHours, bMinutes] = b.time.split(':').map(Number);
                    return (aHours * 60 + aMinutes) - (bHours * 60 + bMinutes);
                });
            });
            
            // Add to table
            Object.entries(scheduleByDay).forEach(([day, classes]) => {
                if (classes.length > 0) {
                    classes.forEach((cls, index) => {
                        const row = document.createElement('tr');
                        if (index === 0) {
                            row.innerHTML = `
                                <td rowspan="${classes.length}">${day}</td>
                                <td>${cls.className}</td>
                                <td>${cls.subject}</td>
                                <td>${cls.teacher}</td>
                                <td>${cls.time}</td>
                                <td>${cls.classroom}</td>
                            `;
                        } else {
                            row.innerHTML = `
                                <td>${cls.className}</td>
                                <td>${cls.subject}</td>
                                <td>${cls.teacher}</td>
                                <td>${cls.time}</td>
                                <td>${cls.classroom}</td>
                            `;
                        }
                        tbody.appendChild(row);
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadPayments() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.payments) {
            const tbody = document.getElementById('paymentsTableBody');
            tbody.innerHTML = '';
            
            // Add year filter options
            const yearFilter = document.getElementById('paymentYearFilter');
            const years = [...new Set(data.payments.map(p => p.month.split('-')[0]))];
            
            years.forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });
            
            // Display all payments initially
            displayFilteredPayments(data.payments);
            
            // Setup filter event listeners
            document.getElementById('paymentStatusFilter').addEventListener('change', () => {
                displayFilteredPayments(data.payments);
            });
            
            yearFilter.addEventListener('change', () => {
                displayFilteredPayments(data.payments);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayFilteredPayments(payments) {
    const statusFilter = document.getElementById('paymentStatusFilter').value;
    const yearFilter = document.getElementById('paymentYearFilter').value;
    
    const filteredPayments = payments.filter(payment => {
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchesYear = yearFilter === 'all' || payment.month.startsWith(yearFilter);
        return matchesStatus && matchesYear;
    });
    
    const tbody = document.getElementById('paymentsTableBody');
    tbody.innerHTML = '';
    
    filteredPayments.forEach(payment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatMonth(payment.month)}</td>
            <td>${payment.class?.name || 'غير محدد'}</td>
            <td>${payment.amount} د.ك</td>
            <td>${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('ar-EG') : '---'}</td>
            <td>${getPaymentMethodText(payment.paymentMethod)}</td>
            <td><span class="status-badge status-${payment.status}">${getPaymentStatusText(payment.status)}</span></td>
            <td>${payment.invoiceNumber || '---'}</td>
        `;
        tbody.appendChild(row);
    });
}

async function loadAttendance() {
    try {
        const token = localStorage.getItem('studentToken');
        const response = await fetch('localhost:4200/api/student/data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.student.classes) {
            // Mock attendance data - replace with real API call
            const mockAttendance = generateMockAttendance(data.student.classes);
            
            // Add class filter options
            const classFilter = document.getElementById('attendanceClassFilter');
            data.student.classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls._id;
                option.textContent = cls.name;
                classFilter.appendChild(option);
            });
            
            // Add month filter options
            const monthFilter = document.getElementById('attendanceMonthFilter');
            const months = [...new Set(mockAttendance.map(a => a.month))];
            
            months.forEach(month => {
                const option = document.createElement('option');
                option.value = month;
                option.textContent = formatMonth(month);
                monthFilter.appendChild(option);
            });
            
            // Display all attendance initially
            displayFilteredAttendance(mockAttendance);
            
            // Setup filter event listeners
            classFilter.addEventListener('change', () => {
                displayFilteredAttendance(mockAttendance);
            });
            
            monthFilter.addEventListener('change', () => {
                displayFilteredAttendance(mockAttendance);
            });
            
            // Calculate and display stats
            updateAttendanceStats(mockAttendance);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayFilteredAttendance(attendance) {
    const classFilter = document.getElementById('attendanceClassFilter').value;
    const monthFilter = document.getElementById('attendanceMonthFilter').value;
    
    const filteredAttendance = attendance.filter(record => {
        const matchesClass = classFilter === 'all' || record.classId === classFilter;
        const matchesMonth = monthFilter === 'all' || record.month === monthFilter;
        return matchesClass && matchesMonth;
    });
    
    const tbody = document.getElementById('attendanceTableBody');
    tbody.innerHTML = '';
    
    filteredAttendance.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(record.date).toLocaleDateString('ar-EG')}</td>
            <td>${record.className}</td>
            <td>${record.subject}</td>
            <td><span class="status-badge status-${record.status}">${getAttendanceStatusText(record.status)}</span></td>
            <td>${record.notes || '---'}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateAttendanceStats(attendance) {
    const total = attendance.length;
    const present = attendance.filter(a => a.status === 'present').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const late = attendance.filter(a => a.status === 'late').length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    
    document.getElementById('totalClasses').textContent = total;
    document.getElementById('presentClasses').textContent = present;
    document.getElementById('absentClasses').textContent = absent;
    document.getElementById('lateClasses').textContent = late;
    document.getElementById('attendancePercentage').textContent = `${percentage}%`;
}

function loadProfile() {
    // Profile data is already loaded in initDashboard and loadStudentData
}

function setupModals() {
    // Change Password Modal
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const closeModal = document.querySelector('.close-modal');
    
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            changePasswordModal.classList.remove('hidden');
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            changePasswordModal.classList.add('hidden');
        });
    }
    
    // Change Password Form
    const changePasswordForm = document.getElementById('changePasswordForm');
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            if (newPassword !== confirmPassword) {
                alert('كلمة المرور الجديدة غير متطابقة');
                return;
            }
            
            try {
                const token = localStorage.getItem('studentToken');
                const response = await fetch('localhost:4200/api/student/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    alert(result.message);
                    changePasswordModal.classList.add('hidden');
                    changePasswordForm.reset();
                } else {
                    alert(result.error || 'حدث خطأ أثناء تغيير كلمة المرور');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('حدث خطأ أثناء الاتصال بالخادم');
            }
        });
    }
}

// Helper functions
function getAcademicYearText(yearCode) {
    const yearMap = {
        '1AS': 'الأولى ثانوي',
        '2AS': 'الثانية ثانوي',
        '3AS': 'الثالثة ثانوي',
        '1MS': 'الأولى متوسط',
        '2MS': 'الثانية متوسط',
        '3MS': 'الثالثة متوسط',
        '4MS': 'الرابعة متوسط',
        '5MS': 'الخامسة متوسط'
    };
    return yearMap[yearCode] || yearCode;
}

function getPaymentStatusText(status) {
    const statusMap = {
        'paid': 'مدفوعة',
        'pending': 'معلقة',
        'late': 'متأخرة'
    };
    return statusMap[status] || status;
}

function getPaymentMethodText(method) {
    const methodMap = {
        'cash': 'نقدي',
        'bank': 'تحويل بنكي',
        'online': 'دفع إلكتروني'
    };
    return methodMap[method] || method;
}

function getAttendanceStatusText(status) {
    const statusMap = {
        'present': 'حاضر',
        'absent': 'غائب',
        'late': 'متأخر'
    };
    return statusMap[status] || status;
}

function formatMonth(month) {
    if (!month) return '';
    const [year, monthNum] = month.split('-');
    const months = [
        'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${months[parseInt(monthNum) - 1]} ${year}`;
}

// Mock data generator for attendance (replace with real API call)
function generateMockAttendance(classes) {
    const attendance = [];
    const statuses = ['present', 'absent', 'late'];
    const notes = [
        '',
        'تأخير 10 دقائق',
        'غياب مبرر',
        'تأخير بدون عذر',
        ''
    ];
    
    // Generate attendance for the last 3 months
    for (let i = 0; i < 3; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        classes.forEach(cls => {
            // 2-4 attendance records per class per month
            const recordsCount = Math.floor(Math.random() * 3) + 2;
            
            for (let j = 0; j < recordsCount; j++) {
                const recordDate = new Date(date);
                recordDate.setDate(Math.floor(Math.random() * 28) + 1);
                
                attendance.push({
                    classId: cls._id,
                    className: cls.name,
                    subject: cls.subject,
                    date: recordDate,
                    month: month,
                    status: statuses[Math.floor(Math.random() * statuses.length)],
                    notes: notes[Math.floor(Math.random() * notes.length)]
                });
            }
        });
    }
    
    return attendance;
}