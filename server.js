const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');
const qrcode = require('qrcode-terminal');
const selfsigned = require('selfsigned');

const app = express();
const httpServer = http.createServer(app);
let httpsServer = null;

const io = new Server({
    maxHttpBufferSize: 1e7, // 10MB max buffer for audio chunks
    cors: {
        origin: '*',
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true
});

let PORT_HTTP = process.env.PORT || 8081;
let PORT_HTTPS = 8443;

// Servir archivos estáticos de la app web / PWA
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Obtener IPs de las interfaces de red locales (Wi-Fi, Hotspot, LAN)
function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Ignorar IPv6 e interfaces de loopback internas (127.0.0.1)
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({
                    interface: name,
                    address: iface.address
                });
            }
        }
    }
    return addresses;
}

// Endpoint con información de red
app.get('/api/network-info', (req, res) => {
    res.json({
        portHttp: PORT_HTTP,
        portHttps: PORT_HTTPS,
        addresses: getLocalIpAddresses(),
        serverTime: new Date().toISOString()
    });
});

// Ruta directa al Sistema Táctico de Emergencia Profesional
app.get('/emergency', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'emergency.html'));
});

// Capturar excepciones globales no controladas para evitar caídas del proceso
process.on('uncaughtException', (err) => {
    console.error('[SERVER CRASH PREVENTED] Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[SERVER CRASH PREVENTED] Unhandled Rejection:', reason);
});

// Estado Global de la Red de Radios (Solo datos serializables sin objetos complejos de Node.js)
const CHANNELS = {
    1: { id: 1, name: 'CANAL 1 - EMERGENCIA Y SOS', lockedBy: null },
    2: { id: 2, name: 'CANAL 2 - BÚSQUEDA Y RESCATE', lockedBy: null },
    3: { id: 3, name: 'CANAL 3 - LOGÍSTICA Y SUMINISTROS', lockedBy: null },
    4: { id: 4, name: 'CANAL 4 - GENERAL Y COMUNIDAD', lockedBy: null }
};

const channelLockTimers = new Map(); // chanId -> Timeout Handle

function forceReleaseChannelLock(chanId) {
    const channel = CHANNELS[chanId];
    if (!channel) return;
    
    if (channelLockTimers.has(chanId)) {
        clearTimeout(channelLockTimers.get(chanId));
        channelLockTimers.delete(chanId);
    }
    
    const oldSocketId = channel.lockedBy;
    channel.lockedBy = null;

    if (oldSocketId) {
        const radio = activeRadios.get(oldSocketId);
        if (radio && radio.status === 'TRANSMITTING') {
            radio.status = 'IDLE';
            activeRadios.set(oldSocketId, radio);
        }
    }

    io.to(`channel_${chanId}`).emit('TRANSMIT_END', {
        channel: chanId,
        callsign: 'SISTEMA'
    });
    io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
}

const activeRadios = new Map(); // socket.id -> Radio Profile
const activeSosAlerts = new Map(); // sosId -> SOS Data

// Generación de indicativo de radio automático (Callsign)
let callsignCounter = 101;
function generateCallsign() {
    return `RADIO-${callsignCounter++}`;
}

