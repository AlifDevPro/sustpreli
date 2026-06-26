import http from 'node:http';
import https from 'node:https';

const KEEP_ALIVE_MS = 30_000;
const MAX_SOCKETS = 50;

let httpAgent: http.Agent | null = null;
let httpsAgent: https.Agent | null = null;

export function getHttpAgent(): http.Agent {
  if (!httpAgent) {
    httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: KEEP_ALIVE_MS,
      maxSockets: MAX_SOCKETS,
      maxFreeSockets: 10,
    });
  }

  return httpAgent;
}

export function getHttpsAgent(): https.Agent {
  if (!httpsAgent) {
    httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: KEEP_ALIVE_MS,
      maxSockets: MAX_SOCKETS,
      maxFreeSockets: 10,
    });
  }

  return httpsAgent;
}

export function destroyHttpAgents(): void {
  httpAgent?.destroy();
  httpsAgent?.destroy();
  httpAgent = null;
  httpsAgent = null;
}
