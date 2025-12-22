// This file exports a unified interface for the printer classes.
// It allows the application to choose between Smart Post and Rongtal printers based on user configuration or availability.

import SmartPostPrinter from './smartPost';
import RongtalUsbPrinter from './rongtalUsb';

const printers = {
    smartPost: new SmartPostPrinter(),
    rongtalUsb: new RongtalUsbPrinter(),
};

export const printStudentInfo = (printerType, studentData) => {
    const printer = printers[printerType];

    if (!printer) {
        throw new Error('Printer type not supported');
    }

    const formattedData = formatStudentData(studentData);
    printer.initialize();
    printer.print(formattedData);
};

const formatStudentData = (studentData) => {
    // Format the student data for printing
    return `
        Name: ${studentData.name}
        Student ID: ${studentData.studentId}
        Additional Info: ${studentData.additionalInfo}
        QR Code: ${studentData.qrCode}
    `;
};