/* ==========================================================================
   MOTOR DE MISIÓN CRÍTICA DESCENTRALIZADO: S.O.S. RESCATE (v36)
   100% Serverless P2P (GitHub Pages / PWA Offline) + WebRTC Directo + Auto-Mesh
   Audio HD Fullband | Zero-Touch VOX | Detector de Escombros | Radar GPS | Caja Negra
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- 0. REGISTRO DE SERVICE WORKER PARA CACHÉ 100% OFFLINE ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(() => {
            console.log('[PWA] Service Worker v36 registrado para operación 100% sin internet.');
        }).catch(err => console.warn('[PWA] Advertencia SW:', err));
    }

    // --- 1. IDENTIDAD PERSISTENTE DEL NODO (SIN DEPENDER DE SERVIDOR CENTRAL) ---
    let myNodeId = localStorage.getItem('sos_node_id');
    if (!myNodeId) {
        myNodeId = 'NODE-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('sos_node_id', myNodeId);
    }

    let savedCallsign = localStorage.getItem('sos_callsign');
    if (!savedCallsign) {
        savedCallsign = 'RESCATE-' + Math.floor(100 + Math.random() * 899);
        localStorage.setItem('sos_callsign', savedCallsign);
    }

    // --- 2. ADAPTADOR HÍBRIDO SOCKET.IO (OPCIONAL SI HAY SERVIDOR LOCAL) ---
    const noopSocket = {
        id: myNodeId,
        connected: false,
        emit: () => {},
        on: () => {},
        connect: () => {}
    };
    const socket = (typeof window.io === 'function') ? window.io({
        reconnectionAttempts: 3,
        timeout: 4000
    }) : noopSocket;

    // --- ELEMENTOS DEL DOM ---
    const meshStatusBadge = document.getElementById('meshStatusBadge');
    const meshStatusText = document.getElementById('meshStatusText');
    const emergencyCallsignInput = document.getElementById('emergencyCallsignInput');
    const batteryChip = document.getElementById('batteryChip');
    const batteryText = document.getElementById('batteryText');
    const gpsChip = document.getElementById('gpsChip');
    const gpsText = document.getElementById('gpsText');
    const p2pMeshChip = document.getElementById('p2pMeshChip');
    const p2pMeshText = document.getElementById('p2pMeshText');
    const pwaInstallBtn = document.getElementById('pwaInstallBtn');
    const blackoutToggleBtn = document.getElementById('blackoutToggleBtn');
    const oledBlackoutOverlay = document.getElementById('oledBlackoutOverlay');

    const criticalSosBanner = document.getElementById('criticalSosBanner');
    const sosOriginCallsign = document.getElementById('sosOriginCallsign');
    const sosDetails = document.getElementById('sosDetails');
    const silenceSosAlarmBtn = document.getElementById('silenceSosAlarmBtn');
    const micPromptBanner = document.getElementById('micPromptBanner');

    const navButtons = document.querySelectorAll('.nav-btn');
    const opPanels = document.querySelectorAll('.op-panel');

    // Panel Intercomunicador HD
    const emergencyChannelSelect = document.getElementById('emergencyChannelSelect');
    const intercomStatusBox = document.getElementById('intercomStatusBox');
    const intercomStatusLabel = document.getElementById('intercomStatusLabel');
    const statusPulseIcon = document.getElementById('statusPulseIcon');
    const waveformCanvas = document.getElementById('waveformCanvas');
    const waveCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;

    const voxHandsFreeToggle = document.getElementById('voxHandsFreeToggle');
    const voxSensitivity = document.getElementById('voxSensitivity');
    const voxSensLabel = document.getElementById('voxSensLabel');
    const emergencyPttBtn = document.getElementById('emergencyPttBtn');
    const pttMainLabel = document.getElementById('pttMainLabel');
    const triggerEmergencySosBtn = document.getElementById('triggerEmergencySosBtn');

    // Panel Triage & Censo
    const triageButtons = document.querySelectorAll('.triage-btn');
    const meshPeersCount = document.getElementById('meshPeersCount');
    const censusList = document.getElementById('censusList');

    // Panel Radar Táctico & Brújula
    const radarTargetSelect = document.getElementById('radarTargetSelect');
    const radarArrowWrapper = document.getElementById('radarArrowWrapper');
    const radarDistanceValue = document.getElementById('radarDistanceValue');
    const radarBearingValue = document.getElementById('radarBearingValue');
    const radarMyCoords = document.getElementById('radarMyCoords');
    const radarTargetCoords = document.getElementById('radarTargetCoords');
    const radarSpeakHeadingBtn = document.getElementById('radarSpeakHeadingBtn');
    const radarCalibrateBtn = document.getElementById('radarCalibrateBtn');

    // Panel Baliza & Sensor
    const acousticSensorToggle = document.getElementById('acousticSensorToggle');
    const hitDot1 = document.getElementById('hitDot1');
    const hitDot2 = document.getElementById('hitDot2');
    const hitDot3 = document.getElementById('hitDot3');
    const sensorStatusText = document.getElementById('sensorStatusText');
    const audioBeaconBtn = document.getElementById('audioBeaconBtn');
    const audioBeaconLabel = document.getElementById('audioBeaconLabel');
    const flashStrobeBtn = document.getElementById('flashStrobeBtn');
    const flashStrobeLabel = document.getElementById('flashStrobeLabel');

    // Panel Mensajes & TTS
    const ttsAudioReadToggle = document.getElementById('ttsAudioReadToggle');
    const quickSosMessages = document.querySelectorAll('.quick-sos-msg');
    const emergencyChatHistory = document.getElementById('emergencyChatHistory');
    const emergencyChatInput = document.getElementById('emergencyChatInput');
    const emergencySendChatBtn = document.getElementById('emergencySendChatBtn');

    // Panel Caja Negra / Bitácora
    const bbTotalCount = document.getElementById('bbTotalCount');
    const bbSosCount = document.getElementById('bbSosCount');
    const bbVictimsCount = document.getElementById('bbVictimsCount');
    const bbExportBtn = document.getElementById('bbExportBtn');
    const bbSpeakLastBtn = document.getElementById('bbSpeakLastBtn');
    const bbClearBtn = document.getElementById('bbClearBtn');
    const blackboxTimeline = document.getElementById('blackboxTimeline');

    // Modal P2P Offline
    const p2pOfflineModal = document.getElementById('p2pOfflineModal');
    const closeP2pModalBtn = document.getElementById('closeP2pModalBtn');
    const btnCreateP2pOffer = document.getElementById('btnCreateP2pOffer');
    const btnAcceptP2pStep = document.getElementById('btnAcceptP2pStep');
    const p2pQrContainer = document.getElementById('p2pQrContainer');
    const p2pTokenBox = document.getElementById('p2pTokenBox');
    const btnCopyP2pToken = document.getElementById('btnCopyP2pToken');
    const btnConnectP2pToken = document.getElementById('btnConnectP2pToken');

    // Modal iOS PWA
    const iosInstallModal = document.getElementById('iosInstallModal');
    const closeIosModalBtn = document.getElementById('closeIosModalBtn');
    const ackIosModalBtn = document.getElementById('ackIosModalBtn');

    // --- ESTADO LOCAL DEL DISPOSITIVO ---
    let myProfile = {
        id: myNodeId,
        callsign: savedCallsign,
        channel: 1,
        status: 'IDLE',
        triage: 'OK',
        battery: 100,
        location: null
    };

    if (emergencyCallsignInput) {
        emergencyCallsignInput.value = myProfile.callsign;
    }

    const discoveredPeers = new Map(); // nodeId -> peerProfile
    let latestPeers = [];
    let isTransmitting = false;
    let isReceiving = false;
    let rxTimeoutTimer = null;
    let isVoxActive = false;
    let isVoxTransmitting = false;
    let isVoxRequestPending = false;
    let voxHangoverTimer = null;
    let voxThreshold = 0.025;

    // --- SCREEN WAKE LOCK: EVITAR QUE LA PANTALLA SE APAGUE EN EMERGENCIAS ---
    let screenWakeLock = null;
    async function requestScreenWakeLock() {
        try {
            if ('wakeLock' in navigator && (!screenWakeLock || screenWakeLock.released)) {
                screenWakeLock = await navigator.wakeLock.request('screen');
                screenWakeLock.addEventListener('release', () => {
                    screenWakeLock = null;
                });
            }
        } catch (err) {}
    }

    // --- MOTOR WEB AUDIO NATIVO Y PIPELINE PERSISTENTE ---
    let audioContext = null;
    let micStream = null;
    let micSourceNode = null;
    let micCompressor = null;
    let micScriptNode = null;
    let micZeroGain = null;
    let isMicReady = false;
    let isInitializingMic = false;
    let nextPlayTime = 0;
    let rxMasterBus = null;

    let activeBeaconOsc = null;
    let isStrobeActive = false;
    let torchTrack = null;
    let strobeInterval = null;

    let hitTimestamps = [];
    let lastSensorAnalysisTime = 0;
    let visualizerAnimId = null;

    // Desduplicación Universal Malla
    const seenMeshMsgs = new Set();
    function registerMeshMsg(msgId) {
        if (!msgId) return false;
        if (seenMeshMsgs.has(msgId)) return true;
        seenMeshMsgs.add(msgId);
        if (seenMeshMsgs.size > 1500) {
            const first = seenMeshMsgs.values().next().value;
            seenMeshMsgs.delete(first);
        }
        return false;
    }

    function getAudioContext() {
        if (!audioContext) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioContext = new AudioCtx();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
        return audioContext;
    }

    function unlockAudioAndWake() {
        requestScreenWakeLock();
        try {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
        } catch (e) {}
    }

    ['touchstart', 'touchend', 'click', 'keydown', 'mousedown'].forEach(ev => {
        window.addEventListener(ev, unlockAudioAndWake, { passive: true });
    });

    // --- CONVERSIÓN COMPACTA BASE64 Y RE-MUESTREO ---
    function int16ToBase64(int16Arr) {
        const u8 = new Uint8Array(int16Arr.buffer, int16Arr.byteOffset, int16Arr.byteLength);
        let binary = '';
        for (let i = 0; i < u8.length; i++) {
            binary += String.fromCharCode(u8[i]);
        }
        return btoa(binary);
    }

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

    function getInt16ArrayFromPayload(rawPcm) {
        if (!rawPcm) return new Int16Array(0);
        if (typeof rawPcm === 'string') {
            try {
                const binary = atob(rawPcm);
                const len = binary.length - (binary.length % 2);
                const u8 = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    u8[i] = binary.charCodeAt(i);
                }
                return new Int16Array(u8.buffer);
            } catch (e) {
                return new Int16Array(0);
            }
        }
        if (rawPcm instanceof Int16Array) return rawPcm;
        if (rawPcm instanceof ArrayBuffer) {
            const len = rawPcm.byteLength - (rawPcm.byteLength % 2);
            return new Int16Array(rawPcm, 0, len / 2);
        }
        if (ArrayBuffer.isView(rawPcm)) {
            try {
                const buf = rawPcm.buffer.slice(rawPcm.byteOffset, rawPcm.byteOffset + rawPcm.byteLength);
                const len = buf.byteLength - (buf.byteLength % 2);
                return new Int16Array(buf, 0, len / 2);
            } catch (e) {}
        }
        if (typeof rawPcm === 'object' && rawPcm.data) {
            return getInt16ArrayFromPayload(rawPcm.data);
        }
        if (Array.isArray(rawPcm)) {
            return new Int16Array(rawPcm);
        }
        return new Int16Array(0);
    }

    function getRxMasterBus(ctx) {
        if (!rxMasterBus) {
            const hpFilter = ctx.createBiquadFilter();
            hpFilter.type = 'highpass';
            hpFilter.frequency.value = 140;

            const peakFilter = ctx.createBiquadFilter();
            peakFilter.type = 'peaking';
            peakFilter.frequency.value = 2800;
            peakFilter.gain.value = 4.0;
            peakFilter.Q.value = 1.2;

            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -20;
            comp.knee.value = 10;
            comp.ratio.value = 3.5;
            comp.attack.value = 0.003;
            comp.release.value = 0.12;

            hpFilter.connect(peakFilter);
            peakFilter.connect(comp);
            comp.connect(ctx.destination);
            rxMasterBus = hpFilter;
        }
        return rxMasterBus;
    }

    function playAudioChunk(chunkPayload, senderCallsign = 'PAR') {
        try {
            unlockAudioAndWake();
            const ctx = getAudioContext();
            const rawPcm = chunkPayload.b64 || chunkPayload.pcm || chunkPayload;
            const senderSr = chunkPayload.sr || 24000;

            const int16Array = getInt16ArrayFromPayload(rawPcm);
            if (int16Array.length === 0) return;

            if (!isReceiving) {
                isReceiving = true;
                intercomStatusBox.className = 'tx-rx-status receiving';
                intercomStatusLabel.textContent = `RECIBIENDO: ${senderCallsign}`;
                statusPulseIcon.className = 'fa-solid fa-volume-high';
                startVisualizer();
            }

            if (rxTimeoutTimer) clearTimeout(rxTimeoutTimer);
            rxTimeoutTimer = setTimeout(() => {
                isReceiving = false;
                intercomStatusBox.className = 'tx-rx-status';
                intercomStatusLabel.textContent = 'LISTO - CANAL DESPEJADO';
                statusPulseIcon.className = 'fa-solid fa-wave-square';
                stopVisualizer();
            }, 650);

            let floatSamples = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                floatSamples[i] = (int16Array[i] / 32768.0) * 1.65;
            }

            if (senderSr !== ctx.sampleRate) {
                floatSamples = resampleFloatArray(floatSamples, senderSr, ctx.sampleRate);
            }

            const audioBuffer = ctx.createBuffer(1, floatSamples.length, ctx.sampleRate);
            audioBuffer.getChannelData(0).set(floatSamples);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(getRxMasterBus(ctx));

            const now = ctx.currentTime;
            if (nextPlayTime < now || (nextPlayTime - now) > 0.12) {
                nextPlayTime = now + 0.015;
            }

            source.start(nextPlayTime);
            nextPlayTime += audioBuffer.duration;

            triggerIncomingWaveAnimation();
        } catch (e) {
            console.error('[Audio RX] Error reproduciendo paquete HD:', e);
        }
    }

    // --- PIPELINE DE MICRÓFONO PERSISTENTE ---
    async function initMicPipeline() {
        if (isMicReady && micStream && micStream.active) {
            const liveTracks = micStream.getAudioTracks().filter(t => t.readyState === 'live');
            if (liveTracks.length > 0) return true;
        }
        if (isInitializingMic) return false;
        isInitializingMic = true;

        try {
            unlockAudioAndWake();
            const ctx = getAudioContext();

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Tu navegador requiere HTTPS para habilitar el micrófono.');
                isInitializingMic = false;
                return false;
            }

            cleanupMicTracks();

            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                    sampleRate: { ideal: 48000 }
                }
            });

            micStream.getAudioTracks().forEach(track => {
                track.onended = () => {
                    isMicReady = false;
                };
            });

            micSourceNode = ctx.createMediaStreamSource(micStream);

            micCompressor = ctx.createDynamicsCompressor();
            micCompressor.threshold.value = -24;
            micCompressor.knee.value = 15;
            micCompressor.ratio.value = 3.5;
            micCompressor.attack.value = 0.003;
            micCompressor.release.value = 0.15;

            micScriptNode = ctx.createScriptProcessor(2048, 1, 1);

            micScriptNode.onaudioprocess = (e) => {
                if (!isTransmitting && !isVoxActive && (!acousticSensorToggle || !acousticSensorToggle.checked)) {
                    return;
                }

                const inputData = e.inputBuffer.getChannelData(0);

                let sumSquares = 0;
                let peak = 0;
                for (let i = 0; i < inputData.length; i++) {
                    const absVal = Math.abs(inputData[i]);
                    if (absVal > peak) peak = absVal;
                    sumSquares += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sumSquares / inputData.length);

                if (acousticSensorToggle && acousticSensorToggle.checked && !isTransmitting && !isReceiving) {
                    evaluateAcousticImpacts(peak, rms);
                }

                if (isVoxActive && !isReceiving) {
                    if (rms > voxThreshold) {
                        if (voxHangoverTimer) {
                            clearTimeout(voxHangoverTimer);
                            voxHangoverTimer = null;
                        }
                        if (!isTransmitting && !isVoxRequestPending) {
                            isVoxTransmitting = true;
                            startTransmitting();
                        }
                    } else if (rms <= voxThreshold && isVoxTransmitting && isTransmitting) {
                        if (!voxHangoverTimer) {
                            voxHangoverTimer = setTimeout(() => {
                                stopTransmitting();
                            }, 850);
                        }
                    }
                }

                if (isTransmitting) {
                    // Sub-muestrear a 24kHz Wideband HD para máxima velocidad en WebRTC y Malla P2P
                    const targetSr = 24000;
                    const resampled = resampleFloatArray(inputData, ctx.sampleRate, targetSr);
                    const pcm16 = new Int16Array(resampled.length);
                    for (let i = 0; i < resampled.length; i++) {
                        let sample = resampled[i] * 1.15;
                        if (sample > 0.95) sample = 0.95;
                        else if (sample < -0.95) sample = -0.95;
                        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    }

                    const b64Audio = int16ToBase64(pcm16);
                    const packetId = `AUD-${myNodeId}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
                    registerMeshMsg(packetId);

                    const audioPacket = {
                        type: 'AUDIO_CHUNK',
                        msgId: packetId,
                        originId: myNodeId,
                        channel: myProfile.channel,
                        callsign: myProfile.callsign,
                        data: {
                            sr: targetSr,
                            b64: b64Audio
                        }
                    };

                    // Enviar por Malla P2P WebRTC directa + Broker Descentralizado
                    broadcastMeshPacket(audioPacket);

                    // Si además hay un servidor local Socket.IO conectado:
                    if (socket && socket.connected) {
                        socket.emit('AUDIO_STREAM', {
                            sr: targetSr,
                            pcm: pcm16.buffer
                        });
                    }
                }
            };

            micZeroGain = ctx.createGain();
            micZeroGain.gain.value = 0;

            micSourceNode.connect(micCompressor);
            micCompressor.connect(micScriptNode);
            micScriptNode.connect(micZeroGain);
            micZeroGain.connect(ctx.destination);

            isMicReady = true;
            isInitializingMic = false;

            if (micPromptBanner) {
                micPromptBanner.innerHTML = '<i class="fa-solid fa-circle-check"></i> MICRÓFONO HD ACTIVO Y PROTEGIDO';
                micPromptBanner.style.background = '#0a3314';
                micPromptBanner.style.color = '#00ff66';
                setTimeout(() => {
                    micPromptBanner.classList.add('hidden');
                }, 2000);
            }
            return true;
        } catch (err) {
            console.error('[Mic] Error accediendo al micrófono:', err);
            isInitializingMic = false;
            isMicReady = false;
            if (micPromptBanner) {
                micPromptBanner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> TOCA AQUÍ PARA AUTORIZAR EL MICRÓFONO';
                micPromptBanner.classList.remove('hidden');
            }
            return false;
        }
    }

    function cleanupMicTracks() {
        if (micStream) {
            try { micStream.getTracks().forEach(t => t.stop()); } catch(e) {}
            micStream = null;
        }
        if (micSourceNode) {
            try { micSourceNode.disconnect(); } catch(e) {}
            micSourceNode = null;
        }
        if (micCompressor) {
            try { micCompressor.disconnect(); } catch(e) {}
            micCompressor = null;
        }
        if (micScriptNode) {
            try { micScriptNode.disconnect(); } catch(e) {}
            micScriptNode = null;
        }
        if (micZeroGain) {
            try { micZeroGain.disconnect(); } catch(e) {}
            micZeroGain = null;
        }
        isMicReady = false;
    }

    // --- VISUALIZADOR OSCILOSCOPIO EFICIENTE (0% CPU EN STANDBY) ---
    function drawFlatBaseline() {
        if (!waveCtx || !waveformCanvas) return;
        waveCtx.fillStyle = '#020502';
        waveCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
        waveCtx.lineWidth = 2;
        waveCtx.strokeStyle = '#00ff66';
        waveCtx.beginPath();
        waveCtx.moveTo(0, waveformCanvas.height / 2);
        waveCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
        waveCtx.stroke();
    }

    function runVisualizerFrame() {
        if (!isTransmitting && !isReceiving && !isVoxActive) {
            drawFlatBaseline();
            visualizerAnimId = null;
            return;
        }

        if (waveCtx && waveformCanvas) {
            waveCtx.fillStyle = '#020502';
            waveCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            waveCtx.lineWidth = 2;
            waveCtx.strokeStyle = isTransmitting ? '#ff2a2a' : (isReceiving ? '#00e5ff' : '#00ff66');
            waveCtx.beginPath();

            const width = waveformCanvas.width;
            const height = waveformCanvas.height;
            const mid = height / 2;
            const time = Date.now() / 35;

            waveCtx.moveTo(0, mid);
            for (let x = 0; x <= width; x += 6) {
                const waveAmp = (isTransmitting || isReceiving) ? 14 : 4;
                const y = mid + Math.sin((x * 0.08) + time) * waveAmp;
                waveCtx.lineTo(x, y);
            }
            waveCtx.stroke();
        }

        visualizerAnimId = requestAnimationFrame(runVisualizerFrame);
    }

    function startVisualizer() {
        if (!visualizerAnimId) {
            visualizerAnimId = requestAnimationFrame(runVisualizerFrame);
        }
    }

    function stopVisualizer() {
        if (visualizerAnimId) {
            cancelAnimationFrame(visualizerAnimId);
            visualizerAnimId = null;
        }
        drawFlatBaseline();
    }

    function triggerIncomingWaveAnimation() {
        if (!visualizerAnimId) {
            startVisualizer();
        }
    }

    drawFlatBaseline();

    // --- EVALUADOR ACÚSTICO DE IMPACTOS SOS (3 GOLPES EN ESCOMBROS) ---
    function evaluateAcousticImpacts(peak, rms) {
        const now = Date.now();
        if (peak > 0.40 && (peak / (rms + 0.001)) > 3.0) {
            if (now - lastSensorAnalysisTime > 260) {
                lastSensorAnalysisTime = now;
                hitTimestamps.push(now);
                hitTimestamps = hitTimestamps.filter(t => (now - t) < 2800);
                const count = hitTimestamps.length;
                scheduleHitDotsUpdate(count);

                if (count >= 3) {
                    hitTimestamps = [];
                    triggerAcousticSosAlert();
                }
            }
        }
    }

    function scheduleHitDotsUpdate(count) {
        setTimeout(() => {
            if (hitDot1) hitDot1.classList.toggle('active', count >= 1);
            if (hitDot2) hitDot2.classList.toggle('active', count >= 2);
            if (hitDot3) hitDot3.classList.toggle('active', count >= 3);

            if (sensorStatusText) {
                if (count > 0) {
                    sensorStatusText.textContent = `¡Impacto ${count} detectado! Esperando secuencia...`;
                    sensorStatusText.style.color = '#ffaa00';
                } else {
                    sensorStatusText.textContent = 'Sensor acústico activo. Esperando 3 golpes...';
                    sensorStatusText.style.color = '#6a8c6e';
                }
            }
        }, 0);
    }

    function triggerAcousticSosAlert() {
        if ('vibrate' in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
        speakEmergencyMessage('Patrón de rescate detectado. Alerta S O S transmitida a la red.', true);

        const sosMsg = '¡3 IMPACTOS RÍTMICOS DETECTADOS! (Posible sobreviviente bajo escombros)';
        emitUniversalSos(sosMsg);
        startAudioBeacon();
    }

    // --- MOTOR TEXT-TO-SPEECH (LECTURA DE VOZ OFFLINE) ---
    function speakEmergencyMessage(text, isHighPriority = false) {
        if (!('speechSynthesis' in window)) return;
        if (ttsAudioReadToggle && !ttsAudioReadToggle.checked && !isHighPriority) return;

        try {
            if (isHighPriority) {
                window.speechSynthesis.cancel();
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'es-ES';
            utterance.rate = 1.05;
            utterance.pitch = isHighPriority ? 1.2 : 1.0;
            utterance.volume = 1.0;
            window.speechSynthesis.speak(utterance);
        } catch (e) {}
    }

    // --- GESTIÓN DE TRANSMISIÓN PTT INSTANTÁNEA (SERVERLESS & LOCAL) ---
    function grantTransmitState() {
        isTransmitting = true;
        isVoxRequestPending = false;
        emergencyPttBtn.classList.add('transmitting');
        pttMainLabel.textContent = isVoxTransmitting ? 'VOX HABLANDO...' : 'TRANSMITIENDO...';
        intercomStatusBox.className = 'tx-rx-status transmitting';
        intercomStatusLabel.textContent = `TRANSMITIENDO EN VIVO (CH ${myProfile.channel})`;
        statusPulseIcon.className = 'fa-solid fa-microphone-lines';

        if ('vibrate' in navigator) navigator.vibrate(40);
        startVisualizer();

        broadcastMeshPacket({
            type: 'TRANSMIT_START',
            msgId: `TXS-${myNodeId}-${Date.now()}`,
            originId: myNodeId,
            callsign: myProfile.callsign,
            channel: myProfile.channel
        });
    }

    async function startTransmitting() {
        if (isTransmitting || isReceiving) return;
        unlockAudioAndWake();

        if (!isMicReady) {
            const ok = await initMicPipeline();
            if (!ok) return;
        }

        if (socket && socket.connected) {
            socket.emit('REQUEST_TRANSMIT');
        } else {
            // En modo Serverless P2P (GitHub Pages / Offline), conceder transmisión al instante (0ms)
            grantTransmitState();
        }
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

            emergencyPttBtn.classList.remove('transmitting');
            pttMainLabel.textContent = 'PRESIONA PARA HABLAR';
            intercomStatusBox.className = 'tx-rx-status';
            intercomStatusLabel.textContent = 'LISTO - CANAL DESPEJADO';
            statusPulseIcon.className = 'fa-solid fa-wave-square';

            stopVisualizer();

            if (socket && socket.connected) {
                socket.emit('STOP_TRANSMIT');
            }

            broadcastMeshPacket({
                type: 'TRANSMIT_END',
                msgId: `TXE-${myNodeId}-${Date.now()}`,
                originId: myNodeId,
                callsign: myProfile.callsign,
                channel: myProfile.channel
            });

            if ('vibrate' in navigator) navigator.vibrate(40);
        }
    }

    emergencyPttBtn.addEventListener('mousedown', startTransmitting);
    emergencyPttBtn.addEventListener('mouseup', stopTransmitting);
    emergencyPttBtn.addEventListener('mouseleave', stopTransmitting);
    emergencyPttBtn.addEventListener('touchstart', (e) => {
        if (e.cancelable) e.preventDefault();
        startTransmitting();
    }, { passive: false });
    emergencyPttBtn.addEventListener('touchend', (e) => {
        if (e.cancelable) e.preventDefault();
        stopTransmitting();
    }, { passive: false });
    emergencyPttBtn.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            startTransmitting();
        }
        if (oledBlackoutOverlay && !oledBlackoutOverlay.classList.contains('hidden')) {
            oledBlackoutOverlay.classList.add('hidden');
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            stopTransmitting();
        }
    });

    voxHandsFreeToggle.addEventListener('change', async () => {
        unlockAudioAndWake();
        isVoxActive = voxHandsFreeToggle.checked;
        if (isVoxActive) {
            await initMicPipeline();
            startVisualizer();
            speakEmergencyMessage('Manos libres activado. Habla cuando desees transmitir.');
        } else {
            stopTransmitting();
            stopVisualizer();
            speakEmergencyMessage('Manos libres desactivado.');
        }
    });

    voxSensitivity.addEventListener('input', () => {
        const val = parseInt(voxSensitivity.value, 10);
        voxThreshold = 0.050 - (val * 0.0045);
        let tag = 'Normal';
        if (val <= 3) tag = 'Baja (Ambiente Ruidoso)';
        else if (val >= 8) tag = 'Alta (Susurros)';
        voxSensLabel.textContent = `${val} (${tag})`;
    });

    emergencyChannelSelect.addEventListener('change', () => {
        const chanId = parseInt(emergencyChannelSelect.value, 10);
        myProfile.channel = chanId;
        if (socket && socket.connected) socket.emit('CHANGE_CHANNEL', chanId);
        sendPresenceHeartbeat();
        speakEmergencyMessage(`Canal ${chanId} sintonizado`);
    });

    function emitUniversalSos(messageText) {
        const sosId = `SOS-${myNodeId}-${Date.now()}`;
        registerMeshMsg(sosId);

        const sosPacket = {
            type: 'SOS_ALERT',
            msgId: sosId,
            id: sosId,
            originId: myNodeId,
            callsign: myProfile.callsign,
            channel: myProfile.channel,
            message: messageText,
            location: myProfile.location
        };

        if (socket && socket.connected) {
            socket.emit('SEND_SOS', sosPacket);
        }
        broadcastMeshPacket(sosPacket);
        logBlackboxEvent('SOS', 'ALERTA SOS EMITIDA', messageText, myProfile.location);
    }

    triggerEmergencySosBtn.addEventListener('click', () => {
        const ok = confirm('¿Confirmas la transmisión de una ALERTA SOS a toda la red?');
        if (ok) {
            emitUniversalSos('¡SOLICITUD DE AUXILIO Y RESCATE INMEDIATO!');
            startAudioBeacon();
        }
    });

    silenceSosAlarmBtn.addEventListener('click', () => {
        criticalSosBanner.classList.add('hidden');
        stopAudioBeacon();
        if (socket && socket.connected) socket.emit('CANCEL_SOS');
        broadcastMeshPacket({
            type: 'SOS_CANCELLED',
            msgId: `SOSC-${myNodeId}-${Date.now()}`,
            originId: myNodeId,
            callsign: myProfile.callsign
        });
    });

    // --- BALIZA SONORA DE LOCALIZACIÓN ---
    function startAudioBeacon() {
        if (activeBeaconOsc) return;
        try {
            unlockAudioAndWake();
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, ctx.currentTime);

            let high = false;
            const beaconInterval = setInterval(() => {
                if (!activeBeaconOsc) {
                    clearInterval(beaconInterval);
                    return;
                }
                high = !high;
                osc.frequency.setValueAtTime(high ? 1750 : 850, ctx.currentTime);
            }, 350);

            gain.gain.setValueAtTime(0.7, ctx.currentTime);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();

            activeBeaconOsc = { osc, gain, interval: beaconInterval };
            audioBeaconBtn.classList.add('active');
            audioBeaconLabel.textContent = 'DETENER BALIZA SONORA';
        } catch (e) {}
    }

    function stopAudioBeacon() {
        if (activeBeaconOsc) {
            try {
                clearInterval(activeBeaconOsc.interval);
                activeBeaconOsc.osc.stop();
                activeBeaconOsc.osc.disconnect();
            } catch (e) {}
            activeBeaconOsc = null;
        }
        audioBeaconBtn.classList.remove('active');
        audioBeaconLabel.textContent = 'ACTIVAR BALIZA SONORA';
    }

    audioBeaconBtn.addEventListener('click', () => {
        if (activeBeaconOsc) stopAudioBeacon();
        else startAudioBeacon();
    });

    // --- BALIZA ESTROBOSCÓPICA (FLASH Y PANTALLA SOS) ---
    async function startFlashStrobe() {
        isStrobeActive = true;
        flashStrobeBtn.classList.add('active');
        flashStrobeLabel.textContent = 'DETENER FLASH SOS';
        requestScreenWakeLock();

        try {
            if (!torchTrack) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                torchTrack = stream.getVideoTracks()[0];
            }
        } catch (e) {}

        let step = 0;
        strobeInterval = setInterval(() => {
            if (!isStrobeActive) {
                clearInterval(strobeInterval);
                return;
            }
            step = (step + 1) % 10;
            const isOn = (step % 2 === 0);

            if (torchTrack) {
                try {
                    torchTrack.applyConstraints({ advanced: [{ torch: isOn }] }).catch(() => {});
                } catch (e) {}
            }

            document.body.style.backgroundColor = isOn ? '#ffffff' : '#000000';
        }, 180);
    }

    function stopFlashStrobe() {
        isStrobeActive = false;
        if (strobeInterval) clearInterval(strobeInterval);
        document.body.style.backgroundColor = '#000000';
        if (torchTrack) {
            try {
                torchTrack.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
                torchTrack.stop();
            } catch (e) {}
            torchTrack = null;
        }
        flashStrobeBtn.classList.remove('active');
        flashStrobeLabel.textContent = 'FLASH SOS ESTROBOSCÓPICO';
    }

    flashStrobeBtn.addEventListener('click', () => {
        if (isStrobeActive) stopFlashStrobe();
        else startFlashStrobe();
    });

    // --- GESTIÓN DE TRIAGE PERSONAL Y CENSO ---
    triageButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const triageVal = btn.dataset.triage;
            triageButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            myProfile.triage = triageVal;
            if (socket && socket.connected) {
                socket.emit('UPDATE_TRIAGE', triageVal);
                socket.emit('UPDATE_PROFILE', { triage: triageVal });
            }

            sendPresenceHeartbeat();
            broadcastMeshPacket({
                type: 'TRIAGE_ANNOUNCED',
                msgId: `TRI-${myNodeId}-${Date.now()}`,
                originId: myNodeId,
                callsign: myProfile.callsign,
                triage: triageVal,
                location: myProfile.location
            });

            const labels = {
                'OK': 'A salvo y sin lesiones',
                'SEARCHING': 'Asistiendo en búsqueda y rescate',
                'INJURED': 'Herido, requiere atención médica',
                'TRAPPED': 'Atrapado con riesgo vital'
            };

            logBlackboxEvent('TRIAGE', `TRIAGE ACTUALIZADO: ${triageVal}`, labels[triageVal] || triageVal);
            speakEmergencyMessage(`Triage actualizado a: ${labels[triageVal] || triageVal}`);
            rebuildPeerListUI();
        });
    });

    function rebuildPeerListUI() {
        const now = Date.now();
        // Limpiar nodos inactivos de más de 18 segundos
        discoveredPeers.forEach((val, key) => {
            if (now - (val.lastSeen || 0) > 18000 && !webrtcPeers.has(key)) {
                discoveredPeers.delete(key);
            }
        });

        const allPeers = [myProfile, ...Array.from(discoveredPeers.values())];
        renderCensusList(allPeers);
    }

    function renderCensusList(peers) {
        latestPeers = peers;
        meshPeersCount.textContent = `${peers.length} ${peers.length === 1 ? 'Nodo' : 'Nodos'}`;
        censusList.innerHTML = '';

        peers.forEach(peer => {
            const card = document.createElement('div');
            const triageKey = (peer.triage || 'OK').toLowerCase();
            card.className = `census-card status-${triageKey}`;

            const isMe = (peer.id === myNodeId || peer.id === socket.id) ? ' (ESTE TELÉFONO)' : '';
            const triageTitles = {
                'ok': 'A SALVO',
                'searching': 'ASISTIENDO',
                'injured': 'HERIDO',
                'trapped': 'ATRAPADO'
            };

            let locText = 'GPS: No reportado';
            if (peer.location) {
                locText = `GPS: Lat ${peer.location.lat.toFixed(4)}, Lng ${peer.location.lng.toFixed(4)}`;
            }

            card.innerHTML = `
                <div class="card-main">
                    <strong>${peer.callsign}${isMe}</strong>
                    <small>CH ${peer.channel} | Batería: ${peer.battery}% | ${locText}</small>
                </div>
                <div class="card-badge">
                    ${triageTitles[triageKey] || 'ACTIVO'}
                </div>
            `;

            card.addEventListener('click', () => {
                if (peer.location && peer.id !== myNodeId) {
                    navButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === 'tabRadar'));
                    opPanels.forEach(p => p.classList.toggle('hidden', p.id !== 'tabRadar'));
                    radarTargetSelect.value = peer.id;
                    updateRadarDisplay();
                }
            });

            censusList.appendChild(card);
        });

        updateRadarTargetsDropdown(peers);
        checkAndInitP2PMeshPeers(peers);
    }

    // --- MENSAJERÍA TÁCTICA Y CHAT RÁPIDO ---
    quickSosMessages.forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.dataset.msg;
            sendTacticalText(msg);
        });
    });

    emergencySendChatBtn.addEventListener('click', () => {
        const text = emergencyChatInput.value.trim();
        if (text) {
            sendTacticalText(text);
            emergencyChatInput.value = '';
        }
    });

    emergencyChatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const text = emergencyChatInput.value.trim();
            if (text) {
                sendTacticalText(text);
                emergencyChatInput.value = '';
            }
        }
    });

    function sendTacticalText(text) {
        const msgId = `MSG-${myNodeId}-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        registerMeshMsg(msgId);

        const chatPacket = {
            type: 'TACTICAL_TEXT',
            msgId,
            id: msgId,
            originId: myNodeId,
            callsign: myProfile.callsign,
            channel: myProfile.channel,
            text,
            location: myProfile.location,
            timestamp: new Date().toLocaleTimeString()
        };

        addChatMessage(chatPacket);
        broadcastMeshPacket(chatPacket);

        if (socket && socket.connected) {
            socket.emit('SEND_TACTICAL_TEXT', {
                text,
                location: myProfile.location
            });
        }

        logBlackboxEvent('TEXT', `MENSAJE DE ${myProfile.callsign}`, text, myProfile.location);
    }

    function addChatMessage(data) {
        const bubble = document.createElement('div');
        const isMe = (data.callsign === myProfile.callsign || data.originId === myNodeId);
        bubble.className = `chat-bubble ${isMe ? 'me' : ''}`;

        bubble.innerHTML = `
            <div class="msg-head">
                <strong>${data.callsign} [CH ${data.channel}]</strong>
                <span>${data.timestamp}</span>
            </div>
            <p>${data.text}</p>
        `;
        emergencyChatHistory.appendChild(bubble);
        emergencyChatHistory.scrollTop = emergencyChatHistory.scrollHeight;

        if (!isMe) {
            speakEmergencyMessage(`${data.callsign} dice: ${data.text}`);
        }
    }

    // --- NAVEGACIÓN POR PESTAÑAS TÁCTICAS ---
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.dataset.tab;
            opPanels.forEach(panel => {
                if (panel.id === targetId) panel.classList.remove('hidden');
                else panel.classList.add('hidden');
            });

            if (targetId === 'tabRadar') {
                updateRadarDisplay();
            } else if (targetId === 'tabBlackbox') {
                renderBlackboxTimeline();
            }
        });
    });

    blackoutToggleBtn.addEventListener('click', () => {
        oledBlackoutOverlay.classList.remove('hidden');
        speakEmergencyMessage('Modo apagón de batería activado. La radio sigue operando.');
    });

    ['click', 'touchstart'].forEach(evt => {
        oledBlackoutOverlay.addEventListener(evt, (e) => {
            if (e.cancelable) e.preventDefault();
            oledBlackoutOverlay.classList.add('hidden');
        }, { passive: false });
    });

    // ==========================================================================
    // MOTOR SERVERLESS P2P DESCENTRALIZADO (AUTO-MESH + WEBRTC DIRECTO + OFFLINE QR)
    // ==========================================================================
    const webrtcPeers = new Map(); // targetId -> { pc, dc, callsign }
    let mqttClient = null;
    const MESH_TOPIC_ROOT = 'sos-rescate-mesh-v36-global/room';
    const localTabChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('sos_rescate_mesh_v36') : null;

    if (localTabChannel) {
        localTabChannel.onmessage = (ev) => {
            if (ev.data) handleIncomingMeshPacket(ev.data);
        };
    }

    function initServerlessAutoMesh() {
        if (typeof window.mqtt === 'undefined') {
            console.warn('[Auto-Mesh] Librería MQTT no disponible (modo 100% offline local activo).');
            return;
        }

        const brokers = [
            'wss://broker.emqx.io:8084/mqtt',
            'wss://broker.hivemq.com:8884/mqtt'
        ];

        try {
            mqttClient = window.mqtt.connect(brokers[0], {
                clientId: 'sos_' + myNodeId + '_' + Math.floor(Math.random() * 9999),
                clean: true,
                connectTimeout: 6000,
                reconnectPeriod: 3000
            });

            mqttClient.on('connect', () => {
                meshStatusBadge.querySelector('.mesh-dot').className = 'mesh-dot online';
                meshStatusText.textContent = 'MALLA P2P ACTIVA';
                mqttClient.subscribe(MESH_TOPIC_ROOT, { qos: 0 });
                sendPresenceHeartbeat();
            });

            mqttClient.on('message', (topic, payloadBuf) => {
                try {
                    const packet = JSON.parse(payloadBuf.toString());
                    handleIncomingMeshPacket(packet);
                } catch (e) {}
            });

            mqttClient.on('offline', () => {
                if (webrtcPeers.size === 0) {
                    meshStatusText.textContent = 'MODO OFFLINE P2P';
                }
            });
        } catch (err) {
            console.warn('[Auto-Mesh] Operando en modo directo offline:', err);
        }
    }

    function sendPresenceHeartbeat() {
        const hbPacket = {
            type: 'PEER_HEARTBEAT',
            msgId: `HB-${myNodeId}-${Date.now()}`,
            originId: myNodeId,
            profile: {
                id: myNodeId,
                callsign: myProfile.callsign,
                channel: myProfile.channel,
                triage: myProfile.triage,
                battery: myProfile.battery,
                location: myProfile.location,
                lastSeen: Date.now()
            }
        };
        broadcastMeshPacket(hbPacket);
    }

    // Enviar latido de presencia cada 4 segundos para auto-descubrimiento celular a celular
    setInterval(() => {
        sendPresenceHeartbeat();
        rebuildPeerListUI();
    }, 4000);

    function broadcastMeshPacket(packet) {
        const jsonStr = JSON.stringify(packet);

        // 1. Enviar por todos los enlaces directos WebRTC Celular-a-Celular abiertos
        webrtcPeers.forEach(peer => {
            if (peer.dc && peer.dc.readyState === 'open') {
                try { peer.dc.send(jsonStr); } catch (e) {}
            }
        });

        // 2. Enviar por pestaña local BroadcastChannel
        if (localTabChannel) {
            try { localTabChannel.postMessage(packet); } catch (e) {}
        }

        // 3. Enviar por Broker Descentralizado WSS (si hay conexión)
        if (mqttClient && mqttClient.connected) {
            try { mqttClient.publish(MESH_TOPIC_ROOT, jsonStr, { qos: 0 }); } catch (e) {}
        }
    }

    function handleIncomingMeshPacket(packet) {
        if (!packet || !packet.type) return;
        if (packet.originId === myNodeId) return; // Ignorar mis propios paquetes

        if (packet.type === 'PEER_HEARTBEAT' && packet.profile) {
            const p = packet.profile;
            p.lastSeen = Date.now();
            const isNew = !discoveredPeers.has(p.id);
            discoveredPeers.set(p.id, p);
            if (isNew) {
                rebuildPeerListUI();
                // Responder inmediatamente con mi presencia para que me vea al instante
                setTimeout(sendPresenceHeartbeat, 200);
            }
            return;
        }

        if (packet.type === 'WEBRTC_SIGNAL') {
            if (packet.targetId === myNodeId) {
                handleIncomingWebRtcSignal(packet.originId, packet.senderCallsign, packet.signal);
            }
            return;
        }

        const msgId = packet.msgId || packet.id;
        if (registerMeshMsg(msgId)) return; // Desduplicar paquete

        if (packet.type === 'AUDIO_CHUNK') {
            if (packet.channel === myProfile.channel && !isTransmitting) {
                playAudioChunk(packet.data, packet.callsign);
            }
        } else if (packet.type === 'TRANSMIT_START') {
            if (packet.channel === myProfile.channel && !isTransmitting) {
                isReceiving = true;
                nextPlayTime = 0;
                intercomStatusBox.className = 'tx-rx-status receiving';
                intercomStatusLabel.textContent = `RECIBIENDO: ${packet.callsign}`;
                statusPulseIcon.className = 'fa-solid fa-volume-high';
                startVisualizer();
            }
        } else if (packet.type === 'TRANSMIT_END') {
            if (packet.channel === myProfile.channel) {
                isReceiving = false;
                nextPlayTime = 0;
                intercomStatusBox.className = 'tx-rx-status';
                intercomStatusLabel.textContent = 'LISTO - CANAL DESPEJADO';
                statusPulseIcon.className = 'fa-solid fa-wave-square';
                stopVisualizer();
            }
        } else if (packet.type === 'SOS_ALERT') {
            showCriticalSosBanner(packet);
            if ('vibrate' in navigator) navigator.vibrate([400, 150, 400, 150, 400]);
            speakEmergencyMessage(`¡Atención! Alerta de auxilio emitida por ${packet.callsign}. ${packet.message}`, true);
            logBlackboxEvent('SOS', `ALERTA SOS P2P: ${packet.callsign}`, packet.message, packet.location);
            startAudioBeacon();
        } else if (packet.type === 'SOS_CANCELLED') {
            criticalSosBanner.classList.add('hidden');
            stopAudioBeacon();
        } else if (packet.type === 'TACTICAL_TEXT') {
            addChatMessage(packet);
            logBlackboxEvent('TEXT', `TEXTO DE ${packet.callsign}`, packet.text, packet.location);
        } else if (packet.type === 'TRIAGE_ANNOUNCED') {
            speakEmergencyMessage(`Actualización: ${packet.callsign} cambió su estado a ${packet.triage}`);
            logBlackboxEvent('TRIAGE', `TRIAGE: ${packet.callsign}`, `Estado: ${packet.triage}`, packet.location);
        }
    }

    // --- NEGOCIACIÓN AUTOMÁTICA WEBRTC CELULAR A CELULAR ---
    function updateP2PStatusUI() {
        let activeCount = 0;
        webrtcPeers.forEach(peer => {
            if (peer.dc && peer.dc.readyState === 'open') activeCount++;
        });

        p2pMeshText.textContent = activeCount > 0 ? `${activeCount} P2P DIRECTO` : 'ENLAZAR P2P';
        if (activeCount > 0) {
            p2pMeshChip.classList.add('active');
            meshStatusBadge.querySelector('.mesh-dot').className = 'mesh-dot online';
            meshStatusText.textContent = 'P2P CELULAR A CELULAR';
        } else {
            p2pMeshChip.classList.remove('active');
        }
    }

    function sendWebRtcSignal(targetId, signalData) {
        broadcastMeshPacket({
            type: 'WEBRTC_SIGNAL',
            originId: myNodeId,
            senderCallsign: myProfile.callsign,
            targetId,
            signal: signalData
        });
        if (socket && socket.connected) {
            socket.emit('WEBRTC_SIGNAL', { targetId, signal: signalData });
        }
    }

    function checkAndInitP2PMeshPeers(peers) {
        if (!window.RTCPeerConnection) return;

        peers.forEach(peer => {
            if (peer.id && peer.id !== myNodeId && !webrtcPeers.has(peer.id)) {
                if (myNodeId < peer.id) {
                    initiatePeerConnection(peer.id, peer.callsign);
                }
            }
        });
    }

    function createBasePeerConnection(targetId, targetCallsign) {
        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendWebRtcSignal(targetId, { candidate: event.candidate });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                webrtcPeers.delete(targetId);
                updateP2PStatusUI();
            }
        };

        return pc;
    }

    function setupDataChannel(dc, targetId, targetCallsign) {
        dc.onopen = () => {
            updateP2PStatusUI();
            sendPresenceHeartbeat();
            logBlackboxEvent('P2P', 'ENLACE P2P CELULAR A CELULAR ACTIVO', `Conectado directamente con ${targetCallsign}`);
        };

        dc.onclose = () => {
            updateP2PStatusUI();
        };

        dc.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data);
                handleIncomingMeshPacket(packet);
            } catch (e) {}
        };
    }

    function initiatePeerConnection(targetId, targetCallsign) {
        try {
            const pc = createBasePeerConnection(targetId, targetCallsign);
            const dc = pc.createDataChannel('sos_rescue_mesh', { ordered: false, maxRetransmits: 0 });
            setupDataChannel(dc, targetId, targetCallsign);

            webrtcPeers.set(targetId, { pc, dc, callsign: targetCallsign });

            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => {
                    sendWebRtcSignal(targetId, { sdp: pc.localDescription });
                })
                .catch(() => {});
        } catch (e) {}
    }

    async function handleIncomingWebRtcSignal(senderId, senderCallsign, signal) {
        if (!senderId || !signal) return;
        let peerObj = webrtcPeers.get(senderId);

        if (signal.sdp) {
            if (signal.sdp.type === 'offer') {
                const pc = createBasePeerConnection(senderId, senderCallsign);
                pc.ondatachannel = (event) => {
                    const dc = event.channel;
                    setupDataChannel(dc, senderId, senderCallsign);
                    webrtcPeers.set(senderId, { pc, dc, callsign: senderCallsign });
                };

                webrtcPeers.set(senderId, { pc, dc: null, callsign: senderCallsign });

                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendWebRtcSignal(senderId, { sdp: pc.localDescription });
                } catch (e) {}
            } else if (signal.sdp.type === 'answer' && peerObj) {
                try {
                    await peerObj.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                } catch (e) {}
            }
        } else if (signal.candidate && peerObj) {
            try {
                await peerObj.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {}
        }
    }

    // --- EMPAREJAMIENTO MANUAL / QR 100% OFFLINE (HOTSPOT SIN INTERNET) ---
    let manualOfflinePc = null;

    if (p2pMeshChip) {
        p2pMeshChip.addEventListener('click', () => {
            p2pOfflineModal.classList.remove('hidden');
        });
    }
    if (closeP2pModalBtn) {
        closeP2pModalBtn.addEventListener('click', () => {
            p2pOfflineModal.classList.add('hidden');
        });
    }

    function renderQrToken(tokenStr) {
        if (!p2pQrContainer || typeof window.QRCode === 'undefined') return;
        p2pQrContainer.innerHTML = '';
        p2pQrContainer.classList.remove('hidden');
        try {
            new window.QRCode(p2pQrContainer, {
                text: tokenStr,
                width: 170,
                height: 170,
                correctLevel: window.QRCode.CorrectLevel.L
            });
        } catch (e) {
            p2pQrContainer.classList.add('hidden');
        }
    }

    if (btnCreateP2pOffer) {
        btnCreateP2pOffer.addEventListener('click', async () => {
            p2pTokenBox.value = 'Generando llave P2P local (espera 1 segundo)...';
            manualOfflinePc = new RTCPeerConnection({ iceServers: [] });
            const dc = manualOfflinePc.createDataChannel('sos_offline_p2p', { ordered: false, maxRetransmits: 0 });
            const peerTempId = 'OFFLINE-' + Date.now();
            setupDataChannel(dc, peerTempId, 'PAR-OFFLINE');
            webrtcPeers.set(peerTempId, { pc: manualOfflinePc, dc, callsign: 'PAR-OFFLINE' });

            manualOfflinePc.onicecandidate = (e) => {
                if (!e.candidate && manualOfflinePc.localDescription) {
                    const token = btoa(JSON.stringify({
                        t: 'O',
                        id: myNodeId,
                        cs: myProfile.callsign,
                        sdp: manualOfflinePc.localDescription
                    }));
                    p2pTokenBox.value = token;
                    renderQrToken(token);
                }
            };

            const offer = await manualOfflinePc.createOffer();
            await manualOfflinePc.setLocalDescription(offer);
        });
    }

    if (btnAcceptP2pStep) {
        btnAcceptP2pStep.addEventListener('click', () => {
            p2pTokenBox.value = '';
            p2pTokenBox.placeholder = 'Pega aquí el código del otro celular y pulsa PROCESAR Y CONECTAR...';
            p2pQrContainer.classList.add('hidden');
            p2pTokenBox.focus();
        });
    }

    if (btnCopyP2pToken) {
        btnCopyP2pToken.addEventListener('click', () => {
            if (p2pTokenBox.value) {
                navigator.clipboard.writeText(p2pTokenBox.value).then(() => {
                    alert('Código copiado. Envíalo o pégalo en el otro celular.');
                }).catch(() => {
                    p2pTokenBox.select();
                    document.execCommand('copy');
                    alert('Código copiado.');
                });
            }
        });
    }

    if (btnConnectP2pToken) {
        btnConnectP2pToken.addEventListener('click', async () => {
            const raw = p2pTokenBox.value.trim();
            if (!raw) return;
            try {
                const decoded = JSON.parse(atob(raw));
                if (decoded.t === 'O') {
                    // Recibimos una Oferta -> creamos Respuesta
                    const pc = new RTCPeerConnection({ iceServers: [] });
                    pc.ondatachannel = (ev) => {
                        setupDataChannel(ev.channel, decoded.id || 'PAR', decoded.cs || 'PAR');
                        webrtcPeers.set(decoded.id || 'PAR', { pc, dc: ev.channel, callsign: decoded.cs || 'PAR' });
                        p2pOfflineModal.classList.add('hidden');
                        speakEmergencyMessage('Enlace directo celular a celular completado.', true);
                    };

                    pc.onicecandidate = (e) => {
                        if (!e.candidate && pc.localDescription) {
                            const ansToken = btoa(JSON.stringify({
                                t: 'A',
                                id: myNodeId,
                                cs: myProfile.callsign,
                                sdp: pc.localDescription
                            }));
                            p2pTokenBox.value = ansToken;
                            renderQrToken(ansToken);
                            alert('Respuesta generada. Copia este código de vuelta al Celular 1 para finalizar.');
                        }
                    };

                    await pc.setRemoteDescription(new RTCSessionDescription(decoded.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                } else if (decoded.t === 'A' && manualOfflinePc) {
                    await manualOfflinePc.setRemoteDescription(new RTCSessionDescription(decoded.sdp));
                    p2pOfflineModal.classList.add('hidden');
                    speakEmergencyMessage('Enlace directo celular a celular completado.', true);
                }
            } catch (e) {
                alert('Código P2P inválido o incompleto.');
            }
        });
    }

    // ==========================================================================
    // CAPACIDAD 2: BRÚJULA TÁCTICA & RADAR DE PROXIMIDAD GPS HACIA VÍCTIMAS
    // ==========================================================================
    let deviceCompassHeading = 0;

    function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                  Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
        return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
    }

    function bearingToCardinal(deg) {
        const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        const index = Math.round(deg / 45) % 8;
        return cardinals[index];
    }

    function updateRadarTargetsDropdown(peers) {
        const previousVal = radarTargetSelect.value;
        radarTargetSelect.innerHTML = '';

        const peersWithGps = peers.filter(p => p.id !== myNodeId && p.id !== socket.id && p.location);

        if (peersWithGps.length === 0) {
            radarTargetSelect.innerHTML = '<option value="">-- Sin víctimas detectadas con GPS --</option>';
            return;
        }

        peersWithGps.sort((a, b) => {
            const prio = { 'TRAPPED': 1, 'INJURED': 2, 'SEARCHING': 3, 'OK': 4 };
            return (prio[a.triage] || 5) - (prio[b.triage] || 5);
        });

        peersWithGps.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            const statusTag = p.triage === 'TRAPPED' ? '⚠️ ATRAPADO' : (p.triage === 'INJURED' ? '🩹 HERIDO' : p.triage);
            opt.textContent = `${p.callsign} [${statusTag}]`;
            radarTargetSelect.appendChild(opt);
        });

        if (previousVal && peersWithGps.some(p => p.id === previousVal)) {
            radarTargetSelect.value = previousVal;
        } else {
            radarTargetSelect.selectedIndex = 0;
        }

        updateRadarDisplay();
    }

    function updateRadarDisplay() {
        if (!myProfile.location) {
            radarMyCoords.textContent = 'GPS obteniendo señal de satélite...';
            radarDistanceValue.textContent = '-- m';
            radarBearingValue.textContent = '--° (--)';
            return;
        }

        radarMyCoords.textContent = `Lat: ${myProfile.location.lat.toFixed(5)}, Lng: ${myProfile.location.lng.toFixed(5)}`;

        const targetId = radarTargetSelect.value;
        const targetPeer = latestPeers.find(p => p.id === targetId);

        if (!targetPeer || !targetPeer.location) {
            radarTargetCoords.textContent = 'Selecciona una víctima con GPS activo';
            radarDistanceValue.textContent = '-- m';
            radarBearingValue.textContent = '--° (--)';
            radarArrowWrapper.style.transform = 'rotate(0deg)';
            return;
        }

        const tLoc = targetPeer.location;
        radarTargetCoords.textContent = `Lat: ${tLoc.lat.toFixed(5)}, Lng: ${tLoc.lng.toFixed(5)}`;

        const dist = calculateDistanceMeters(myProfile.location.lat, myProfile.location.lng, tLoc.lat, tLoc.lng);
        const bearing = calculateBearing(myProfile.location.lat, myProfile.location.lng, tLoc.lat, tLoc.lng);
        const card = bearingToCardinal(bearing);

        radarDistanceValue.textContent = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`;
        radarBearingValue.textContent = `${bearing}° (${card})`;

        const relativeAngle = (bearing - deviceCompassHeading + 360) % 360;
        radarArrowWrapper.style.transform = `rotate(${relativeAngle}deg)`;
    }

    radarTargetSelect.addEventListener('change', updateRadarDisplay);

    radarSpeakHeadingBtn.addEventListener('click', () => {
        const targetId = radarTargetSelect.value;
        const targetPeer = latestPeers.find(p => p.id === targetId);
        if (!targetPeer || !targetPeer.location || !myProfile.location) {
            speakEmergencyMessage('No hay datos de localización GPS suficientes para calcular el rumbo.', true);
            return;
        }

        const dist = calculateDistanceMeters(myProfile.location.lat, myProfile.location.lng, targetPeer.location.lat, targetPeer.location.lng);
        const bearing = calculateBearing(myProfile.location.lat, myProfile.location.lng, targetPeer.location.lat, targetPeer.location.lng);
        const card = bearingToCardinal(bearing);

        const distText = dist >= 1000 ? `${(dist / 1000).toFixed(1)} kilómetros` : `${dist} metros`;
        speakEmergencyMessage(`Rumbo hacia ${targetPeer.callsign}: ${bearing} grados dirección ${card}, distancia ${distText}.`, true);
    });

    radarCalibrateBtn.addEventListener('click', async () => {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
                    alert('Sensor magnético calibrado y activo.');
                } else {
                    alert('Permiso de sensor denegado.');
                }
            } catch (err) {}
        } else {
            alert('Sensor de brújula magnética activo.');
        }
    });

    function handleDeviceOrientation(event) {
        let heading = null;
        if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading;
        } else if (event.alpha !== null) {
            heading = 360 - event.alpha;
        }

        if (heading !== null) {
            deviceCompassHeading = heading;
            updateRadarDisplay();
        }
    }

    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }

    // ==========================================================================
    // CAPACIDAD 3: CAJA NEGRA / BITÁCORA FORENSE OFFLINE (INDEXEDDB)
    // ==========================================================================
    let blackboxDb = null;
    let inMemoryLogs = [];

    function initIndexedDb() {
        const request = indexedDB.open('SosRescateBlackboxDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('incident_logs')) {
                const store = db.createObjectStore('incident_logs', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('type', 'type', { unique: false });
            }
        };
        request.onsuccess = (e) => {
            blackboxDb = e.target.result;
            loadBlackboxLogs();
        };
    }

    function logBlackboxEvent(type, title, details, coords = null) {
        const eventItem = {
            timestamp: new Date().toISOString(),
            timeString: new Date().toLocaleTimeString(),
            type,
            title,
            details,
            coords: coords || myProfile.location
        };

        inMemoryLogs.unshift(eventItem);
        if (inMemoryLogs.length > 500) inMemoryLogs.pop();

        if (blackboxDb) {
            try {
                const tx = blackboxDb.transaction('incident_logs', 'readwrite');
                tx.objectStore('incident_logs').add(eventItem);
            } catch (e) {}
        }

        updateBlackboxCounters();
        renderBlackboxTimeline();
    }

    function loadBlackboxLogs() {
        if (!blackboxDb) return;
        const tx = blackboxDb.transaction('incident_logs', 'readonly');
        const req = tx.objectStore('incident_logs').getAll();

        req.onsuccess = () => {
            const all = req.result || [];
            all.reverse();
            inMemoryLogs = all.slice(0, 500);
            updateBlackboxCounters();
            renderBlackboxTimeline();
        };
    }

    function updateBlackboxCounters() {
        const total = inMemoryLogs.length;
        const sosCount = inMemoryLogs.filter(e => e.type === 'SOS').length;
        const victimsCount = inMemoryLogs.filter(e => e.type === 'TRIAGE' && (e.details.includes('Herido') || e.details.includes('Atrapado') || e.details.includes('INJURED') || e.details.includes('TRAPPED'))).length;

        bbTotalCount.textContent = total;
        bbSosCount.textContent = sosCount;
        bbVictimsCount.textContent = victimsCount;
    }

    function renderBlackboxTimeline() {
        if (!blackboxTimeline) return;
        if (inMemoryLogs.length === 0) {
            blackboxTimeline.innerHTML = '<div class="bb-empty-notice">No hay eventos grabados en la caja negra aún.</div>';
            return;
        }

        blackboxTimeline.innerHTML = '';
        inMemoryLogs.forEach(entry => {
            const card = document.createElement('div');
            const typeClass = (entry.type || 'SYSTEM').toLowerCase();
            card.className = `bb-event-card ${typeClass}`;

            let coordsText = '';
            if (entry.coords) {
                coordsText = `<div class="bb-card-coords"><i class="fa-solid fa-location-dot"></i> GPS: Lat ${entry.coords.lat.toFixed(4)}, Lng ${entry.coords.lng.toFixed(4)}</div>`;
            }

            card.innerHTML = `
                <div class="bb-card-head">
                    <strong>${entry.title}</strong>
                    <span>${entry.timeString}</span>
                </div>
                <div class="bb-card-body">${entry.details}</div>
                ${coordsText}
            `;
            blackboxTimeline.appendChild(card);
        });
    }

    bbExportBtn.addEventListener('click', () => {
        if (inMemoryLogs.length === 0) {
            alert('No hay eventos registrados en la bitácora para exportar.');
            return;
        }

        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(inMemoryLogs, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute('href', dataStr);
        dlAnchor.setAttribute('download', `bitacora_rescate_${Date.now()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
    });

    bbSpeakLastBtn.addEventListener('click', () => {
        if (inMemoryLogs.length === 0) {
            speakEmergencyMessage('No hay eventos en la bitácora.', true);
            return;
        }
        const last = inMemoryLogs[0];
        speakEmergencyMessage(`Último evento a las ${last.timeString}: ${last.title}. ${last.details}`, true);
    });

    bbClearBtn.addEventListener('click', () => {
        if (confirm('¿Confirmas el borrado de todos los registros de la caja negra local?')) {
            inMemoryLogs = [];
            if (blackboxDb) {
                const tx = blackboxDb.transaction('incident_logs', 'readwrite');
                tx.objectStore('incident_logs').clear();
            }
            updateBlackboxCounters();
            renderBlackboxTimeline();
        }
    });

    initIndexedDb();

    // ==========================================================================
    // CAPACIDAD 4: INSTALADOR PWA STANDALONE A PANTALLA COMPLETA
    // ==========================================================================
    let deferredInstallPrompt = null;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isStandalone) {
        pwaInstallBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> STANDALONE';
        pwaInstallBtn.classList.remove('hidden');
        pwaInstallBtn.style.borderColor = '#00ff66';
        pwaInstallBtn.style.color = '#00ff66';
    } else {
        // Mostrar siempre el botón INSTALAR para acceso directo en Android/iOS
        pwaInstallBtn.classList.remove('hidden');
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            pwaInstallBtn.classList.remove('hidden');
        });
    }

    pwaInstallBtn.addEventListener('click', async () => {
        if (isStandalone) {
            alert('La app ya está instalada en tu teléfono para uso 100% sin internet.');
            return;
        }

        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                pwaInstallBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> INSTALADA';
            }
            deferredInstallPrompt = null;
        } else if (isIos) {
            iosInstallModal.classList.remove('hidden');
        } else {
            alert('Para instalar en tu pantalla de inicio: abre el menú del navegador (⋮) y toca "Instalar aplicación" o "Agregar a pantalla principal".');
        }
    });

    closeIosModalBtn.addEventListener('click', () => iosInstallModal.classList.add('hidden'));
    ackIosModalBtn.addEventListener('click', () => iosInstallModal.classList.add('hidden'));

    // --- RECUPERACIÓN TRAS SUSPENSIÓN / APAGADO DE PANTALLA ---
    function handleWakeupAndReconnect() {
        requestScreenWakeLock();
        unlockAudioAndWake();

        if (micStream) {
            const tracks = micStream.getAudioTracks();
            if (!micStream.active || tracks.length === 0 || tracks.some(t => t.readyState === 'ended' || !t.enabled)) {
                initMicPipeline();
            }
        }

        sendPresenceHeartbeat();
        nextPlayTime = 0;
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            handleWakeupAndReconnect();
        }
    });
    window.addEventListener('focus', handleWakeupAndReconnect);
    window.addEventListener('pageshow', handleWakeupAndReconnect);
    window.addEventListener('online', handleWakeupAndReconnect);

    // --- COMPATIBILIDAD OPCIONAL CON SOCKET.IO LOCAL ---
    socket.on('TRANSMIT_GRANTED', () => {
        grantTransmitState();
    });

    socket.on('AUDIO_CHUNK', (data) => {
        const msgId = data.msgId || data.packetId;
        if (registerMeshMsg(msgId)) return;
        if (!isTransmitting) {
            playAudioChunk(data.data || data, data.callsign);
        }
    });

    function showCriticalSosBanner(sos) {
        sosOriginCallsign.textContent = `${sos.callsign} (CH ${sos.channel || 1})`;
        sosDetails.textContent = sos.location ?
            `GPS: ${sos.location.lat.toFixed(4)}, ${sos.location.lng.toFixed(4)} | Mensaje: ${sos.message}` :
            `Mensaje: ${sos.message}`;
        criticalSosBanner.classList.remove('hidden');
    }

    emergencyCallsignInput.addEventListener('change', () => {
        const val = emergencyCallsignInput.value.trim().toUpperCase();
        if (val) {
            myProfile.callsign = val;
            localStorage.setItem('sos_callsign', val);
            sendPresenceHeartbeat();
            rebuildPeerListUI();
        }
    });

    // --- TELEMETRÍA DE BATERÍA Y GPS ---
    if ('getBattery' in navigator) {
        navigator.getBattery().then(bat => {
            function updateBat() {
                const pct = Math.round(bat.level * 100);
                myProfile.battery = pct;
                batteryText.textContent = `${pct}%`;
                sendPresenceHeartbeat();
            }
            updateBat();
            bat.addEventListener('levelchange', updateBat);
        });
    }

    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (pos) => {
                myProfile.location = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    acc: pos.coords.accuracy
                };
                gpsText.textContent = 'GPS OK';
                gpsChip.style.color = '#00ff66';
                updateRadarDisplay();
            },
            () => {
                gpsText.textContent = 'SIN GPS';
                gpsChip.style.color = '#ff6a00';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    if (micPromptBanner) {
        ['click', 'touchstart'].forEach(ev => {
            micPromptBanner.addEventListener(ev, async (e) => {
                if (e.cancelable) e.preventDefault();
                unlockAudioAndWake();
                await initMicPipeline();
            }, { passive: false });
        });
    }

    if (acousticSensorToggle) {
        acousticSensorToggle.addEventListener('change', async () => {
            if (acousticSensorToggle.checked) {
                await initMicPipeline();
            }
        });
    }

    // Inicializar Censo, Wake Lock y Auto-Mesh Serverless
    rebuildPeerListUI();
    initServerlessAutoMesh();
    requestScreenWakeLock();
});
