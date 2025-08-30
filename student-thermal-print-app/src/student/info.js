class StudentInfo {
    constructor(name, studentId, additionalInfo) {
        this.name = name;
        this.studentId = studentId;
        this.additionalInfo = additionalInfo || {};
    }

    formatForPrint() {
        let formattedInfo = `Name: ${this.name}\n`;
        formattedInfo += `Student ID: ${this.studentId}\n`;

        for (const [key, value] of Object.entries(this.additionalInfo)) {
            formattedInfo += `${key}: ${value}\n`;
        }

        return formattedInfo;
    }
}

export default StudentInfo;