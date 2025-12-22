document.addEventListener('DOMContentLoaded', async function() {
    // تحميل شهور السنة في الفلتر
    populateMonthFilter();
    
    // تحميل بيانات الرواتب
    await loadSalaries();

    // فلترة الرواتب
    document.getElementById('monthFilter').addEventListener('change', loadSalaries);
    document.getElementById('statusFilter').addEventListener('change', loadSalaries);

    // إنشاء رواتب الشهر
    document.getElementById('generateSalaries').addEventListener('click', async function() {
        if (confirm('هل تريد إنشاء رواتب لجميع الموظفين لهذا الشهر؟')) {
            try {
                const response = await fetch('/api/salaries/generate', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                
                if (response.ok) {
                    alert('تم إنشاء الرواتب بنجاح');
                    await loadSalaries();
                } else {
                    const error = await response.json();
                    alert(`خطأ: ${error.error}`);
                }
            } catch (err) {
                console.error('Error:', err);
                alert('حدث خطأ أثناء إنشاء الرواتب');
            }
        }
    });

    // إظهار/إخفاء حقل المرجع البنكي
    document.querySelector('select[name="paymentMethod"]').addEventListener('change', function() {
        document.getElementById('transactionRefField').style.display = 
            this.value === 'transfer' ? 'block' : 'none';
    });

    // دفع الراتب
    document.getElementById('paySalaryForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        const salaryId = document.getElementById('salaryId').value;
        
        try {
            const response = await fetch(`/api/salaries/${salaryId}/pay`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('تم دفع الراتب بنجاح');
                $('#paySalaryModal').modal('hide');
                await loadSalaries();
            } else {
                const error = await response.json();
                alert(`خطأ: ${error.error}`);
            }
        } catch (err) {
            console.error('Error:', err);
            alert('حدث خطأ أثناء دفع الراتب');
        }
    });
});

function populateMonthFilter() {
    const select = document.getElementById('monthFilter');
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
        
        const option = document.createElement('option');
        option.value = monthYear;
        option.textContent = monthName;
        select.appendChild(option);
    }
}

async function loadSalaries() {
    const month = document.getElementById('monthFilter').value;
    const status = document.getElementById('statusFilter').value;
    let url = '/api/salaries';
    
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (status) params.append('status', status);
    
    if (params.toString()) url += `?${params.toString()}`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const salaries = await response.json();
        const tableBody = document.querySelector('#salariesTable tbody');
        tableBody.innerHTML = '';
        
        salaries.forEach(salary => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${salary.employee.name}</td>
                <td>${salary.month}</td>
                <td>${salary.basicSalary.toLocaleString()}</td>
                <td>${salary.bonuses.toLocaleString()}</td>
                <td>${salary.deductions.toLocaleString()}</td>
                <td>${salary.netSalary.toLocaleString()}</td>
                <td>
                    ${salary.status === 'paid' ? 
                        `<span class="badge bg-success">مدفوع</span>` : 
                        salary.status === 'pending' ? 
                        `<span class="badge bg-warning">معلق</span>` : 
                        `<span class="badge bg-danger">متأخر</span>`}
                </td>
                <td>
                    ${salary.status !== 'paid' ? 
                        `<button class="btn btn-sm btn-primary pay-btn" data-id="${salary._id}">دفع</button>` : 
                        `<span class="text-muted">تم الدفع في ${new Date(salary.paymentDate).toLocaleDateString('ar-EG')}</span>`}
                </td>
            `;
            tableBody.appendChild(row);
        });

        // إضافة حدث لزر الدفع
        document.querySelectorAll('.pay-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.getElementById('salaryId').value = this.getAttribute('data-id');
                $('#paySalaryModal').modal('show');
            });
        });
    } catch (err) {
        console.error('Error loading salaries:', err);
    }
}