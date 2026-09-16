/* Server-Sent Events for the admin live feed.
   Admins subscribe to GET /api/admin/events; new leads / contacts push events.
*/
import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';

const clients = new Set();

export function broadcastSSE(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try { res.write(data); } catch {}
  }
}

const router = Router();
router.use(requireAdmin);

router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Initial hello (also defeats some proxies that buffer until first event)
  res.write(`event: hello\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
  clients.add(res);

  // Heartbeat every 25s so reverse-proxies don't drop the connection
  const beat = setInterval(() => {
    try { res.write(`: ping ${Date.now()}\n\n`); } catch {}
  }, 25_000);

  req.on('close', () => {
    clearInterval(beat);
    clients.delete(res);
  });
});

export default router;
