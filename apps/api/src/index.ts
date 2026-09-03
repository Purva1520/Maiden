import { buildServer } from './server.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = buildServer();

app
  .listen({ port: config.port, host: config.host })
  .then((address) => {
    console.log(`Maiden API listening on ${address} (${config.nodeEnv})`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
