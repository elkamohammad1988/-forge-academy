import 'dotenv/config';
import { createApp } from './src/app.js';
import { closeDb } from './src/db.js';

const app  = createApp();
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

const server = app.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ Forge server listening on http://${host}:${port}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down…`);
  server.close((err) => {
    if (err) { console.error(err); process.exit(1); }
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
