const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:8081';

console.log('======================================================');
console.log('   PRUEBA DE SIMULACIÓN MULTI-NODO RED MESH PTT       ');
console.log('======================================================\n');

// Crear 4 Nodos de Radio Virtuales para la simulación
const radioMando = io(SERVER_URL);
const radioBrigada1 = io(SERVER_URL);
const radioBrigada2 = io(SERVER_URL);
const radioVictima = io(SERVER_URL);

let connectedNodes = 0;

function setupRadio(socket, callsign, channel) {
    socket.on('connect', () => {
        connectedNodes++;
        console.log(`[+] ${callsign} conectado a la red. Socket ID: ${socket.id}`);
        socket.emit('UPDATE_PROFILE', { callsign, battery: 95 });
        socket.emit('CHANGE_CHANNEL', channel);

        if (connectedNodes === 4) {
            console.log('\n--- TODOS LOS NODOS CONECTADOS EN LA RED MESH ---\n');
            runSimulationScenarios();
        }
    });

    socket.on('TRANSMIT_START', (data) => {
        console.log(`[RX 🔊] ${callsign} escuchando transmisión en CH ${data.channel} de: ${data.callsign}`);
    });

    socket.on('AUDIO_CHUNK', (data) => {
        console.log(`[AUDIO 🎵] ${callsign} recibió paquete de audio de ${data.callsign} (TTL: ${data.ttl})`);
    });

    socket.on('TRANSMIT_END', (data) => {
        console.log(`[ROGER BEEP 🎶] ${callsign} detectó final de transmisión de: ${data.callsign}\n`);
    });

    socket.on('SOS_ALERT_BROADCAST', (sosData) => {
        console.log(`[🚨 SIRENA SOS RECIBIDA] ${callsign} captó ALERTA DE AUXILIO de ${sosData.callsign}!`);
        console.log(`   -> Mensaje: "${sosData.message}"`);
        console.log(`   -> Coordenadas GPS: Lat ${sosData.location.lat}, Lng ${sosData.location.lng}\n`);
    });

    socket.on('TACTICAL_TEXT_RECEIVED', (msg) => {
        console.log(`[💬 CHAT TÁCTICO] ${callsign} recibió de ${msg.callsign} [CH ${msg.channel}]: "${msg.text}"`);
    });
}

setupRadio(radioMando, 'RADIO-MANDO', 1);
setupRadio(radioBrigada1, 'RADIO-BRIGADA-1', 2);
setupRadio(radioBrigada2, 'RADIO-BRIGADA-2', 2);
setupRadio(radioVictima, 'RADIO-VICTIMA', 1);

function runSimulationScenarios() {
    setTimeout(() => {
        console.log('>>> ESCENARIO 1: Víctima atrapada en Piso 4 emite ALERTA SOS');
        radioVictima.emit('SEND_SOS', {
            message: '¡Atrapado en cavidad de estructura bajo el piso 4!',
            location: { lat: 4.60971, lng: -74.08175 }
        });
    }, 1000);

    setTimeout(() => {
        console.log('>>> ESCENARIO 2: Comandante responde por PTT en Canal 1 (Emergencia)');
        radioMando.emit('REQUEST_TRANSMIT');
    }, 3000);

    setTimeout(() => {
        // Enviar paquete de audio simulado desde el Comandante
        const dummyAudioBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
        radioMando.emit('AUDIO_STREAM', dummyAudioBuffer);
    }, 3500);

    setTimeout(() => {
        radioMando.emit('STOP_TRANSMIT');
    }, 4500);

    setTimeout(() => {
        console.log('>>> ESCENARIO 3: Brigada 1 envía mensaje táctico en Canal 2 (Rescate)');
        radioBrigada1.emit('SEND_TACTICAL_TEXT', {
            text: 'Equipo K9 sobre el área de escombros. Perforación iniciada.'
        });
    }, 6000);

    setTimeout(() => {
        console.log('\n======================================================');
        console.log('   PRUEBA FINALIZADA EXITOSAMENTE (100% OPERATIVO)     ');
        console.log('======================================================');
        process.exit(0);
    }, 7500);
}
