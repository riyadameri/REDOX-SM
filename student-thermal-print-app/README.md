# Student Thermal Print App

This project is designed to facilitate the printing of student information on thermal printers, specifically the Smart Post and Rongtal USB printers, using an 80 mm paper size. The application generates professional-sized QR codes for each student, enhancing the printed output.

## Features

- Print student information including name, student ID, and other relevant details.
- Generate professional-sized QR codes for each student.
- Support for Smart Post thermal printers via COM port.
- Support for Rongtal thermal printers via USB.
- Custom formatting for optimal output on 80 mm paper.

## Project Structure

```
student-thermal-print-app
├── src
│   ├── app.js                # Entry point of the application
│   ├── printer
│   │   ├── smartPost.js      # Smart Post printer communication
│   │   ├── rongtalUsb.js     # Rongtal printer communication
│   │   └── index.js          # Unified printer interface
│   ├── qr
│   │   └── generateQr.js     # QR code generation
│   ├── student
│   │   └── info.js           # Student information representation
│   └── utils
│       └── format.js         # Utility functions for formatting
├── package.json               # NPM configuration file
└── README.md                  # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd student-thermal-print-app
   ```

2. Install the dependencies:
   ```
   npm install
   ```

## Usage

1. Start the application:
   ```
   node src/app.js
   ```

2. Add a new student and trigger the print functionality through the application interface.

## Supported Printers

- **Smart Post**: Communicates via COM port.
- **Rongtal**: Communicates via USB.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.