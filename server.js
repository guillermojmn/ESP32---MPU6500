// server.js
// npm i express ws serialport
const express = require('express');
const { WebSocketServer } = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

const HTTP_PORT = 8080;
const SERIAL_BAUD = 115200;
// Define el puerto por variable de entorno o cambia aquí:
const SERIAL_PATH = process.env.SERIAL_PATH || 'COM3'; // '/dev/ttyUSB0', '/dev/ttyACM0', etc.

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = app.listen(HTTP_PORT, () =>
  console.log(`HTTP: http://localhost:${HTTP_PORT}`)
);

const wss = new WebSocketServer({ server, path: '/ws' });
const broadcast = (obj) => {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
};

function openSerial() {
  console.log(`Abriendo ${SERIAL_PATH} @ ${SERIAL_BAUD}`);
  const port = new SerialPort({ path: SERIAL_PATH, baudRate: SERIAL_BAUD });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  parser.on('data', (line) => {
    const s = line.trim();
    if (!s || s[0] !== '{') return; // ignora comentarios (# …)
    try { broadcast(JSON.parse(s)); } catch (e) { /* ignora líneas corruptas */ }
  });

  port.on('error', (e) => console.error('Serie error:', e.message));
  port.on('close', () => {
    console.warn('Serie cerrada. Reintentando en 2s…');
    setTimeout(openSerial, 2000);
  });
}
openSerial();
