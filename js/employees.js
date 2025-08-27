document.addEventListener('DOMContentLoaded', async function() {
    // تحميل بيانات الموظفين
    await loadEmployees();

    // إضافة موظف جديد
    document.getElementById('employeeForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await fetch('/api/employees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('تم إضافة الموظف بنجاح');
                $('#addEmployeeModal').modal('hide');
                await loadEmployees();
            } else {
                const error = await response.json();
                alert(`خطأ: ${error.error}`);
            }
        } catch (err) {
            console.error('Error:', err);
            alert('حدث خطأ أثناء إضافة الموظف');
        }
    });
});

async function loadEmployees() {
    try {
        const response = await fetch('/api/employees', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const employees = await response.json();
        const tableBody = document.querySelector('#employeesTable tbody');
        tableBody.innerHTML = '';
        
        employees.forEach(emp => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${emp.name}</td>
                <td>${emp.position}</td>
                <td>${emp.salary.toLocaleString()} د.ك</td>
                <td>${new Date(emp.hireDate).toLocaleDateString('ar-EG')}</td>
                <td>${emp.active ? '<span class="badge bg-success">نشط</span>' : '<span class="badge bg-danger">غير نشط</span>'}</td>
                <td>
                    <button class="btn btn-sm btn-info">تعديل</button>
                    <button class="btn btn-sm btn-danger">حذف</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}