const QRCode = require('qrcode');

function generateQrCode(studentInfo) {
    const qrData = JSON.stringify(studentInfo);
    const options = {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        width: 300, // Adjust width for professional size
        height: 300 // Adjust height for professional size
    };

    return QRCode.toDataURL(qrData, options)
        .then(url => {
            return url; // Returns the QR code as a data URL
        })
        .catch(err => {
            console.error('Error generating QR code:', err);
            throw err;
        });
}

module.exports = generateQrCode;