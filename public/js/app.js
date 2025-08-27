const socket = io();
const studentForm = document.getElementById('student-form');
const saveStudentBtn = document.getElementById('save-student');
const addStudentBtn = document.getElementById('add-student-btn');
const studentModal = new bootstrap.Modal(document.getElementById('studentModal'));

// Handle RFID detection
socket.on('student-detected', (data) => {
  const rfidResult = document.getElementById('rfid-result');
  rfidResult.innerHTML = `
    <div class="alert alert-success">
      <h4>${data.student.name}</h4>
      <p>Student ID: ${data.student.studentId}</p>
      <p>Card UID: ${data.card.uid}</p>
      <hr>
      <h5>Classes:</h5>
      <ul class="list-group">
        ${data.classes.map(cls => `
          <li class="list-group-item">
            ${cls.name} (${cls.schedule.day} ${cls.schedule.time})
            <span class="badge bg-primary float-end">${cls.price} DH</span>
          </li>
        `).join('')}
      </ul>
      <hr>
      <h5>Payment Status:</h5>
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Month</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.payments.map(payment => `
            <tr class="table-success">
              <td>${payment.month}</td>
              <td>${payment.amount} DH</td>
              <td><span class="badge bg-success">Paid</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
});

socket.on('unknown-card', (data) => {
  const rfidResult = document.getElementById('rfid-result');
  rfidResult.innerHTML = `
    <div class="alert alert-warning">
      <h4>Unknown Card Detected</h4>
      <p>UID: ${data.uid}</p>
      <button class="btn btn-primary" onclick="registerCard('${data.uid}')">
        Register New Card
      </button>
    </div>
  `;
});

// Load students
async function loadStudents() {
  try {
    const response = await fetch('localhost:4200/api/students');
    const students = await response.json();
    
    const studentsTable = document.getElementById('students-table');
    studentsTable.innerHTML = '';
    
    students.forEach(student => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student._id}</td>
        <td>${student.name}</td>
        <td>${student.studentId}</td>
        <td>${student.parentName || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary">Edit</button>
          <button class="btn btn-sm btn-outline-danger">Delete</button>
        </td>
      `;
      studentsTable.appendChild(row);
    });
    
    document.getElementById('student-count').textContent = students.length;
  } catch (err) {
    console.error('Error loading students:', err);
  }
}

// Add student
addStudentBtn.addEventListener('click', () => {
  studentModal.show();
});

saveStudentBtn.addEventListener('click', async () => {
  const studentData = {
    name: document.getElementById('student-name').value,
    studentId: document.getElementById('student-id').value,
    parentName: document.getElementById('parent-name').value,
    parentPhone: document.getElementById('parent-phone').value
  };
  
  try {
    const response = await fetch('localhost:4200/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(studentData)
    });
    
    if (response.ok) {
      studentModal.hide();
      studentForm.reset();
      loadStudents();
    }
  } catch (err) {
    console.error('Error saving student:', err);
  }
});

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.add('d-none');
    });
    
    // Remove active class from all links
    document.querySelectorAll('.nav-link').forEach(navLink => {
      navLink.classList.remove('active');
    });
    
    // Add active class to clicked link
    this.classList.add('active');
    
    // Show corresponding section
    const sectionId = this.getAttribute('data-section');
    document.getElementById(sectionId).classList.remove('d-none');
  });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadStudents();
  // Load other data (teachers, classes, etc.)
});

// Helper function
function registerCard(uid) {
  // Implement card registration logic
  alert(`Register card with UID: ${uid}`);
}