const express = require('express');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const SERVER_ID = process.env.SERVER_ID || 'server-a';
const SERVICE_NAME = process.env.SERVICE_NAME || 'Backend Simulasi';
const MIN_DELAY = Number(process.env.MIN_DELAY || 50);
const MAX_DELAY = Number(process.env.MAX_DELAY || 220);

let activeConnections = 0;
let totalRequests = 0;
const startedAt = Date.now();

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

function baseStats() {
  return {
    ok: true,
    serverId: SERVER_ID,
    serviceName: SERVICE_NAME,
    hostname: os.hostname(),
    port: PORT,
    activeConnections,
    totalRequests,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    delayRangeMs: `${MIN_DELAY}-${MAX_DELAY}`
  };
}

app.get('/', (req, res) => {
  res.json({
    message: `${SERVICE_NAME} aktif`,
    ...baseStats()
  });
});

app.get('/health', (req, res) => {
  res.json(baseStats());
});

app.get('/stats', (req, res) => {
  res.json(baseStats());
});

app.get('/work', (req, res) => {
  const requestId = req.headers['x-request-id'] || `manual-${Date.now()}`;
  const delayMs = randomDelay();

  activeConnections += 1;
  totalRequests += 1;

  console.log(`[${SERVER_ID}] menerima request ${requestId}. Aktif: ${activeConnections}`);

  setTimeout(() => {
    activeConnections -= 1;

    res.json({
      requestId,
      serverId: SERVER_ID,
      serviceName: SERVICE_NAME,
      message: `Request diproses oleh ${SERVICE_NAME}`,
      processingTimeMs: delayMs,
      activeConnections,
      totalRequests,
      timestamp: new Date().toISOString()
    });

    console.log(`[${SERVER_ID}] selesai request ${requestId}. Aktif: ${activeConnections}`);
  }, delayMs);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`${SERVICE_NAME} (${SERVER_ID}) berjalan pada port ${PORT}`);
});
