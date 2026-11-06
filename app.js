/* ==========================================================================
   ENGINE Y LÓGICA DE CLIENTE: RADIO RESCATE P2P PTT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- CONEXIÓN SOCKET.IO (CON FALLBACK AUTOMÁTICO POLLING -> WEBSOCKET) ---
    const socket = io({
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 10000
    });

    // --- ELEMENTOS DEL DOM ---
    const networkStatusBadge = document.getElementById('networkStatusBadge');
    const networkStatusText = document.getElementById('networkStatusText');
    const callsignInput = document.getElementById('callsignInput');
    const gpsStatus = document.getElementById('gpsStatus');
    const batteryStatus = document.getElementById('batteryStatus');
    const repeaterBadge = document.getElementById('repeaterBadge');

    const lcdChannelNum = document.getElementById('lcdChannelNum');
    const lcdChannelName = document.getElementById('lcdChannelName');
    const txRxIndicator = document.getElementById('txRxIndicator');
    const speakerIcon = document.getElementById('speakerIcon');
    const speakerCallsign = document.getElementById('speakerCallsign');

    const vuMeterCanvas = document.getElementById('vuMeterCanvas');
    const vuCtx = vuMeterCanvas.getContext('2d');

    const pttButton = document.getElementById('pttButton');
    const pttLabel = document.getElementById('pttLabel');
    const togglePttMode = document.getElementById('togglePttMode');
    const volumeControl = document.getElementById('volumeControl');

    const toggleVoxMode = document.getElementById('toggleVoxMode');
    const voxSensControl = document.getElementById('voxSensControl');
    const voxSensVal = document.getElementById('voxSensVal');
    const voxSensBox = document.getElementById('voxSensBox');
    const voxLcdBadge = document.getElementById('voxLcdBadge');

    const sosTriggerBtn = document.getElementById('sosTriggerBtn');
    const sosBanner = document.getElementById('sosBanner');
    const sosCallsign = document.getElementById('sosCallsign');
    const sosMsg = document.getElementById('sosMsg');
    const sosLocation = document.getElementById('sosLocation');
    const silenceSosBtn = document.getElementById('silenceSosBtn');

    const peersCount = document.getElementById('peersCount');
    const peersList = document.getElementById('peersList');

    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const msgChannelName = document.getElementById('msgChannelName');

    const infoBtn = document.getElementById('infoBtn');
    const infoModal = document.getElementById('infoModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const closeModalOkBtn = document.getElementById('closeModalOkBtn');
    const requestGeoBtn = document.getElementById('requestGeoBtn');
    const networkAddressesList = document.getElementById('networkAddressesList');

    const dspActiveLabel = document.getElementById('dspActiveLabel');
    const dspBtns = document.querySelectorAll('.dsp-btn');
    const testRecordBtn = document.getElementById('testRecordBtn');
    const testRecordLabel = document.getElementById('testRecordLabel');
    const testLiveBtn = document.getElementById('testLiveBtn');
    const testLiveLabel = document.getElementById('testLiveLabel');

    // --- PERFILES DE PROCESAMIENTO DIGITAL DE AUDIO (DSP) TÁCTICO DE ALTA FIDELIDAD ---
    const DSP_PROFILES = {
        standard: {
            name: 'ESTÁNDAR (NATIVO)',
            highpassCutoff: 100,
            lowpassCutoff: 10000,
            peakingFreq: 2800,
            peakingGain: 2.0,
            noiseGateThreshold: 0.002,
            inputBoost: 1.05
        },
        tactical: {
            name: 'RADIO (300Hz-3.4kHz)',
            highpassCutoff: 250,
            lowpassCutoff: 3800,
            peakingFreq: 3000,
            peakingGain: 4.5,
            noiseGateThreshold: 0.008,
            inputBoost: 1.20
        },
        antiwind: {
            name: 'ANTIVIENTO / GATE',
            highpassCutoff: 200,
            lowpassCutoff: 4200,
            peakingFreq: 2800,
            peakingGain: 3.5,
            noiseGateThreshold: 0.015,
            inputBoost: 1.15
        },
        boost: {
            name: 'CLARIDAD HD (+4dB)',
            highpassCutoff: 140,
            lowpassCutoff: 7500,
            peakingFreq: 3000,
            peakingGain: 5.0,
            noiseGateThreshold: 0.005,
            inputBoost: 1.35
        }
    };

    // Re-muestrear de manera limpia e interpolada entre cualquier par de frecuencias (ej. 48kHz -> 44.1kHz)
    function resampleFloatArray(inputSamples, fromRate, toRate) {
        if (fromRate === toRate || !fromRate || !toRate) return inputSamples;
        const ratio = fromRate / toRate;
        const newLength = Math.round(inputSamples.length / ratio);
        const output = new Float32Array(newLength);
        for (let i = 0; i < newLength; i++) {
            const originIndex = i * ratio;
            const indexLow = Math.floor(originIndex);
            const indexHigh = Math.min(indexLow + 1, inputSamples.length - 1);
            const weight = originIndex - indexLow;
            output[i] = inputSamples[indexLow] * (1 - weight) + inputSamples[indexHigh] * weight;
        }
        return output;
    }
    let currentAudioDspProfile = 'standard';
    let dspHpFilter = null;
    let dspLpFilter = null;
    let dspPeakFilter = null;
    let liveEcoGainNode = null;
    let liveEcoDelayNode = null;

    let isTestRecording = false;
    let isTestPlaying = false;
    let isLiveEcoActive = false;
    let recordedTestChunks = [];
    let testCountdownTimer = null;

    function applyActiveDspProfileToNodes() {
        const prof = DSP_PROFILES[currentAudioDspProfile] || DSP_PROFILES.standard;
        const now = audioContext ? audioContext.currentTime : 0;
        
        if (currentAudioDspProfile === 'standard') {
            if (dspHpFilter) dspHpFilter.frequency.setValueAtTime(10, now);
            if (dspLpFilter) dspLpFilter.frequency.setValueAtTime(22000, now);
            if (dspPeakFilter) dspPeakFilter.gain.setValueAtTime(0, now);
        } else {
            if (dspHpFilter) dspHpFilter.frequency.setValueAtTime(prof.highpassCutoff, now);
            if (dspLpFilter) dspLpFilter.frequency.setValueAtTime(prof.lowpassCutoff, now);
            if (dspPeakFilter) {
                dspPeakFilter.frequency.setValueAtTime(prof.peakingFreq, now);
                dspPeakFilter.gain.setValueAtTime(prof.peakingGain, now);
            }
        }
    }

    // Manejo de botones de perfil de audio DSP
    dspBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const profileKey = btn.getAttribute('data-dsp');
            if (DSP_PROFILES[profileKey]) {
                currentAudioDspProfile = profileKey;
                dspBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (dspActiveLabel) {
                    dspActiveLabel.textContent = DSP_PROFILES[profileKey].name;
                }
                applyActiveDspProfileToNodes();
            }
        });
    });

    // --- ESTADO LOCAL ---
    let myProfile = { callsign: 'RADIO-101', channel: 1, battery: 100, location: null };
    let isTransmitting = false;
    let isReceiving = false;
    let isVoxModeActive = false;
    let voxSens = 5;
    let voxThreshold = 0.030;
    let voxHangoverTimer = null;
    let isVoxTransmitting = false;
    let isVoxRequestPending = false;
    let mediaRecorder = null;
    let audioStream = null;
    let audioContext = null;
    let analyserNode = null;
    let vuAnimationId = null;
    let activeSirenOsc = null;
    let sosSilenced = false;

    // --- PROTOCOLO Y ESTADO MALLA V1 (DESDUPLICACIÓN Y METRICAS DE SALTO) ---
    const seenMeshMsgs = new Set();
    let meshHopMetrics = { lastHopCount: 1, relayedCount: 0 };

    function registerClientMeshMsg(msgId) {
        if (!msgId) return false;
        if (seenMeshMsgs.has(msgId)) return true;
        seenMeshMsgs.add(msgId);
        if (seenMeshMsgs.size > 1000) {
            const firstKey = seenMeshMsgs.values().next().value;
            seenMeshMsgs.delete(firstKey);
        }
        return false;
    }

    function updateMeshBadgeUI(hopCount, hopPath) {
        if (!repeaterBadge) return;
        const hops = hopCount || 1;
        meshHopMetrics.lastHopCount = hops;
        repeaterBadge.innerHTML = `<i class="fa-solid fa-tower-cell"></i> MESH (${hops} ${hops === 1 ? 'Salto' : 'Saltos'})`;
        repeaterBadge.title = `Protocolo Malla V1 Activo | Saltos: ${hops} | Ruta: ${(hopPath || []).join(' -> ')}`;
    }

    // --- SINTETIZADOR DE EFECTOS DE AUDIO Y SONIDOS DE RADIO ---
    function getAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return audioContext;
    }

    // Sonido de Squelch / Clic de Micrófono
    function playRadioClickSound() {
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.06);

            gain.gain.setValueAtTime(0.3 * volumeControl.value, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.06);
        } catch (e) {}
    }

    // Sonido de Roger Beep al terminar transmisión entrante
    function playRogerBeep() {
        try {
            const ctx = getAudioContext();
            const now = ctx.currentTime;
            
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gain = ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1200, now);
            
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1800, now + 0.08);

            gain.gain.setValueAtTime(0.2 * volumeControl.value, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(now);
            osc1.stop(now + 0.08);
            osc2.start(now + 0.08);
            osc2.stop(now + 0.16);
        } catch (e) {}
    }

    // Siren SOS Acústica de Emergencia
    function startSosSiren() {
        if (activeSirenOsc || sosSilenced) return;
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            
            // Modulación de frecuencia tipo sirena de ambulancia/rescate
            let toggle = false;
            const sirenInterval = setInterval(() => {
                if (!activeSirenOsc) {
                    clearInterval(sirenInterval);
                    return;
                }
                toggle = !toggle;
                osc.frequency.setValueAtTime(toggle ? 950 : 600, ctx.currentTime);
            }, 400);

            gain.gain.setValueAtTime(0.4 * volumeControl.value, ctx.currentTime);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();

            activeSirenOsc = { osc, gain, interval: sirenInterval };
        } catch (e) {}
    }

    function stopSosSiren() {
        if (activeSirenOsc) {
            try {
                clearInterval(activeSirenOsc.interval);
                activeSirenOsc.osc.stop();
                activeSirenOsc.osc.disconnect();
            } catch(e) {}
            activeSirenOsc = null;
        }
    }

    // --- MEDIDOR DE NIVEL DE AUDIO (VU METER) ---
    function drawVuMeter(level = 0) {
        const width = vuMeterCanvas.width;
        const height = vuMeterCanvas.height;
        vuCtx.clearRect(0, 0, width, height);

        const totalBars = 20;
        const barWidth = (width / totalBars) - 2;

        const activeBars = Math.round((level / 100) * totalBars);

        for (let i = 0; i < totalBars; i++) {
            const x = i * (barWidth + 2);
            if (i < activeBars) {
                if (i < 12) vuCtx.fillStyle = '#00ff66'; // Verde
                else if (i < 16) vuCtx.fillStyle = '#ffcc00'; // Amarillo
                else vuCtx.fillStyle = '#ff3333'; // Rojo (Pico)
            } else {
                vuCtx.fillStyle = '#102414';
            }
            vuCtx.fillRect(x, 2, barWidth, height - 4);
        }
    }

    drawVuMeter(0);

    // --- EVENTOS DE SOCKET.IO ---

    function updateConnectionStatus(isOnline, text) {
        const statusDot = networkStatusBadge ? networkStatusBadge.querySelector('.status-dot') : null;
        if (statusDot) {
            statusDot.className = isOnline ? 'status-dot online' : 'status-dot offline';
        }
        if (networkStatusText) {
            networkStatusText.textContent = text;
        }
    }

    socket.on('connect', () => {
        updateConnectionStatus(true, 'RED P2P ACTIVA');
    });

    socket.on('disconnect', () => {
        updateConnectionStatus(false, 'DESCONECTADO');
    });

    socket.on('connect_error', (err) => {
        updateConnectionStatus(false, 'BUSCANDO BASE...');
        console.warn('Socket connect_error:', err);
    });

    if (socket.connected) {
        updateConnectionStatus(true, 'RED P2P ACTIVA');
    }

    let currentSosId = null;

    socket.on('INIT_RADIO', (data) => {
        updateConnectionStatus(true, 'RED P2P ACTIVA');
        myProfile = data.profile;
        callsignInput.value = myProfile.callsign;
        updateLcdChannel(myProfile.channel);

        // Si existen alertas SOS previas
        if (data.activeSos && data.activeSos.length > 0) {
            showSosBanner(data.activeSos[0]);
        } else {
            sosBanner.classList.add('hidden');
            stopSosSiren();
        }
    });

    socket.on('CHANNEL_CHANGED', (chanData) => {
        updateLcdChannel(chanData.id);
        msgChannelName.textContent = `CANAL ${chanData.id}`;
    });

    socket.on('PEERS_UPDATE', (peersArray) => {
        updateConnectionStatus(true, 'RED P2P ACTIVA');
        peersCount.textContent = peersArray.length;
        renderPeersList(peersArray);
    });

    socket.on('TRANSMIT_GRANTED', (data) => {
        isTransmitting = true;
        isVoxRequestPending = false;
        txRxIndicator.textContent = isVoxTransmitting ? 'TX VOX (ACTIVO)' : 'TX TRANSMITIENDO';
        txRxIndicator.className = 'tx-rx-indicator tx';
        speakerCallsign.textContent = `Hablando: ${myProfile.callsign} (TÚ${isVoxTransmitting ? ' - VOX' : ''})`;
        speakerIcon.className = 'fa-solid fa-microphone';
        speakerIcon.classList.remove('hidden');
        pttButton.classList.add('transmitting');
        pttLabel.innerHTML = isVoxTransmitting ? 'VOX ACTIVADO<br>HABLANDO...' : 'TRANSMITIENDO...<br>LIBERA PARA ESCUCHAR';
        playRadioClickSound();
        startAudioCapture();
    });

    socket.on('TRANSMIT_REJECTED', (data) => {
        stopTransmitting();
        if (!isVoxTransmitting) {
            alert(`CANAL OCUPADO: ${data.busyBy} está hablando en este momento.`);
        }
    });

    socket.on('TRANSMIT_START', (data) => {
        isReceiving = true;
        resetAudioTimeline();
        txRxIndicator.textContent = 'RX RECIBIENDO';
        txRxIndicator.className = 'tx-rx-indicator rx';
        speakerCallsign.textContent = `Receptando: ${data.callsign}`;
        speakerIcon.className = 'fa-solid fa-volume-high';
        speakerIcon.classList.remove('hidden');
        playRadioClickSound();
    });

    socket.on('AUDIO_CHUNK', (data) => {
        const msgId = data.msgId || data.packetId;
        if (registerClientMeshMsg(msgId)) return; // Desduplicar
        updateMeshBadgeUI(data.hopCount, data.hopPath);
        if (!isTransmitting) {
            playAudioChunk(data.data || data);
        }
    });

    socket.on('TRANSMIT_END', (data) => {
        isReceiving = false;
        resetAudioTimeline();
        txRxIndicator.textContent = 'RX STANDBY';
        txRxIndicator.className = 'tx-rx-indicator';
        speakerCallsign.textContent = 'Frecuencia Despejada';
        speakerIcon.classList.add('hidden');
        drawVuMeter(0);
        playRogerBeep();
    });

    socket.on('SOS_ALERT_BROADCAST', (sosData) => {
        const msgId = sosData.msgId || sosData.id;
        if (registerClientMeshMsg(msgId)) return; // Desduplicar
        updateMeshBadgeUI(sosData.hopCount, sosData.hopPath);
        showSosBanner(sosData);
        startSosSiren();
    });

    socket.on('SOS_CANCELLED', (data) => {
        sosBanner.classList.add('hidden');
        stopSosSiren();
    });

    socket.on('TACTICAL_TEXT_RECEIVED', (msgData) => {
        const msgId = msgData.msgId || msgData.id;
        if (registerClientMeshMsg(msgId)) return; // Desduplicar
        updateMeshBadgeUI(msgData.hopCount, msgData.hopPath);
        addChatMessage(msgData);
    });

    // Desbloquear AudioContext en cualquier toque de pantalla en iOS/Android
    function unlockAudio() {
        try {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().then(() => {
                    hideAudioBanner();
                }).catch(() => {});
            } else if (ctx && ctx.state === 'running') {
                hideAudioBanner();
            }
        } catch(e) {}
    }

    function hideAudioBanner() {
        const banner = document.getElementById('audioUnlockBanner');
        if (banner) banner.classList.add('hidden');
    }

    ['touchstart', 'touchend', 'mousedown', 'mouseup', 'click', 'pointerdown'].forEach(evt => {
        window.addEventListener(evt, unlockAudio, { passive: true });
        document.addEventListener(evt, unlockAudio, { passive: true });
    });

    let scriptProcessor = null;
    let nextPlayTime = 0;

    // Resetear línea de tiempo al iniciar/terminar transmisión
    function resetAudioTimeline() {
        nextPlayTime = 0;
    }

    // Convertir de manera segura cualquier payload binario (ArrayBuffer, Uint8Array, Buffer, Array) a Int16Array alineado
    function getInt16ArrayFromPayload(rawPcm) {
        if (!rawPcm) return new Int16Array(0);
        if (rawPcm instanceof Int16Array) return rawPcm;
        if (rawPcm instanceof ArrayBuffer) return new Int16Array(rawPcm);

        if (Array.isArray(rawPcm)) {
            return new Int16Array(rawPcm);
        }

        // Si es una vista TypedArray (Uint8Array, Buffer de Socket.IO, DataView, etc.)
        if (ArrayBuffer.isView(rawPcm)) {
            try {
                // slice() genera un nuevo ArrayBuffer alineado desde byte 0 para evitar RangeError si byteOffset es impar
                const alignedBuffer = rawPcm.buffer.slice(rawPcm.byteOffset, rawPcm.byteOffset + rawPcm.byteLength);
                return new Int16Array(alignedBuffer);
            } catch (e) {
                console.error('Error al re-alinear buffer:', e);
            }
        }

        if (typeof rawPcm === 'object' && rawPcm.data) {
            return getInt16ArrayFromPayload(rawPcm.data);
        }

        return new Int16Array(0);
    }

    // --- BUS DE PROCESAMIENTO MASTER DE RECEPCIÓN (ECUALIZACIÓN Y COMPRESIÓN DE CLARIDAD) ---
    let rxMasterHpNode = null;
    let rxMasterPeakNode = null;
    let rxMasterCompressor = null;

    function getRxMasterNode(ctx) {
        if (!rxMasterCompressor) {
            rxMasterHpNode = ctx.createBiquadFilter();
            rxMasterHpNode.type = 'highpass';
            rxMasterHpNode.frequency.value = 120; // Elimina resonancia grave de altavoces pequeños

            rxMasterPeakNode = ctx.createBiquadFilter();
            rxMasterPeakNode.type = 'peaking';
            rxMasterPeakNode.frequency.value = 2900; // Realce de inteligibilidad de consonantes (formante de voz)
            rxMasterPeakNode.Q.value = 1.2;
            rxMasterPeakNode.gain.value = 3.5; // Realce de +3.5dB de presencia

            rxMasterCompressor = ctx.createDynamicsCompressor();
            rxMasterCompressor.threshold.value = -20;
            rxMasterCompressor.knee.value = 10;
            rxMasterCompressor.ratio.value = 4.0;
            rxMasterCompressor.attack.value = 0.003;
            rxMasterCompressor.release.value = 0.12;

            rxMasterHpNode.connect(rxMasterPeakNode);
            rxMasterPeakNode.connect(rxMasterCompressor);
            rxMasterCompressor.connect(ctx.destination);
        }
        return rxMasterHpNode;
    }

    // --- REPRODUCCIÓN DE AUDIO ENTRANTE PCM (BOOST Y LÍNEA DE TIEMPO ESTABLE) ---
    function playAudioChunk(chunkPayload) {
        try {
            unlockAudio();
            const ctx = getAudioContext();
            
            // Extraer datos del paquete (Soporte objeto { sr, pcm } o ArrayBuffer)
            const rawPcm = chunkPayload.pcm || chunkPayload;
            const senderSr = chunkPayload.sr || ctx.sampleRate;

            const int16Array = getInt16ArrayFromPayload(rawPcm);
            if (int16Array.length === 0) return;

            // 1. Convertir de Int16 a Float32 lineal
            let floatSamples = new Float32Array(int16Array.length);
            const volumeSetting = parseFloat(volumeControl.value);
            for (let i = 0; i < int16Array.length; i++) {
                floatSamples[i] = (int16Array[i] / 32768.0) * volumeSetting;
            }

            // 2. Si la frecuencia de muestreo del emisor difiere de la del receptor, re-muestrear a ctx.sampleRate
            if (senderSr !== ctx.sampleRate) {
                floatSamples = resampleFloatArray(floatSamples, senderSr, ctx.sampleRate);
            }

            // 3. Crear AudioBuffer usando el sampleRate NATIVO exacto de este dispositivo (elimina bug de iOS WebKit)
            const audioBuffer = ctx.createBuffer(1, floatSamples.length, ctx.sampleRate);
            audioBuffer.getChannelData(0).set(floatSamples);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            
            // Enlazar a través del Bus Master Receptor de Claridad (EQ + Compresor)
            const rxMasterBus = getRxMasterNode(ctx);
            source.connect(rxMasterBus);

            // Manejo estricto de cola para tiempo real exacto sin estiramiento
            const now = ctx.currentTime;
            if (nextPlayTime < now || (nextPlayTime - now) > 0.08) {
                nextPlayTime = now + 0.01; // Buffer ultracorto de 10ms
            }

            source.start(nextPlayTime);
            nextPlayTime += audioBuffer.duration;

            // Animación limpia del VU meter durante recepción
            drawVuMeter(Math.floor(Math.random() * 40) + 40);
            source.onended = () => {
                if (ctx.currentTime >= nextPlayTime - 0.02) {
                    drawVuMeter(0);
                }
            };
        } catch (e) {
            console.error('Error al reproducir PCM:', e);
        }
    }

    // --- MANEJO DE RECUPERACIÓN TRAS APAGAR PANTALLA / SUSPENSIÓN (VISIBILITY API) ---
    function handleWakeupAndReconnect() {
        if (socket && !socket.connected) {
            socket.connect();
        }
        unlockAudio();
        
        // Limpiar stream de micrófono muerto tras la suspensión de la pantalla en iOS/Android
        if (audioStream) {
            const tracks = audioStream.getAudioTracks();
            if (!audioStream.active || tracks.length === 0 || tracks.some(t => t.readyState === 'ended' || !t.enabled)) {
                try {
                    tracks.forEach(t => t.stop());
                } catch(e) {}
                audioStream = null;
            }
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            handleWakeupAndReconnect();
        }
    });
    window.addEventListener('focus', handleWakeupAndReconnect);
    window.addEventListener('pageshow', handleWakeupAndReconnect);

    // --- CAPTURA DE MICRÓFONO Y TRANSMISIÓN PTT ---
    async function startAudioCapture() {
        try {
            // Verificar si el micrófono previo fue cerrado por el sistema al apagar la pantalla
            if (audioStream) {
                const tracks = audioStream.getAudioTracks();
                if (!audioStream.active || tracks.length === 0 || tracks.some(t => t.readyState === 'ended' || !t.enabled)) {
                    try {
                        tracks.forEach(t => t.stop());
                    } catch(e) {}
                    audioStream = null;
                }
            }

            if (!audioStream) {
                audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        channelCount: 1,
                        sampleRate: { ideal: 48000 }
                    }
                });
            }

            const ctx = getAudioContext();
            const source = ctx.createMediaStreamSource(audioStream);
            analyserNode = ctx.createAnalyser();
            analyserNode.fftSize = 64;

            // Configurar Filtros Biquad de Audio según perfil DSP activo
            const prof = DSP_PROFILES[currentAudioDspProfile] || DSP_PROFILES.tactical;
            
            dspHpFilter = ctx.createBiquadFilter();
            dspHpFilter.type = 'highpass';
            dspHpFilter.frequency.value = prof.highpassCutoff;

            dspLpFilter = ctx.createBiquadFilter();
            dspLpFilter.type = 'lowpass';
            dspLpFilter.frequency.value = prof.lowpassCutoff;

            dspPeakFilter = ctx.createBiquadFilter();
            dspPeakFilter.type = 'peaking';
            dspPeakFilter.frequency.value = prof.peakingFreq;
            dspPeakFilter.Q.value = 1.2;
            dspPeakFilter.gain.value = prof.peakingGain;

            // Compresor de Rango Dinámico de Captura (Normaliza susurros y picos de voz)
            const captureCompressor = ctx.createDynamicsCompressor();
            captureCompressor.threshold.value = -22;
            captureCompressor.knee.value = 12;
            captureCompressor.ratio.value = 3.5;
            captureCompressor.attack.value = 0.003;
            captureCompressor.release.value = 0.15;

            // Encadenar filtros DSP: source -> highpass -> lowpass -> peaking -> compressor -> analyser
            source.connect(dspHpFilter);
            dspHpFilter.connect(dspLpFilter);
            dspLpFilter.connect(dspPeakFilter);
            dspPeakFilter.connect(captureCompressor);
            captureCompressor.connect(analyserNode);

            // Iniciar animación VU meter local
            updateLocalVuMeter();

            let gateEnvelope = 1.0;

            // Captura de audio raw a la frecuencia nativa ctx.sampleRate del dispositivo
            scriptProcessor = ctx.createScriptProcessor(2048, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
                if (!isTransmitting && !isTestRecording && !isLiveEcoActive && !isVoxModeActive) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const activeProf = DSP_PROFILES[currentAudioDspProfile] || DSP_PROFILES.tactical;

                // 1. Calcular nivel de potencia RMS del bloque de voz
                let sumSquares = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sumSquares += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sumSquares / inputData.length);

                // Evaluación de VOX (conmutación automática por activación de voz manos libres)
                if (isVoxModeActive && !isReceiving) {
                    if (rms > voxThreshold) {
                        if (voxHangoverTimer) {
                            clearTimeout(voxHangoverTimer);
                            voxHangoverTimer = null;
                        }
                        if (!isTransmitting && !isVoxRequestPending) {
                            isVoxTransmitting = true;
                            isVoxRequestPending = true;
                            socket.emit('REQUEST_TRANSMIT');
                        }
                    } else if (rms <= voxThreshold && isVoxTransmitting && isTransmitting) {
                        if (!voxHangoverTimer) {
                            voxHangoverTimer = setTimeout(() => {
                                stopTransmitting();
                            }, 900);
                        }
                    }
                }

                // 2. Puerta de ruido suave con transición envolvente (Bypassed en modo Estándar)
                let boost = 1.0;
                if (currentAudioDspProfile === 'standard') {
                    boost = 1.0;
                } else {
                    const targetGate = (rms < activeProf.noiseGateThreshold) ? 0.15 : 1.0;
                    gateEnvelope += (targetGate - gateEnvelope) * 0.20;
                    boost = activeProf.inputBoost * gateEnvelope;
                }

                // 3. Convertir Float32 a Int16 con limitador suave sin recortar picos
                const pcm16 = new Int16Array(inputData.length);

                for (let i = 0; i < inputData.length; i++) {
                    let sample = inputData[i] * boost;
                    if (sample > 0.85) sample = 0.85 + (sample - 0.85) * 0.15;
                    else if (sample < -0.85) sample = -0.85 + (sample + 0.85) * 0.15;

                    pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                }
                
                // Si la radio está transmitiendo en red P2P (envía frecuencia nativa):
                if (isTransmitting) {
                    socket.emit('AUDIO_STREAM', {
                        sr: ctx.sampleRate,
                        pcm: pcm16.buffer
                    });
                }

                // Si la radio está realizando prueba local de 5s:
                if (isTestRecording) {
                    recordedTestChunks.push(new Int16Array(pcm16));
                }
            };

            // Conectar scriptProcessor con nodo de ganancia 0 para prevenir eco local sin bloquear procesador en iOS
            const zeroGain = ctx.createGain();
            zeroGain.gain.value = 0;
            captureCompressor.connect(scriptProcessor);
            scriptProcessor.connect(zeroGain);
            zeroGain.connect(ctx.destination);
        } catch (err) {
            console.error('Error al acceder al micrófono:', err);
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                const httpsUrl = `https://${location.hostname}:8443`;
                if (confirm('iOS/Android requiere abrir la versión HTTPS segura para habilitar el micrófono.\n\n¿Deseas redirigir a la versión HTTPS segura ahora?')) {
                    window.location.href = httpsUrl;
                    return;
                }
            }
            alert('No se pudo acceder al micrófono del celular. Asegúrate de estar en la dirección HTTPS (puerto 8443) y permitir el uso del micrófono.');
            stopTransmitting();
        }
    }

    function updateLocalVuMeter() {
        if ((!isTransmitting && !isTestRecording && !isLiveEcoActive && !isVoxModeActive) || !analyserNode) return;
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const level = Math.min(100, Math.round((average / 128) * 100));
        drawVuMeter(level);

        vuAnimationId = requestAnimationFrame(updateLocalVuMeter);
    }

    // --- LÓGICA DE PRUEBA Y ECO LOCAL EN UN SOLO CELULAR ---

    function toggleLiveEco() {
        unlockAudio();
        isLiveEcoActive = !isLiveEcoActive;
        const ctx = getAudioContext();

        if (isLiveEcoActive) {
            testLiveBtn.classList.add('active-live');
            testLiveLabel.textContent = '🎧 ECO (0.5s) ACTIVO';
            startAudioCapture().then(() => {
                if (!liveEcoGainNode) {
                    liveEcoGainNode = ctx.createGain();
                }
                if (!liveEcoDelayNode) {
                    liveEcoDelayNode = ctx.createDelay(1.0);
                }
                liveEcoDelayNode.delayTime.setValueAtTime(0.5, ctx.currentTime); // Retraso de 0.5 segundos (500ms)
                liveEcoGainNode.gain.setValueAtTime(0.65, ctx.currentTime);

                if (dspPeakFilter) {
                    try { dspPeakFilter.disconnect(liveEcoDelayNode); } catch(e){}
                    try { dspPeakFilter.disconnect(liveEcoGainNode); } catch(e){}
                    try { liveEcoDelayNode.disconnect(); } catch(e){}

                    dspPeakFilter.connect(liveEcoDelayNode);
                    liveEcoDelayNode.connect(liveEcoGainNode);
                    liveEcoGainNode.connect(ctx.destination);
                }
            });
        } else {
            testLiveBtn.classList.remove('active-live');
            testLiveLabel.textContent = 'ECO EN VIVO (0.5s)';
            if (liveEcoDelayNode) {
                try { liveEcoDelayNode.disconnect(); } catch(e){}
                liveEcoDelayNode = null;
            }
            if (liveEcoGainNode) {
                try { liveEcoGainNode.disconnect(); } catch(e){}
                liveEcoGainNode = null;
            }
        }
    }

    if (testLiveBtn) {
        testLiveBtn.addEventListener('click', toggleLiveEco);
    }

    function resetTestButtonState() {
        isTestRecording = false;
        isTestPlaying = false;
        if (testRecordBtn) {
            testRecordBtn.classList.remove('recording');
            testRecordBtn.classList.remove('playing');
        }
        if (testRecordLabel) {
            testRecordLabel.textContent = 'PROBAR GRABACIÓN (5s)';
        }
    }

    async function start5sTestRecord() {
        if (isTestRecording || isTestPlaying) return;
        unlockAudio();

        isTestRecording = true;
        testRecordBtn.classList.add('recording');
        testRecordLabel.textContent = 'INICIANDO MIC...';

        let localTestStream = null;

        try {
            const ctx = getAudioContext();

            // Solicitar siempre un stream de micrófono fresco para evitar bloqueos de iOS Safari al reutilizar tracks detenidos
            localTestStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });

            // Conectar el flujo del micrófono a los filtros DSP seleccionados
            const micSource = ctx.createMediaStreamSource(localTestStream);
            const dspDest = ctx.createMediaStreamDestination();
            const prof = DSP_PROFILES[currentAudioDspProfile] || DSP_PROFILES.standard;

            if (currentAudioDspProfile !== 'standard') {
                const hp = ctx.createBiquadFilter();
                hp.type = 'highpass';
                hp.frequency.value = prof.highpassCutoff;

                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass';
                lp.frequency.value = prof.lowpassCutoff;

                const peak = ctx.createBiquadFilter();
                peak.type = 'peaking';
                peak.frequency.value = prof.peakingFreq;
                peak.Q.value = 1.2;
                peak.gain.value = prof.peakingGain;

                micSource.connect(hp);
                hp.connect(lp);
                lp.connect(peak);
                peak.connect(dspDest);
            } else {
                micSource.connect(dspDest);
            }

            const streamToRecord = (dspDest && dspDest.stream) ? dspDest.stream : localTestStream;

            // Determinar códec nativo compatible con el dispositivo
            let options = {};
            if (typeof MediaRecorder !== 'undefined') {
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus' };
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/mp4' };
                } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                    options = { mimeType: 'audio/aac' };
                }
            }

            const recordedBlobs = [];
            let recorder = null;

            try {
                recorder = new MediaRecorder(streamToRecord, options);
            } catch(e) {
                recorder = new MediaRecorder(streamToRecord);
            }

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedBlobs.push(e.data);
                }
            };

            let secondsLeft = 5;
            testRecordLabel.textContent = `GRABANDO (${secondsLeft}s)...`;

            const countdownTimer = setInterval(() => {
                secondsLeft--;
                if (secondsLeft > 0) {
                    testRecordLabel.textContent = `GRABANDO (${secondsLeft}s)...`;
                } else {
                    clearInterval(countdownTimer);
                    if (recorder && recorder.state !== 'inactive') {
                        try { recorder.stop(); } catch(e){}
                    }
                }
            }, 1000);

            recorder.onstop = () => {
                // Liberar el micrófono de prueba inmediatamente
                try {
                    localTestStream.getTracks().forEach(t => t.stop());
                } catch(e) {}

                isTestRecording = false;
                testRecordBtn.classList.remove('recording');

                const blob = new Blob(recordedBlobs, { type: recorder.mimeType || 'audio/webm' });
                playNative5sBlobPlayback(blob);
            };

            recorder.onerror = (err) => {
                console.error('Error en MediaRecorder de prueba:', err);
                try { localTestStream.getTracks().forEach(t => t.stop()); } catch(e){}
                resetTestButtonState();
            };

            recorder.start(100);

        } catch (err) {
            console.error('No se pudo acceder al micrófono para la prueba:', err);
            if (localTestStream) {
                try { localTestStream.getTracks().forEach(t => t.stop()); } catch(e){}
            }
            alert('No se pudo acceder al micrófono del celular. Asegúrate de otorgar los permisos de micrófono.');
            resetTestButtonState();
        }
    }

    function playNative5sBlobPlayback(blob) {
        if (!blob || blob.size === 0) {
            resetTestButtonState();
            return;
        }

        isTestPlaying = true;
        testRecordBtn.classList.add('playing');
        testRecordLabel.textContent = '▶️ ESCUCHANDO PRUEBA...';

        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.volume = parseFloat(volumeControl.value);

        let vuTimer = setInterval(() => {
            drawVuMeter(Math.floor(Math.random() * 45) + 35);
        }, 60);

        function cleanupPlayback() {
            if (vuTimer) {
                clearInterval(vuTimer);
                vuTimer = null;
            }
            drawVuMeter(0);
            try { URL.revokeObjectURL(audioUrl); } catch(e){}
            resetTestButtonState();
        }

        audio.onended = cleanupPlayback;
        audio.onerror = (err) => {
            console.error('Error reproduciendo prueba:', err);
            cleanupPlayback();
        };

        audio.play().catch(e => {
            console.error('Error al iniciar reproductor nativo:', e);
            cleanupPlayback();
        });
    }

    if (testRecordBtn) {
        testRecordBtn.addEventListener('click', start5sTestRecord);
    }

    function stopTransmitting() {
        if (voxHangoverTimer) {
            clearTimeout(voxHangoverTimer);
            voxHangoverTimer = null;
        }
        isVoxTransmitting = false;
        isVoxRequestPending = false;
        if (isTransmitting) {
            isTransmitting = false;
            if (scriptProcessor) {
                try {
                    scriptProcessor.disconnect();
                } catch(e) {}
                scriptProcessor = null;
            }
            if (vuAnimationId) {
                cancelAnimationFrame(vuAnimationId);
            }
            drawVuMeter(0);
            pttButton.classList.remove('transmitting');
            pttLabel.innerHTML = 'MANTÉN PRESIONADO<br>PARA HABLAR';
            txRxIndicator.textContent = 'RX STANDBY';
            txRxIndicator.className = 'tx-rx-indicator';
            speakerCallsign.textContent = 'Frecuencia Despejada';
            speakerIcon.classList.add('hidden');
            playRadioClickSound();
            socket.emit('STOP_TRANSMIT');
        }
        if (isVoxModeActive) {
            startAudioCapture();
        }
    }

    // --- CONTROLES Y EVENTOS DE INTERFAZ ---

    let pttAutoStopTimer = null;

    // --- CONTROLES Y MANEJO DE MODO VOX (ACTIVACIÓN POR VOZ) ---
    function updateVoxSensitivity() {
        if (!voxSensControl) return;
        voxSens = parseInt(voxSensControl.value, 10) || 5;
        voxThreshold = 0.055 - (voxSens * 0.005);
        let sensLabel = 'Normal';
        if (voxSens <= 3) sensLabel = 'Baja (Ruido)';
        else if (voxSens >= 8) sensLabel = 'Alta (Susurro)';
        if (voxSensVal) {
            voxSensVal.textContent = `${voxSens} (${sensLabel})`;
        }
    }

    if (toggleVoxMode) {
        toggleVoxMode.addEventListener('change', () => {
            unlockAudio();
            isVoxModeActive = toggleVoxMode.checked;
            if (isVoxModeActive) {
                if (voxSensBox) voxSensBox.classList.remove('hidden');
                if (voxLcdBadge) voxLcdBadge.classList.remove('hidden');
                updateVoxSensitivity();
                startAudioCapture();
            } else {
                if (voxSensBox) voxSensBox.classList.add('hidden');
                if (voxLcdBadge) voxLcdBadge.classList.add('hidden');
                if (voxHangoverTimer) {
                    clearTimeout(voxHangoverTimer);
                    voxHangoverTimer = null;
                }
                if (isVoxTransmitting) {
                    stopTransmitting();
                }
                isVoxTransmitting = false;
                isVoxRequestPending = false;
            }
        });
    }

    if (voxSensControl) {
        voxSensControl.addEventListener('input', updateVoxSensitivity);
    }

    // PTT Press and Hold / Toggle
    function handlePttDown(e) {
        if (e && e.cancelable) e.preventDefault();
        if (isReceiving) {
            return;
        }

        if (voxHangoverTimer) {
            clearTimeout(voxHangoverTimer);
            voxHangoverTimer = null;
        }
        isVoxTransmitting = false;
        isVoxRequestPending = false;

        if (togglePttMode.checked) {
            if (isTransmitting) {
                stopTransmitting();
            } else {
                socket.emit('REQUEST_TRANSMIT');
            }
        } else {
            if (!isTransmitting) {
                socket.emit('REQUEST_TRANSMIT');
            }
        }
    }

    function handlePttUp(e) {
        if (e && e.cancelable) e.preventDefault();
        if (!togglePttMode.checked && isTransmitting) {
            stopTransmitting();
        }
    }

    // Eventos PTT directos sobre el botón
    pttButton.addEventListener('mousedown', handlePttDown);
    pttButton.addEventListener('mouseup', handlePttUp);
    pttButton.addEventListener('mouseleave', handlePttUp);
    pttButton.addEventListener('touchstart', handlePttDown, { passive: false });
    pttButton.addEventListener('touchend', handlePttUp, { passive: false });
    pttButton.addEventListener('touchcancel', handlePttUp, { passive: false });
    pttButton.addEventListener('pointerdown', handlePttDown);
    pttButton.addEventListener('pointerup', handlePttUp);
    pttButton.addEventListener('pointercancel', handlePttUp);
    pttButton.addEventListener('contextmenu', (e) => e.preventDefault());

    // Respaldos globales: Liberar PTT si la pantalla se toca/suelta en cualquier parte
    ['touchend', 'touchcancel', 'mouseup', 'pointerup', 'pointercancel', 'blur'].forEach(evt => {
        window.addEventListener(evt, () => {
            if (isTransmitting && !togglePttMode.checked) {
                stopTransmitting();
            }
        }, { passive: true });
    });

    // Soporte para Teclado (Barra Espaciadora / Tecla P)
    window.addEventListener('keydown', (e) => {
        if ((e.code === 'Space' || e.code === 'KeyP') && document.activeElement.tagName !== 'INPUT') {
            if (!isTransmitting) {
                e.preventDefault();
                handlePttDown(e);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if ((e.code === 'Space' || e.code === 'KeyP') && document.activeElement.tagName !== 'INPUT') {
            if (isTransmitting && !togglePttMode.checked) {
                e.preventDefault();
                handlePttUp(e);
            }
        }
    });

    // Selector de Canales
    document.querySelectorAll('.channel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const chanId = parseInt(btn.dataset.channel, 10);
            document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateLcdChannel(chanId);
            socket.emit('CHANGE_CHANNEL', chanId);
        });
    });

    function updateLcdChannel(channelId) {
        lcdChannelNum.textContent = `CH ${channelId}`;
        const channelNames = {
            1: 'CANAL 1 - EMERGENCIA Y SOS',
            2: 'CANAL 2 - BÚSQUEDA Y RESCATE',
            3: 'CANAL 3 - LOGÍSTICA Y SUMINISTROS',
            4: 'CANAL 4 - GENERAL Y COMUNIDAD'
        };
        lcdChannelName.textContent = channelNames[channelId] || `CANAL ${channelId}`;
    }

    // Edición de Callsign
    callsignInput.addEventListener('change', () => {
        const newCallsign = callsignInput.value.trim();
        if (newCallsign) {
            myProfile.callsign = newCallsign;
            socket.emit('UPDATE_PROFILE', { callsign: newCallsign });
        }
    });

    // Disparador de Alerta SOS
    sosTriggerBtn.addEventListener('click', () => {
        const confirmSos = confirm('¿Confirmas la emisión de una ALERTA DE AUXILIO SOS a todas las radios en cobertura?');
        if (confirmSos) {
            sosSilenced = false;
            socket.emit('SEND_SOS', {
                message: '¡SOLICITUD DE RESCATE / AUXILIO URGENTE!',
                location: myProfile.location
            });
        }
    });

    function showSosBanner(sosData) {
        currentSosId = sosData.id || null;
        sosCallsign.textContent = sosData.callsign;
        sosMsg.textContent = sosData.message;
        if (sosData.location) {
            sosLocation.textContent = `GPS: Lat ${sosData.location.lat.toFixed(4)}, Lng ${sosData.location.lng.toFixed(4)}`;
        } else {
            sosLocation.textContent = 'GPS: Ubicación no disponible';
        }
        sosBanner.classList.remove('hidden');
    }

    silenceSosBtn.addEventListener('click', () => {
        sosSilenced = true;
        stopSosSiren();
        sosBanner.classList.add('hidden');
        socket.emit('CANCEL_SOS', currentSosId);
    });

    // Render de Lista de Radios Conectadas
    function renderPeersList(peersArray) {
        peersList.innerHTML = '';
        peersArray.forEach(peer => {
            const card = document.createElement('div');
            card.className = 'peer-card';

            const statusClass = peer.status.toLowerCase();
            const isMe = peer.id === socket.id ? ' (ESTE DISPOSITIVO)' : '';

            card.innerHTML = `
                <div class="peer-info">
                    <strong>${peer.callsign}${isMe}</strong>
                    <p>Canal Activo: CH ${peer.channel} | Batería: ${peer.battery}%</p>
                </div>
                <div class="peer-status ${statusClass}">
                    ${peer.status}
                </div>
            `;
            peersList.appendChild(card);
        });
    }

    // Chat Táctico
    function addChatMessage(msgData) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg';
        msgDiv.innerHTML = `
            <span class="author">${msgData.callsign} [CH ${msgData.channel}]</span>
            <span class="time">${msgData.timestamp}</span>
            <p>${msgData.text}</p>
        `;
        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    sendChatBtn.addEventListener('click', sendTacticalMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendTacticalMessage();
    });

    function sendTacticalMessage() {
        const text = chatInput.value.trim();
        if (text) {
            socket.emit('SEND_TACTICAL_TEXT', { text });
            chatInput.value = '';
        }
    }

    // Botones de Mensajes Rápidos
    document.querySelectorAll('.quick-msg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value = btn.textContent;
            sendTacticalMessage();
        });
    });

    // Pestañas de Navegación Inferior
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const targetTab = tab.dataset.tab;
            document.querySelectorAll('.radio-body, .tab-content').forEach(el => {
                if (el.id === targetTab || (targetTab === 'tabRadio' && el.classList.contains('radio-body'))) {
                    el.classList.remove('hidden');
                } else {
                    el.classList.add('hidden');
                }
            });
        });
    });

    // MODAL DE RED Y CÓDIGO QR
    infoBtn.addEventListener('click', fetchNetworkInfo);
    closeModalBtn.addEventListener('click', () => infoModal.classList.add('hidden'));
    closeModalOkBtn.addEventListener('click', () => infoModal.classList.add('hidden'));

    async function fetchNetworkInfo() {
        try {
            const res = await fetch('/api/network-info');
            const data = await res.json();
            
            networkAddressesList.innerHTML = '';
            if (data.addresses.length === 0) {
                networkAddressesList.innerHTML = '<p>Conecta este celular a una Zona Wi-Fi o Red Local.</p>';
            } else {
                data.addresses.forEach(addr => {
                    const p = document.createElement('p');
                    p.innerHTML = `<strong>${addr.interface}:</strong> http://${addr.address}:${data.port}`;
                    networkAddressesList.appendChild(p);
                });
            }
            infoModal.classList.remove('hidden');
        } catch (e) {
            infoModal.classList.remove('hidden');
        }
    }

    // BATERÍA Y GEOLOCALIZACIÓN
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            function updateBattery() {
                const level = Math.round(battery.level * 100);
                myProfile.battery = level;
                batteryStatus.innerHTML = `<i class="fa-solid fa-battery-full"></i> ${level}%`;
                socket.emit('UPDATE_PROFILE', { battery: level });
            }
            updateBattery();
            battery.addEventListener('levelchange', updateBattery);
        });
    }

    function initGeolocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.watchPosition(
                (pos) => {
                    myProfile.location = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        acc: pos.coords.accuracy
                    };
                    gpsStatus.innerHTML = '<i class="fa-solid fa-location-crosshairs" style="color:#00ff66"></i>';
                    gpsStatus.title = `GPS Activo (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
                    socket.emit('UPDATE_PROFILE', { location: myProfile.location });
                },
                (err) => {
                    gpsStatus.title = 'GPS Desactivado / Sin Señal';
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }
    }

    requestGeoBtn.addEventListener('click', initGeolocation);
    initGeolocation();

    // REGISTRO DE SERVICE WORKER PARA PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => {
            console.log('[PWA] Service Worker registrado correctamente.');
        }).catch(err => {
            console.log('[PWA] Error al registrar Service Worker:', err);
        });
    }
});
