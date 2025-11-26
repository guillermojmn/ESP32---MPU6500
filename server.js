// server.js
// npm i express ws
const express = require('express');
const { WebSocketServer } = require('ws');
const net = require('net');                 // <-- NUEVO
const path = require('path');

const HTTP_PORT = 8080;
const TCP_PORT  = 9000;                     // <-- mismo que SERVER_PORT del ESP32

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(HTTP_PORT, () =>
  console.log(`HTTP: http://localhost:${HTTP_PORT}`)
);

// WebSocket para el navegador
const wss = new WebSocketServer({ server, path: '/ws' });

const broadcast = (msg) => {
  // msg puede ser string (JSON crudo) u objeto
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(data);
  }
};

// ---- Servidor TCP para el ESP32 ----
const tcpServer = net.createServer((socket) => {
  console.log('ESP32 conectado desde', socket.remoteAddress, socket.remotePort);

  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // la última puede quedar incompleta

    for (const line of lines) {
      const s = line.trim();
      if (!s || s[0] !== '{') continue;        // ignora líneas vacías o comentarios
      //console.log('RX ESP32:', s);
      // reenviar tal cual al navegador
      broadcast(s);
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