io.on('connection', (socket) => {
    console.log(`[+] Radio conectada: ${socket.id}`);

    // Registro de la radio
    let radioProfile = {
        id: socket.id,
        callsign: generateCallsign(),
        channel: 1,
        status: 'IDLE', // IDLE, TRANSMITTING, SOS
        triage: 'OK',   // OK, SEARCHING, INJURED, TRAPPED
        battery: 100,
        location: null,
        joinedAt: new Date().toISOString()
    };

    activeRadios.set(socket.id, radioProfile);
    socket.join(`channel_${radioProfile.channel}`);

    // Enviar configuración inicial a la radio recién conectada
    socket.emit('INIT_RADIO', {
        profile: radioProfile,
        channels: Object.values(CHANNELS),
        activeSos: Array.from(activeSosAlerts.values())
    });

    // Notificar a todos los peers sobre la nueva radio
    io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));

    // Actualización de perfil / nombre de la radio
    socket.on('UPDATE_PROFILE', (data) => {
        if (data.callsign && data.callsign.trim().length > 0) {
            radioProfile.callsign = data.callsign.trim().toUpperCase();
        }
        if (typeof data.battery === 'number') {
            radioProfile.battery = data.battery;
        }
        if (data.location) {
            radioProfile.location = data.location;
        }
        if (data.triage) {
            radioProfile.triage = data.triage;
        }
        activeRadios.set(socket.id, radioProfile);
        io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
    });

    // Actualización directa de Triage de Emergencia
    socket.on('UPDATE_TRIAGE', (triageStatus) => {
        radioProfile.triage = triageStatus;
        activeRadios.set(socket.id, radioProfile);
        io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
        io.emit('TRIAGE_ANNOUNCED', {
            callsign: radioProfile.callsign,
            triage: triageStatus,
            battery: radioProfile.battery,
            location: radioProfile.location,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    // Cambio de canal de radio
    socket.on('CHANGE_CHANNEL', (newChannel) => {
        const chanId = parseInt(newChannel, 10);
        if (CHANNELS[chanId]) {
            // Si la radio estaba transmitiendo en el canal anterior, liberar candado
            if (radioProfile.status === 'TRANSMITTING' && CHANNELS[radioProfile.channel].lockedBy === socket.id) {
                CHANNELS[radioProfile.channel].lockedBy = null;
                io.emit('TRANSMIT_END', { channel: radioProfile.channel, callsign: radioProfile.callsign });
            }

            socket.leave(`channel_${radioProfile.channel}`);
            radioProfile.channel = chanId;
            socket.join(`channel_${chanId}`);
            
            if (radioProfile.status !== 'SOS') {
                radioProfile.status = 'IDLE';
            }

            activeRadios.set(socket.id, radioProfile);
            socket.emit('CHANNEL_CHANGED', CHANNELS[chanId]);
            io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
        }
    });

    // Solicitud de Transmisión PTT (Push-To-Talk)
    socket.on('REQUEST_TRANSMIT', () => {
        const channel = CHANNELS[radioProfile.channel];

        if (!channel) return;

        // Limpiar candado obsoleto si el socket que lo poseía ya no existe
        if (channel.lockedBy && !activeRadios.has(channel.lockedBy)) {
            forceReleaseChannelLock(channel.id);
        }

        // Comprobar si el canal está ocupado por otra radio activa
        if (channel.lockedBy && channel.lockedBy !== socket.id) {
            const currentTransmitter = activeRadios.get(channel.lockedBy);
            socket.emit('TRANSMIT_REJECTED', {
                reason: 'CANAL_OCUPADO',
                busyBy: currentTransmitter ? currentTransmitter.callsign : 'OTRA RADIO'
            });
            return;
        }

        // Conceder candado de transmisión
        channel.lockedBy = socket.id;
        radioProfile.status = 'TRANSMITTING';
        activeRadios.set(socket.id, radioProfile);

        // Cancelar temporizador previo si existía
        if (channelLockTimers.has(channel.id)) {
            clearTimeout(channelLockTimers.get(channel.id));
            channelLockTimers.delete(channel.id);
        }

        // Temporizador de seguridad: liberar automáticamente el candado tras 15 segundos max de ráfaga PTT
        const timer = setTimeout(() => {
            if (channel.lockedBy === socket.id) {
                console.log(`[SAFETY] Liberando candado por timeout de 15s para ${radioProfile.callsign}`);
                forceReleaseChannelLock(channel.id);
            }
        }, 15000);
        channelLockTimers.set(channel.id, timer);

        socket.emit('TRANSMIT_GRANTED', { channel: channel.id });
        socket.broadcast.to(`channel_${channel.id}`).emit('TRANSMIT_START', {
            channel: channel.id,
            callsign: radioProfile.callsign,
            transmitterId: socket.id
        });

        io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
    });

const seenServerMsgs = new Set();

function registerServerMsg(msgId) {
    if (!msgId) return false;
    if (seenServerMsgs.has(msgId)) return true; // Ya visto
    seenServerMsgs.add(msgId);
    if (seenServerMsgs.size > 2000) {
        const firstVal = seenServerMsgs.values().next().value;
        seenServerMsgs.delete(firstVal);
    }
    return false;
}

    // Transmisión de paquete/fragmento de Audio con retransmisión en Malla (Multi-Hop Mesh V1)
    socket.on('AUDIO_STREAM', (audioBlobData) => {
        const channel = CHANNELS[radioProfile.channel];
        if (channel && channel.lockedBy === socket.id) {
            const packetId = `AUD-${radioProfile.callsign}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
            registerServerMsg(packetId);

            // Transmitir fragmento de voz con protocolo normalizado RADIO_RESCATE_MESH_V1
            socket.broadcast.to(`channel_${channel.id}`).emit('AUDIO_CHUNK', {
                protocol: 'RADIO_RESCATE_MESH_V1',
                msgId: packetId,
                originNodeId: radioProfile.callsign,
                ttl: 3,
                hopCount: 1,
                hopPath: [radioProfile.callsign],
                channel: channel.id,
                transmitterId: socket.id,
                callsign: radioProfile.callsign,
                data: audioBlobData
            });
        }
    });

    // Liberación del botón PTT (Final de Transmisión)
    socket.on('STOP_TRANSMIT', () => {
        const channel = CHANNELS[radioProfile.channel];
        if (channel && channel.lockedBy === socket.id) {
            forceReleaseChannelLock(channel.id);
        }
    });

    // Emisión de Alerta de Emergencia SOS
    socket.on('SEND_SOS', (sosPayload) => {
        const sosId = `SOS-${Date.now()}-${socket.id.substring(0, 4)}`;
        const sosData = {
            protocol: 'RADIO_RESCATE_MESH_V1',
            msgId: sosId,
            originNodeId: radioProfile.callsign,
            type: 'SOS_ALERT',
            ttl: 5,
            hopCount: 1,
            hopPath: [radioProfile.callsign],
            id: sosId,
            transmitterId: socket.id,
            callsign: radioProfile.callsign,
            message: sosPayload.message || '¡SOLICITUD DE AUXILIO / SOS ACTIVADO!',
            location: sosPayload.location || radioProfile.location,
            battery: radioProfile.battery,
            timestamp: new Date().toISOString()
        };

        registerServerMsg(sosId);
        radioProfile.status = 'SOS';
        activeRadios.set(socket.id, radioProfile);
        activeSosAlerts.set(sosData.id, sosData);

        // Transmitir a TODAS las radios en TODOS los canales con prioridad máxima
        io.emit('SOS_ALERT_BROADCAST', sosData);
        io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
        console.log(`[ALERT] SOS Emitido por ${radioProfile.callsign} (MESH TTL=5)`);
    });

    // Cancelar Alerta SOS
    socket.on('CANCEL_SOS', (sosId) => {
        if (sosId) {
            activeSosAlerts.delete(sosId);
        } else {
            activeSosAlerts.clear();
        }
        radioProfile.status = 'IDLE';
        activeRadios.set(socket.id, radioProfile);

        io.emit('SOS_CANCELLED', { sosId, callsign: radioProfile.callsign });
        io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
    });

    // Envío de Mensaje Táctico de Texto
    socket.on('SEND_TACTICAL_TEXT', (textData) => {
        const msgId = `MSG-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        const messagePayload = {
            protocol: 'RADIO_RESCATE_MESH_V1',
            msgId,
            originNodeId: radioProfile.callsign,
            type: 'TACTICAL_TEXT',
            ttl: 3,
            hopCount: 1,
            hopPath: [radioProfile.callsign],
            id: msgId,
            callsign: radioProfile.callsign,
            channel: radioProfile.channel,
            text: textData.text,
            location: textData.location || radioProfile.location,
            timestamp: new Date().toLocaleTimeString()
        };

        registerServerMsg(msgId);
        io.to(`channel_${radioProfile.channel}`).emit('TACTICAL_TEXT_RECEIVED', messagePayload);
    });

    // Retransmisión de Paquetes Malla de Repetidores Secundarios (Multi-Hop Forwarding)
    socket.on('MESH_FORWARD', (meshPacket) => {
        if (!meshPacket || !meshPacket.msgId || typeof meshPacket.ttl !== 'number') return;
        
        // Desduplicación en el servidor
        if (registerServerMsg(meshPacket.msgId)) {
            return; // Ya fue procesado/retransmitido previamente
        }

        if (meshPacket.ttl <= 0) return;

        meshPacket.ttl -= 1;
        meshPacket.hopCount = (meshPacket.hopCount || 1) + 1;
        if (!Array.isArray(meshPacket.hopPath)) meshPacket.hopPath = [];
        meshPacket.hopPath.push(`BASE-RELAY`);

        if (meshPacket.type === 'AUDIO_CHUNK') {
            socket.broadcast.to(`channel_${meshPacket.channel}`).emit('AUDIO_CHUNK', meshPacket);
        } else if (meshPacket.type === 'SOS_ALERT') {
            io.emit('SOS_ALERT_BROADCAST', meshPacket);
        } else if (meshPacket.type === 'TACTICAL_TEXT') {
            io.to(`channel_${meshPacket.channel}`).emit('TACTICAL_TEXT_RECEIVED', meshPacket);
        }
    });

    // Reenvío de Señalización WebRTC para Malla Directa P2P Celular a Celular
    socket.on('WEBRTC_SIGNAL', (payload) => {
        if (payload && payload.targetId && activeRadios.has(payload.targetId)) {
            io.to(payload.targetId).emit('WEBRTC_SIGNAL', {
                senderId: socket.id,
                senderCallsign: radioProfile.callsign,
                signal: payload.signal
            });
        }
    });

    // Desconexión de la radio
    socket.on('disconnect', () => {
        console.log(`[-] Radio desconectada: ${socket.id}`);

        // Liberar candados de transmisión pendientes
        for (const chanId in CHANNELS) {
            if (CHANNELS[chanId].lockedBy === socket.id) {
                CHANNELS[chanId].lockedBy = null;
                io.to(`channel_${chanId}`).emit('TRANSMIT_END', {
                    channel: chanId,
                    callsign: radioProfile.callsign
                });
            }
        }

        activeRadios.delete(socket.id);
        io.emit('PEERS_UPDATE', Array.from(activeRadios.values()));
    });
});

function bindServer(server, preferredPort, fallbackPort) {
    return new Promise((resolve) => {
        const onError = (err) => {
            server.removeListener('error', onError);
            server.listen(fallbackPort, '0.0.0.0', () => resolve(fallbackPort));
        };
        server.on('error', onError);
        server.listen(preferredPort, '0.0.0.0', () => {
            server.removeListener('error', onError);
            resolve(preferredPort);
        });
    });
}

async function startServers() {
    try {
        // Soporte para despliegue en la nube (Render, Railway, Fly.io, Heroku)
        if (process.env.PORT && !process.env.LOCAL_DEV) {
            const cloudPort = process.env.PORT;
            io.attach(httpServer);
            httpServer.listen(cloudPort, '0.0.0.0', () => {
                console.log('\n======================================================');
                console.log(`   S.O.S. RESCATE - DESPLIEGUE CLOUD ACTIVO EN PUERTO ${cloudPort}`);
                console.log('======================================================\n');
            });
            return;
        }

        const pkey = await selfsigned.generate([{ name: 'commonName', value: 'RadioRescate' }], { days: 365 });
        const sslOptions = { key: pkey.private, cert: pkey.cert };
        
        httpsServer = https.createServer(sslOptions, app);

        io.attach(httpServer);
        io.attach(httpsServer);

        const boundHttpPort = await bindServer(httpServer, 80, 8081);
        const boundHttpsPort = await bindServer(httpsServer, 443, 8443);

        PORT_HTTP = boundHttpPort;
        PORT_HTTPS = boundHttpsPort;

        // Crear respaldos en 8081 y 8443 si 80 y 443 fueron elegidos
        if (boundHttpPort === 80) {
            try {
                const httpBackup = http.createServer(app);
                io.attach(httpBackup);
                httpBackup.listen(8081, '0.0.0.0');
            } catch(e) {}
        }
        if (boundHttpsPort === 443) {
            try {
                const httpsBackup = https.createServer(sslOptions, app);
                io.attach(httpsBackup);
                httpsBackup.listen(8443, '0.0.0.0');
            } catch(e) {}
        }

        const addresses = getLocalIpAddresses();
        console.log('\n======================================================');
        console.log('   ESTACIÓN BASE DE RADIO DE COMUNICACIÓN DE EMERGENCIA  ');
        console.log('======================================================');
        console.log(`[HTTPS CONTEXTO SEGURO] Activo en puertos ${boundHttpsPort} y 8443`);
        console.log(`[HTTP STANDALONE] Activo en puertos ${boundHttpPort} y 8081`);
        console.log('\nDirección directa en la barra de Safari/Chrome:');
        addresses.forEach(addr => {
            console.log(` -> Directo (sin puerto): http://${addr.address}  o  https://${addr.address}`);
            console.log(` -> Táctico: http://${addr.address}:${boundHttpPort}  o  https://${addr.address}:${boundHttpsPort}`);
        });
        console.log('======================================================\n');
    } catch (err) {
        console.error('Error al iniciar servidores con SSL:', err);
    }
}

startServers();
