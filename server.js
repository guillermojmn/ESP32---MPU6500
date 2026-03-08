// server.js
// npm install express ws @influxdata/influxdb-client

const express = require('express');
const { WebSocketServer } = require('ws');
const net = require('net');
const path = require('path');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const TelegramBot = require('node-telegram-bot-api');

// ==================== CONFIG ====================
const HTTP_PORT = 8080;
const TCP_PORT  = 9000;

// InfluxDB
const INFLUX_URL    = 'http://localhost:8086';
const INFLUX_TOKEN  = 'F2skA2Rdrpps-V3tU2OsEIzQAt40b5AQ4wfG_0shnO7qyAl4fE4HCJJ4SoRT23cLLh9g9964OO2yZU8TRtCKxw==';
const INFLUX_ORG    = 'tfg';
const INFLUX_BUCKET = 'imu_data';

// Telegram Bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8169637278:AAHb7GfnhN_z1N1MEYPF1MuSDJCPOtADWB4';
let TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;

// Umbrales de alarma (en grados)
const ALARM_THRESHOLDS = {
  roll: 30,      // Alarma si |roll| > 30°
  pitch: 30,     // Alarma si |pitch| > 30°
  yaw: 360       // Alarma si |yaw| > 360° (prácticamente nunca)
};

// =================================================


// ==================== INFLUX ====================
const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ms');
writeApi.useDefaultTags({ device: 'esp32_imu' });
// =================================================


// ==================== TELEGRAM BOT ==============
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
let lastAlarmTime = 0;
const ALARM_COOLDOWN = 5000; // 5 segundos entre notificaciones

console.log('🤖 Bot de Telegram iniciado con polling...');

// Comando /start para obtener el ID del chat
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  TELEGRAM_CHAT_ID = chatId;
  
  const message = `✅ ¡Bot configurado correctamente!\n\n` +
    `Tu ID de chat: ${chatId}\n\n` +
    `🚨 Recibirás notificaciones cuando:\n` +
    `• Roll > ±${ALARM_THRESHOLDS.roll}°\n` +
    `• Pitch > ±${ALARM_THRESHOLDS.pitch}°\n\n` +
    `Comandos disponibles:\n` +
    `/status - Ver estado actual\n` +
    `/thresholds - Ver umbrales de alarma`;
  
  bot.sendMessage(chatId, message);
  console.log(`✅ Bot iniciado para chat ID: ${chatId}`);
});

// Comando /status
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;
  const status = TELEGRAM_CHAT_ID ? '✅ Activo' : '❌ No configurado';
  bot.sendMessage(chatId, `Estado: ${status}`);
});

// Comando /thresholds
bot.onText(/\/thresholds/, (msg) => {
  const chatId = msg.chat.id;
  const message = `📊 Umbrales de alarma actuales:\n\n` +
    `Roll: ±${ALARM_THRESHOLDS.roll}°\n` +
    `Pitch: ±${ALARM_THRESHOLDS.pitch}°\n` +
    `Yaw: ±${ALARM_THRESHOLDS.yaw}°`;
  bot.sendMessage(chatId, message);
});

function sendTelegramAlert(alarmType, data) {
  if (!TELEGRAM_CHAT_ID) {
    console.log('⚠️  Chat ID no configurado. Escribe /start en el bot primero.');
    return;
  }

  const now = Date.now();
  
  // Evitar spam de notificaciones
  if (now - lastAlarmTime < ALARM_COOLDOWN) return;
  lastAlarmTime = now;

  const message = `🚨 ¡ALARMA DETECTADA! 🚨\n\n` +
    `Tipo: ${alarmType}\n` +
    `Roll: ${data.roll.toFixed(2)}°\n` +
    `Pitch: ${data.pitch.toFixed(2)}°\n` +
    `Yaw: ${data.yaw.toFixed(2)}°\n` +
    `⏰ ${new Date().toLocaleTimeString()}`;

  bot.sendMessage(TELEGRAM_CHAT_ID, message)
    .then(() => console.log('📲 Notificación Telegram enviada'))
    .catch(err => console.error('❌ Error enviando Telegram:', err.message));
}

