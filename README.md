# RadioRescate & S.O.S. Rescate - Sistema Táctico de Comunicación de Misión Crítica (Off-Grid)

**RadioRescate** es una plataforma integral de comunicaciones de emergencia fuera de red (*Off-Grid*), diseñada para operar **sin necesidad de acceso a Internet ni cobertura celular**. Convierte cualquier smartphone (Android, iOS) o computadora en una estación de radio táctica, centro de censo y triage de sobrevivientes, radar de localización y baliza de supervivencia.

El proyecto cuenta con **dos interfaces especializadas**:
1. **Radio Clásica Rugerizada (`/` -> `index.html`)**: Emulador de radio analógica walkie-talkie militar con dial LCD, efectos de audio analógico (mic-click, squelch burst, roger beep), medidor VU y perfiles DSP de ecualización táctica.
2. **S.O.S. Rescate de Misión Crítica (`/emergency` -> `emergency.html`)**: Suite brutalista OLED puro (`#000000`) de máxima usabilidad en catástrofes, con voz HD calidad telefónica, manos libres VOX, detector acústico de escombros, radar brújula GPS, caja negra offline e interconexión celular-a-celular directa vía WebRTC DataChannel.

---

## 🚀 Capacidades y Módulos del Sistema

### 1. Intercomunicador de Voz HD & Manos Libres VOX
* **Audio Fullband HD**: Sonido cristalino con ecualización de presencia en 2.8 kHz, filtro pasa-altos de 140 Hz y compresión de dinámica para eliminar retumbes y garantizar máxima inteligibilidad en altavoces de celular.
* **Manos Libres VOX (Zero-Touch)**: Transmisión activada por detección de voz con sensibilidad configurable (de susurros a ambientes de alto ruido), permitiendo comunicarse con las manos atrapadas o heridas.
* **Pipeline de Audio Persistente**: Optimizado para Safari iOS y WebKit Android; no colapsa ni destruye nodos de CoreAudio entre pulsaciones.
* **Protección Screen Wake Lock**: Mantiene la pantalla encendida y activa de forma continua durante la operación de emergencia sin que el celular se suspenda a los 30 segundos.

### 2. Sensor Acústico de Escombros & Balizas de Localización
* **Detector Acústico de 3 Golpes**: Algoritmo de análisis de envolvente espectral que discrimina impactos percusivos rítmicos en tuberías o concreto. Al detectar 3 golpes consecutivos, dispara automáticamente una alerta SOS de auxilio a toda la red con coordenadas GPS.
* **Baliza Sonora de Penetración**: Generador de tono alternado de alta penetración acústica para guiar a perros de rescate y brigadistas.
* **Baliza Estroboscópica SOS**: Destellos en código Morse SOS (`... --- ...`) utilizando el flash LED de la cámara trasera y la pantalla.

### 3. Triage Rápido de Sobrevivientes & Censo en Red
* Selector de 4 niveles tácticos:
  * 🟢 **A SALVO / BIEN**: Sin lesiones de gravedad.
  * 🔵 **ASISTIENDO / RESCATE**: Rescatistas o voluntarios en búsqueda.
  * 🟡 **HERIDO**: Requiere primeros auxilios / atención médica.
  * 🔴 **ATRAPADO**: Riesgo vital bajo escombros o colapso inminente.
* **Censo en Vivo**: Monitoreo de indicativo, canal, nivel de batería de cada teléfono y coordenadas satelitales reportadas.

### 4. Radar Táctico Vectorial & Brújula GPS sin Internet
* Cálculo trigonométrico de distancia directa (Haversine) y azimut / rumbo hacia cualquier víctima o rescatista.
* Flecha vectorial neón sobre un disco de radar táctico acoplado a la brújula magnética del teléfono (`DeviceOrientationEvent`).
* **Dictado de Rumbo (TTS)**: Síntesis de voz offline para navegación con manos libres (*"Rumbo hacia RADIO-102: 45 grados Noreste, distancia 85 metros"*).

### 5. Caja Negra / Bitácora Forense Offline (IndexedDB)
* Registro inmutable en base de datos local del navegador (`SosRescateBlackboxDB`).
* Guarda automáticamente todas las alertas SOS, cambios de estado de triage, mensajes de texto y coordenadas satelitales.
* Permite exportar la bitácora completa en formato JSON o dictar por voz el último incidente.

### 6. Malla Descentralizada WebRTC P2P (Celular a Celular)
* Canales directos `RTCDataChannel` entre teléfonos conectados al mismo Hotspot o red local.
* **Tolerancia a fallos**: Si la computadora o servidor base se apaga en medio de la emergencia, los celulares continúan transmitiendo audio, alertas y texto directamente entre ellos.

### 7. PWA Standalone a Pantalla Completa
* Aplicación web progresiva instalable en Android e iOS sin barras de navegación del navegador, con arranque instantáneo y caché offline garantizada mediante Service Worker v35.

---

## 🛠️ Requisitos e Instalación

### Requisitos
* [Node.js](https://nodejs.org/) (versión 18 o superior recomendada).

### Puesta en Marcha Local
```bash
# Clonar el repositorio
git clone https://github.com/carmelo-sanjuanes/comunicaciones-de-emergencia.git
cd "comunicaciones de emergencia"

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

El servidor iniciará automáticamente en:
* **HTTPS Contexto Seguro**: `https://<TU-IP-LOCAL>/emergency` (y puerto fallback 8443)
* **HTTP Standalone**: `http://<TU-IP-LOCAL>:8081/emergency` (y puerto 80)

---

## 📲 Despliegue en Zona de Desastre (Sin Internet)

1. **Crear la Red Local de Rescate**:
   * Enciende la **Zona Wi-Fi portátil (Hotspot)** de un teléfono celular o un router portátil a batería.
   * Conecta los celulares de la brigada y los sobrevivientes a esa red Wi-Fi.
2. **Abrir la Aplicación**:
   * Escanea el código QR generado en la consola o en `public/qr_emergency.png`.
   * Abre `https://<IP>/emergency` en Safari o Chrome.
3. **Instalación y Permisos**:
   * Pulsa el banner superior verde para otorgar acceso al micrófono.
   * Presiona **INSTALAR** en la cabecera para agregar el icono directo a la pantalla de inicio del teléfono.

---

## 📁 Arquitectura del Código

```
comunicaciones de emergencia/
├── server.js                      # Servidor Express, Socket.IO, relay WebRTC y multi-puerto (80/443/8081/8443)
├── generate_qr_image.js           # Generador automático de códigos QR para la IP local
├── package.json                   # Manifiesto npm y dependencias
├── .gitignore                     # Filtro de archivos versionados
└── public/
    ├── emergency.html             # Suite táctica S.O.S. Rescate (OLED puro)
    ├── emergency-app.js           # Motor de audio HD, VOX, detector de impactos, radar GPS, WebRTC y Blackbox
    ├── emergency.css              # Hoja de estilos táctica militar de alta visibilidad
    ├── manifest-emergency.json    # Manifiesto PWA para S.O.S. Rescate
    ├── index.html                 # Interfaz de Radio Clásica Rugerizada analógica
    ├── app.js                     # Motor de la radio analógica clásico
    ├── styles.css                 # Estilos clásicos de radio analógica
    ├── manifest.json              # Manifiesto PWA para radio analógica
    ├── sw.js                      # Service Worker con caché offline v35
    └── qr_emergency.png           # Código QR de conexión rápida
```

---

## 📄 Licencia

Este proyecto es de código abierto bajo la licencia MIT. Diseñado para salvar vidas en situaciones de catástrofe y misiones de rescate.
