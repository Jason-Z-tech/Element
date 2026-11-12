import { randomBytes, randomInt } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Lab } from './lab';
import type { ClientMessage, ServerMessage } from './protocol';

/**
 * Team-Server von Elementjäger. Alles außer der Team-Funktion läuft ohne ihn.
 *
 *   PORT=8787 npm run start -w @elementjaeger/server
 */
const port = Number(process.env.PORT ?? 8787);
const labs = new Map<string, Lab>();
/** Labore ohne Spieler werden nach dieser Zeit entfernt. */
const LAB_TTL_MS = 6 * 3600 * 1000;
const emptySince = new Map<string, number>();

interface Session {
  readonly socket: WebSocket;
  readonly id: string;
  lab: Lab | null;
}
const sessions = new Set<Session>();

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(lab: Lab): void {
  const state = lab.view(Date.now());
  for (const s of sessions) if (s.lab === lab) send(s.socket, { t: 'state', state });
}

function newLabId(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (;;) {
    let id = '';
    for (let i = 0; i < 6; i++) id += alphabet[randomInt(alphabet.length)];
    if (!labs.has(id)) return id;
  }
}

function handle(session: Session, message: ClientMessage): void {
  const now = Date.now();
  if (message.t === 'create' || message.t === 'join') {
    let lab: Lab | undefined;
    if (message.t === 'create') {
      lab = new Lab(newLabId(), randomBytes(4).readUInt32LE(0));
      labs.set(lab.id, lab);
    } else {
      lab = labs.get(message.lab.toLowerCase());
      if (!lab) return send(session.socket, { t: 'error', message: 'Dieses Labor gibt es nicht (mehr).' });
    }
    session.lab = lab;
    lab.join(session.id, message.name);
    emptySince.delete(lab.id);
    send(session.socket, { t: 'welcome', you: session.id, state: lab.view(now) });
    return broadcast(lab);
  }
  const lab = session.lab;
  if (!lab) return send(session.socket, { t: 'error', message: 'Erst ein Labor eröffnen oder beitreten.' });
  switch (message.t) {
    case 'campaign':
      lab.startCampaign(message.kind, message.members);
      return broadcast(lab);
    case 'ready': {
      const work = lab.nextPacket(session.id, now);
      return send(session.socket, work ? { t: 'work', ...work } : { t: 'idle' });
    }
    case 'result': {
      lab.submit(session.id, message.job, message.packet, message.values, now);
      return scheduleBroadcast(lab);
    }
    case 'run':
      lab.addRun(session.id, message.settings);
      return broadcast(lab);
    case 'series':
      lab.startSeries(message.hidden, randomBytes(4).readUInt32LE(0));
      return broadcast(lab);
    case 'reveal':
      lab.revealSeries();
      return broadcast(lab);
  }
}

// Zustand höchstens zweimal pro Sekunde verschicken.
const pending = new Set<Lab>();
function scheduleBroadcast(lab: Lab): void {
  if (pending.has(lab)) return;
  pending.add(lab);
  setTimeout(() => {
    pending.delete(lab);
    broadcast(lab);
  }, 500);
}

const http = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify({ name: 'Elementjäger Team-Server', labs: labs.size, hint: 'Verbindung per WebSocket' }));
});
const wss = new WebSocketServer({ server: http, maxPayload: 256 * 1024 });

wss.on('connection', (socket) => {
  const session: Session = { socket, id: randomBytes(8).toString('hex'), lab: null };
  sessions.add(session);
  socket.on('message', (data) => {
    try {
      handle(session, JSON.parse(String(data)) as ClientMessage);
    } catch (error) {
      send(socket, { t: 'error', message: error instanceof Error ? error.message : 'Ungültige Nachricht' });
    }
  });
  socket.on('close', () => {
    sessions.delete(session);
    if (session.lab) {
      session.lab.leave(session.id);
      if (session.lab.onlineCount === 0) emptySince.set(session.lab.id, Date.now());
      broadcast(session.lab);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, since] of emptySince) {
    if (now - since > LAB_TTL_MS) {
      labs.delete(id);
      emptySince.delete(id);
    }
  }
}, 60_000).unref();

http.listen(port, () => console.log(`Elementjäger Team-Server läuft auf Port ${port}`));
