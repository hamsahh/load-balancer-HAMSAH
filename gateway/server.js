const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { randomUUID } = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 3000);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SERVERS = [
  {
    id: 'server-a',
    name: 'Server Akademik',
    url: process.env.SERVER_A_URL || 'http://server-a:3000',
    activeConnections: 0,
    totalRequests: 0,
    online: false,
    lastLatencyMs: null,
    lastError: null
  },
  {
    id: 'server-b',
    name: 'Server Administrasi',
    url: process.env.SERVER_B_URL || 'http://server-b:3000',
    activeConnections: 0,
    totalRequests: 0,
    online: false,
    lastLatencyMs: null,
    lastError: null
  },
  {
    id: 'server-c',
    name: 'Server Layanan',
    url: process.env.SERVER_C_URL || 'http://server-c:3000',
    activeConnections: 0,
    totalRequests: 0,
    online: false,
    lastLatencyMs: null,
    lastError: null
  }
];

const ALGORITHMS = ['round-robin', 'least-connection'];
let algorithm = 'round-robin';
let rrIndex = 0;
let requestLogs = [];

function addLog(entry) {
  requestLogs.unshift({
    time: new Date().toLocaleTimeString('id-ID', { hour12: false }),
    ...entry
  });
  requestLogs = requestLogs.slice(0, 40);
}

function getState() {
  return {
    algorithm,
    servers: SERVERS.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      activeConnections: s.activeConnections,
      totalRequests: s.totalRequests,
      online: s.online,
      lastLatencyMs: s.lastLatencyMs,
      lastError: s.lastError
    })),
    logs: requestLogs
  };
}

function broadcast() {
  const message = JSON.stringify({ type: 'state', data: getState() });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(message);
  }
}

function selectRoundRobin() {
  const selected = SERVERS[rrIndex % SERVERS.length];
  rrIndex = (rrIndex + 1) % SERVERS.length;
  return selected;
}

function selectLeastConnection() {
  return SERVERS.reduce((best, current) => {
    if (current.activeConnections < best.activeConnections) return current;
    if (current.activeConnections === best.activeConnections && current.totalRequests < best.totalRequests) return current;
    return best;
  }, SERVERS[0]);
}

function selectServer() {
  return algorithm === 'least-connection' ? selectLeastConnection() : selectRoundRobin();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function forwardRequest() {
  const target = selectServer();
  const requestId = randomUUID();
  const startedAt = Date.now();

  target.activeConnections += 1;
  target.totalRequests += 1;
  target.lastError = null;
  broadcast();

  try {
    const response = await fetchWithTimeout(`${target.url}/work`, {
      method: 'GET',
      headers: { 'x-request-id': requestId }
    }, 7000);

    if (!response.ok) {
      throw new Error(`Backend memberi status ${response.status}`);
    }

    const backendData = await response.json();
    const latencyMs = Date.now() - startedAt;
    target.lastLatencyMs = latencyMs;
    target.online = true;

    addLog({
      requestId,
      status: 'success',
      algorithm,
      targetId: target.id,
      targetName: target.name,
      latencyMs,
      processingTimeMs: backendData.processingTimeMs
    });

    return {
      ok: true,
      gateway: {
        requestId,
        algorithm,
        targetId: target.id,
        targetName: target.name,
        latencyMs
      },
      backend: backendData
    };
  } catch (error) {
    target.lastError = error.message;
    target.online = false;

    addLog({
      requestId,
      status: 'failed',
      algorithm,
      targetId: target.id,
      targetName: target.name,
      error: error.message
    });

    return {
      ok: false,
      gateway: {
        requestId,
        algorithm,
        targetId: target.id,
        targetName: target.name
      },
      error: error.message
    };
  } finally {
    target.activeConnections = Math.max(0, target.activeConnections - 1);
    broadcast();
  }
}

async function checkBackendHealth() {
  await Promise.all(SERVERS.map(async serverInfo => {
    try {
      const startedAt = Date.now();
      const response = await fetchWithTimeout(`${serverInfo.url}/health`, {}, 2500);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      serverInfo.online = true;
      serverInfo.lastLatencyMs = Date.now() - startedAt;
      serverInfo.lastError = null;
    } catch (error) {
      serverInfo.online = false;
      serverInfo.lastError = error.message;
    }
  }));
  broadcast();
}

app.get('/api/stats', (req, res) => {
  res.json(getState());
});

app.get('/api/work', async (req, res) => {
  const result = await forwardRequest();
  res.status(result.ok ? 200 : 502).json(result);
});

app.post('/api/algorithm', (req, res) => {
  const requestedAlgorithm = String(req.body.algorithm || '').toLowerCase();

  if (!ALGORITHMS.includes(requestedAlgorithm)) {
    return res.status(400).json({
      ok: false,
      message: `Algoritma tidak valid. Gunakan salah satu: ${ALGORITHMS.join(', ')}`
    });
  }

  algorithm = requestedAlgorithm;
  rrIndex = 0;
  addLog({ status: 'info', message: `Algoritma diganti ke ${algorithm}` });
  broadcast();

  res.json({ ok: true, algorithm });
});

app.post('/api/test', async (req, res) => {
  const totalRequests = Math.min(Math.max(Number(req.body.requests || 10), 1), 100);
  const intervalMs = Math.min(Math.max(Number(req.body.intervalMs || 25), 0), 1000);

  const jobs = [];
  for (let i = 0; i < totalRequests; i += 1) {
    jobs.push(new Promise(resolve => {
      setTimeout(async () => {
        resolve(await forwardRequest());
      }, i * intervalMs);
    }));
  }

  const results = await Promise.all(jobs);
  const distribution = results.reduce((acc, item) => {
    const key = item.gateway?.targetId || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  res.json({
    ok: true,
    algorithm,
    totalRequests,
    intervalMs,
    distribution,
    results
  });
});

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'state', data: getState() }));
});

setInterval(checkBackendHealth, 3000);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Smart Gateway Load Balancer berjalan di http://localhost:${PORT}`);
  await checkBackendHealth();
});
