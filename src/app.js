import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { initDb } from './db.js';
import { loadSession } from './middleware/auth.js';
import { checkOrigin } from './middleware/origin.js';
import leadsRoute       from './routes/leads.js';
import contactRoute     from './routes/contact.js';
import newsletterRoute  from './routes/newsletter.js';
import authRoute        from './routes/auth.js';
import adminRoute       from './routes/admin.js';
import scheduleRoute    from './routes/schedule.js';
import bookingsRoute    from './routes/bookings.js';
import checkoutRoute, { stripeWebhookHandler } from './routes/checkout.js';
import metaRoute        from './routes/meta.js';
import blogRoute        from './routes/blog.js';
import sseRoute         from './routes/sse.js';
import coachRoute       from './routes/coach.js';
import achievementsRoute from './routes/achievements.js';
import scheduleAdminRoute from './routes/schedule-admin.js';
import webhooksAdminRoute from './routes/webhooks-admin.js';
import gdprRoute        from './routes/gdpr.js';
import icalRoute        from './routes/ical.js';
import { startDripWorker } from './lib/drip.js';
import { startReminderWorker } from './lib/reminders.js';
import pushRoute        from './routes/push.js';
import referralsRoute   from './routes/referrals.js';
import importRoute      from './routes/import.js';
import ptRoute          from './routes/pt.js';
import gradingsRoute    from './routes/gradings.js';
import pausesRoute      from './routes/pauses.js';
import passesRoute      from './routes/passes.js';
import uploadsRoute     from './routes/uploads.js';
import waiversRoute     from './routes/waivers.js';
import { startWebhookRetryWorker } from './lib/webhooks.js';
import { startRetentionWorker } from './lib/retention.js';
import { mkdirSync } from 'node:fs';
import { createStream as createRotatingStream } from 'rotating-file-stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

export function createApp() {
  initDb();
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Stripe webhook needs raw body — register BEFORE the JSON body parser.
  app.post('/api/checkout/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  app.use(helmet({
    contentSecurityPolicy: false,         // CSP delivered by HTML meta + _headers
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use(cors({
    origin: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean) || true,
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: true, limit: '32kb' }));
  // Production logging: rotating files in ./logs, plus stdout for the tail.
  if (process.env.NODE_ENV === 'production') {
    try {
      mkdirSync('./logs', { recursive: true });
      const accessLog = createRotatingStream('access.log', {
        size: '10M', interval: '1d', path: './logs', compress: 'gzip',
      });
      app.use(morgan('combined', { stream: accessLog }));
      app.use(morgan('combined'));
    } catch {
      app.use(morgan('combined'));
    }
  } else {
    app.use(morgan('dev'));
  }
  app.use(loadSession);

  // Rate-limit just the public POST endpoints (forms + auth)
  const formLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MIN || '15', 10) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
  });
  // Auth endpoints get a tighter cap than the public forms. The cap is
  // env-tunable so the automated test suite can raise it; the shipped
  // default (20 per 15 minutes) is unchanged.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

  app.use('/api', checkOrigin);
  app.use('/api/leads',       formLimiter, leadsRoute);
  app.use('/api/contact',     formLimiter, contactRoute);
  app.use('/api/newsletter',  formLimiter, newsletterRoute);
  app.use('/api/auth',        authLimiter, authRoute);
  app.use('/api/schedule',    scheduleRoute);
  app.use('/api/bookings',    bookingsRoute);
  app.use('/api/checkout',    checkoutRoute);
  app.use('/api/blog',        blogRoute);
  app.use('/api/admin/events', sseRoute);
  app.use('/api/admin',       adminRoute);
  app.use('/api/coach',       coachRoute);
  app.use('/api/achievements', achievementsRoute);
  app.use('/api/admin/schedule', scheduleAdminRoute);
  app.use('/api/admin/webhooks', webhooksAdminRoute);
  app.use('/api/gdpr',        gdprRoute);
  app.use('/api/push',        pushRoute);
  app.use('/api/referrals',   referralsRoute);
  app.use('/api/admin/import', importRoute);
  app.use('/api/pt',          ptRoute);
  app.use('/api/gradings',    gradingsRoute);
  app.use('/api/pauses',      pausesRoute);
  app.use('/api/passes',      passesRoute);
  app.use('/api/uploads',     uploadsRoute);
  app.use('/api/waivers',     waiversRoute);

  // Public iCal feed for class subscriptions (Google/Apple Calendar etc.)
  app.use('/calendar',        icalRoute);

  // Public file serving for uploaded gallery photos / coach avatars / blog
  app.use('/uploads', express.static(process.env.UPLOAD_DIR || './data/uploads', {
    maxAge: '7d', immutable: false, fallthrough: true,
  }));

  // Background workers — drain queues + send class reminders + webhook retries
  if (process.env.NODE_ENV !== 'test') {
    startDripWorker();
    startReminderWorker();
    startWebhookRetryWorker();
    startRetentionWorker();
  }
  app.use('/api',             metaRoute);   // /api/metrics + /api/openapi.json

  // Static frontend
  app.use(express.static(ROOT, {
    index: 'index.html',
    extensions: ['html'],
    setHeaders: (res, filePath) => {
      if (/\.(css|js|svg|webmanifest)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Service-Worker-Allowed', '/');
      }
    },
  }));

  // SPA-style 404 fallback for unknown HTML routes
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
      return res.status(404).sendFile(path.join(ROOT, '404.html'));
    }
    next();
  });

  // JSON error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({ ok: false, error: 'Internal error.' });
    }
    res.status(500).sendFile(path.join(ROOT, '404.html'));
  });

  return app;
}