function checkAlarm(roll, pitch, yaw) {
  if (Math.abs(roll) > ALARM_THRESHOLDS.roll) {
    return { triggered: true, type: `Roll excesivo (${roll.toFixed(2)}°)`, data: { roll, pitch, yaw } };
  }
  if (Math.abs(pitch) > ALARM_THRESHOLDS.pitch) {
    return { triggered: true, type: `Pitch excesivo (${pitch.toFixed(2)}°)`, data: { roll, pitch, yaw } };
  }
  return { triggered: false };
}
// =================================================


// ==================== HTTP (WEB) =================
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(HTTP_PORT, () => {
  console.log(`🌐 Web en http://localhost:${HTTP_PORT}`);
});
// =================================================


// ==================== WEBSOCKET ==================
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastRaw(rawJsonString) {
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(rawJsonString);
  }
}
// =================================================


// ========== CUATERNION → EULER (GRADOS) ==========
function quatToEulerDeg(qx, qy, qz, qw) {
  const sinr = 2 * (qw * qx + qy * qz);
  const cosr = 1 - 2 * (qx * qx + qy * qy);
  const roll = Math.atan2(sinr, cosr);

  const sinp = 2 * (qw * qy - qz * qx);
  const pitch = Math.abs(sinp) >= 1
    ? Math.sign(sinp) * Math.PI / 2
    : Math.asin(sinp);

  const siny = 2 * (qw * qz + qx * qy);
  const cosy = 1 - 2 * (qy * qy + qz * qz);
  const yaw = Math.atan2(siny, cosy);

  return {
    roll:  roll  * 180 / Math.PI,
    pitch: pitch * 180 / Math.PI,
    yaw:   yaw   * 180 / Math.PI
  };
}
// =================================================


// ==================== TCP ESP32 ==================
const tcpServer = net.createServer((socket) => {
  console.log('📡 ESP32 conectado:', socket.remoteAddress);

  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith('{')) continue;

      try {
        const obj = JSON.parse(s);

        /*
          JSON esperado del ESP32:
          {
            "t": 123456,
            "quat": [qx, qy, qz, qw],
            "alarm": 0 | 1
          }
        */

        // ================== 1️⃣ WEB ==================
        // 👉 SE ENVÍA TAL CUAL, SIN TOCAR
        broadcastRaw(s);

        // ================== 2️⃣ GRAFANA ===============
        if (!obj.quat || obj.quat.length !== 4) return;

        const [qx, qy, qz, qw] = obj.quat;
        const { roll, pitch, yaw } = quatToEulerDeg(qx, qy, qz, qw);

        // ================== 3️⃣ CHECK ALARMA =========
        const alarmCheck = checkAlarm(roll, pitch, yaw);
        if (alarmCheck.triggered) {
          console.log(`⚠️  ${alarmCheck.type}`);
          sendTelegramAlert(alarmCheck.type, alarmCheck.data);
        }
        // ===============================================

        const point = new Point('imu')
          .floatField('roll_deg', roll)
          .floatField('pitch_deg', pitch)
          .floatField('yaw_deg', yaw)
          .intField('alarm', obj.alarm ? 1 : 0);

        writeApi.writePoint(point);

      } catch (err) {
        console.error('❌ Error procesando dato:', err.message);
      }
    }
  });

  socket.on('end', () => {
    console.log('🔌 ESP32 desconectado');
  });

  socket.on('error', (err) => {
    console.error('TCP error:', err.message);
  });
});

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
  console.log(`📥 TCP escuchando en puerto ${TCP_PORT}`);
});
// =================================================


// ==================== CIERRE LIMPIO ==============
process.on('SIGINT', async () => {
  console.log('\n⛔ Cerrando servidor...');
  await writeApi.close();
  process.exit(0);
});
// =================================================
