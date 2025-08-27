// Student Registration
document.addEventListener('DOMContentLoaded', () => {
    const registrationForm = document.getElementById('registrationForm');
    const statusForm = document.getElementById('statusForm');
    const loginForm = document.getElementById('loginForm');
    
    if (registrationForm) {
        registrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(registrationForm);
            const data = Object.fromEntries(formData.entries());
            
            try {
                const response = await fetch('localhost:4200/api/student/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Show success message
                    registrationForm.classList.add('hidden');
                    document.getElementById('registrationResult').classList.remove('hidden');
                    document.getElementById('resultMessage').textContent = 'تم استلام طلب التسجيل بنجاح وسيتم مراجعته من قبل الإدارة.';
                    
                    if (result.studentId) {
                        document.getElementById('studentInfo').classList.remove('hidden');
                        document.getElementById('studentIdDisplay').textContent = result.studentId;
                        document.getElementById('studentNameDisplay').textContent = data.name;
                    }
                } else {
                    alert(result.error || 'حدث خطأ أثناء التسجيل');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('حدث خطأ أثناء الاتصال بالخادم');
            }
        });
    }
    
    // Student Status Check
    if (statusForm) {
        statusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const studentId = document.getElementById('studentId').value;
            const parentPhone = document.getElementById('parentPhone').value;
            
            try {
                const response = await fetch(`localhost:4200/api/student/status/${studentId}`, {
                    method: 'GET'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    statusForm.classList.add('hidden');
                    document.getElementById('statusResult').classList.remove('hidden');
                    
                    document.getElementById('statusName').textContent = result.name;
                    document.getElementById('statusStudentId').textContent = studentId;
                    document.getElementById('statusValue').textContent = getStatusText(result.status);
                    document.getElementById('statusDate').textContent = new Date(result.registrationDate).toLocaleDateString('ar-EG');
                    
                    if (result.status === 'inactive' && result.reason) {
                        document.getElementById('statusReason').classList.remove('hidden');
                        document.getElementById('reasonText').textContent = result.reason;
                    } else {
                        document.getElementById('statusReason').classList.add('hidden');
                    }
                    
                    if (result.status === 'active') {
                        document.getElementById('statusActions').classList.remove('hidden');
                    }
                } else {
                    alert(result.error || 'حدث خطأ أثناء التحقق من الحالة');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('حدث خطأ أثناء الاتصال بالخادم');
            }
        });
    }
    
    // Student Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch('localhost:4200/api/student/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    // Save token and redirect to dashboard
                    localStorage.setItem('studentToken', result.token);
                    localStorage.setItem('studentData', JSON.stringify(result.user));
                    window.location.href = 'student-dashboard.html';
                } else {
                    const errorElement = document.getElementById('loginError');
                    errorElement.textContent = result.error || 'اسم المستخدم أو كلمة المرور غير صحيحة';
                    errorElement.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('حدث خطأ أثناء الاتصال بالخادم');
            }
        });
    }
});

function getStatusText(status) {
    const statusMap = {
        'pending': 'قيد المراجعة',
        'active': 'مفعل',
        'inactive': 'مرفوض',
        'banned': 'محظور'
    };
    return statusMap[status] || status;
}