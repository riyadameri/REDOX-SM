const express = require('express');
const bodyParser = require('body-parser');
const { SmartPostPrinter } = require('./printer/smartPost');
const { RongtalUsbPrinter } = require('./printer/rongtalUsb');
const { generateQrCode } = require('./qr/generateQr');
const { StudentInfo } = require('./student/info');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

let printer;

// Initialize printer based on configuration or availability
function initializePrinter() {
    // Example logic to choose printer
    const useSmartPost = true; // This could be based on user settings or environment variables
    if (useSmartPost) {
        printer = new SmartPostPrinter();
    } else {
        printer = new RongtalUsbPrinter();
    }
    printer.initialize();
}

// Endpoint to add a new student and trigger printing
app.post('/students', (req, res) => {
    const { name, studentId } = req.body;

    if (!name || !studentId) {
        return res.status(400).json({ error: 'Name and Student ID are required' });
    }

    const studentInfo = new StudentInfo(name, studentId);
    const qrCode = generateQrCode(studentInfo);

    // Print student information and QR code
    printer.print(studentInfo.formatForPrint(), qrCode)
        .then(() => {
            res.status(200).json({ message: 'Student information printed successfully' });
        })
        .catch(err => {
            console.error('Print error:', err);
            res.status(500).json({ error: 'Failed to print student information' });
        });
});

// Start the application
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    initializePrinter();
});