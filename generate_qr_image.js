const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '192.168.2.102';
}

const localIp = getLocalIp();
const brainDir = 'C:\\Users\\Carmelo\\.gemini\\antigravity\\brain\\11933ce1-aaea-4875-885d-991409d0afaf';
const publicDir = path.join(__dirname, 'public');

const qrsToGenerate = [
    {
        name: 'qr_emergency.png',
        url: `https://${localIp}/emergency`,
        desc: 'S.O.S. Rescate (HTTPS)'
    },
    {
        name: 'qr_emergency_http.png',
        url: `http://${localIp}:8081/emergency`,
        desc: 'S.O.S. Rescate (HTTP Directo)'
    },
    {
        name: 'qr_radio_rescate.png',
        url: `https://${localIp}`,
        desc: 'Radio Clásica (HTTPS)'
    }
];

async function generateAllQRs() {
    console.log(`[QR Generator] Generando códigos QR de alta resolución (280px) para IP: ${localIp}...`);

    for (const item of qrsToGenerate) {
        const paths = [
            path.join(publicDir, item.name),
            path.join(brainDir, item.name)
        ];

        for (const targetPath of paths) {
            await QRCode.toFile(targetPath, item.url, {
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                width: 280,
                margin: 2
            });
            console.log(`[+] QR (${item.desc} -> ${item.url}) guardado en: ${targetPath}`);
        }
    }
}

generateAllQRs().catch(err => {
    console.error('Error generando QRs:', err);
});
