// server.js
// npm install express ws @influxdata/influxdb-client

const express = require('express');
const { WebSocketServer } = require('ws');
const net = require('net');
const path = require('path');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

// -------------------- CONFIG --------------------
const HTTP_PORT = 8080;
const TCP_PORT  = 9000;

// InfluxDB
const INFLUX_URL = 'http://localhost:8086';
const INFLUX_TOKEN = 'F2skA2Rdrpps-V3tU2OsEIzQAt40b5AQ4wfG_0shnO7qyAl4fE4HCJJ4SoRT23cLLh9g9964OO2yZU8TRtCKxw==';
const INFLUX_ORG = 'tfg';
const INFLUX_BUCKET = 'imu_data';

// ------------------------------------------------

// ---- InfluxDB init ----
const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ms');
writeApi.useDefaultTags({ device: 'esp32_imu' });

// ---- HTTP server (web) ----
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(HTTP_PORT, () => {
  console.log(`HTTP server en http://localhost:${HTTP_PORT}`);
});

// ---- WebSocket server (browser) ----
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg) {
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(data);
  }
}

// ---- TCP server (ESP32) ----
const tcpServer = net.createServer((socket) => {
  console.log('ESP32 conectado desde', socket.remoteAddress, socket.remotePort);

  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // última línea puede estar incompleta

    for (const line of lines) {
      const s = line.trim();
      if (!s || s[0] !== '{') continue;

      // 1️⃣ reenviar al navegador (tiempo real)
      broadcast(s);

      // 2️⃣ guardar en InfluxDB
      try {
        const obj = JSON.parse(s);

        /*
          JSON esperado desde el ESP32:
          {
            "t": 123456,
            "quat": [qx,qy,qz,qw],
            "alarm": 0 | 1
          }
        */

        if (!obj.quat || obj.quat.length !== 4) return;

        const point = new Point('imu')
          .floatField('qx', obj.quat[0])
          .floatField('qy', obj.quat[1])
          .floatField('qz', obj.quat[2])
          .floatField('qw', obj.quat[3])
          .intField('alarm', obj.alarm ? 1 : 0);

        writeApi.writePoint(point);

      } catch (err) {
        console.error('Error procesando dato:', err.message);
      }
    }
  });

  socket.on('end', () => {
    console.log('ESP32 desconectado');
  });

  socket.on('error', (err) => {
    console.error('Error TCP:', err.message);
  });
});

tcpServer.listen(TCP_PORT, '0.0.0.0', () => {
  console.log(`TCP ESP32 escuchando en puerto ${TCP_PORT}`);
});

// ---- cierre limpio ----
process.on('SIGINT', async () => {
  console.log('\nCerrando servidor e InfluxDB...');
  await writeApi.close();
  process.exit(0);
});
