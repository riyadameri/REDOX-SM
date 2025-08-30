export function formatStudentInfo(student) {
    return `اسم الطالب: ${student.name}\n` +
           `رقم الطالب: ${student.studentId}\n` +
           `تاريخ الميلاد: ${student.birthDate}\n` +
           `اسم ولي الأمر: ${student.parentName}\n` +
           `رقم هاتف ولي الأمر: ${student.parentPhone}\n` +
           `السنة الدراسية: ${student.academicYear}\n`;
}

export function formatQrCode(qrCode) {
    return `\n${qrCode}\n`;
}

export function formatHeader(title) {
    return `********** ${title} **********\n`;
}

export function formatFooter() {
    return `\n********** شكراً لزيارتكم **********\n`;
}