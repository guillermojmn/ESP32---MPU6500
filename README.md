# Sistema de monitorización IMU en tiempo real – TFG

## 1. Descripción del proyecto

Este proyecto implementa un sistema de **monitorización en tiempo real de la orientación** de un vehículo mediante una **ESP32 con sensor IMU**, mostrando los datos en una **interfaz web accesible desde localhost** con una representación gráfica en 3D.

El sistema está diseñado para funcionar de forma **autónoma**, de modo que, una vez cargado el firmware en la ESP32, esta puede alimentarse mediante batería portátil y conectarse automáticamente al servidor cuando esté disponible.

---

## 2. Estructura del proyecto

TFG/
├── arduinoTFG.txt
│   Código del firmware para la ESP32
│
├── imu-live/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   ├── node_modules/
│   └── public/
│       └── index.html
│
└── influxdb2-2.7.5-windows/
    Binarios locales de InfluxDB (opcional)

---

## 3. Requisitos

### Hardware
- ESP32
- Sensor IMU conectado a la ESP32
- Batería portátil (power bank) o alimentación externa

### Software
- Arduino IDE
- Node.js (v16 o superior)
- Navegador web moderno (Chrome, Firefox)

---

## 4. Carga del firmware en la ESP32

Este paso solo es necesario la primera vez o cuando se modifica el firmware.

1. Conectar la ESP32 al ordenador mediante USB
2. Abrir **Arduino IDE**
3. Crear un nuevo sketch y copiar el contenido del archivo `arduinoTFG.txt`
4. Seleccionar:
   - Placa: ESP32 Dev Module
   - Puerto correspondiente
5. Pulsar **Upload**

Una vez cargado, el firmware se ejecuta automáticamente en cada arranque de la ESP32.

---

## 5. Arranque del servidor Node.js

### 5.1 Acceder a la carpeta del servidor

cd imu-live

### 5.2 Instalar dependencias (solo la primera vez)

npm install

### 5.3 Arrancar el servidor

node server.js

---

## 6. Visualización en la web (localhost)

Abrir un navegador web y acceder a:

http://localhost:8800

Si la ESP32 está conectada correctamente, la interfaz mostrará la representación 3D del vehículo y los datos se actualizarán en tiempo real.

---

## 7. Funcionamiento autónomo con batería

Una vez comprobado que el sistema funciona correctamente:

1. Desconectar la ESP32 del ordenador
2. Conectarla a una batería portátil
3. Esperar unos segundos (arranque y conexión WiFi)
4. La ESP32 se conectará automáticamente al servidor Node.js

---

## 8. Uso habitual del sistema

1. Conectar la ESP32 a una batería
2. Ejecutar el servidor Node.js:
   node server.js
3. Abrir el navegador en http://localhost:8800

---

## 9. Apagado del sistema

- Detener el servidor Node.js con Ctrl + C
- Desconectar la alimentación de la ESP32

---

## 10. Nota final

Este proyecto ha sido desarrollado como **Trabajo de Fin de Grado**, integrando sistemas embebidos, comunicaciones en tiempo real y visualización web interactiva.
