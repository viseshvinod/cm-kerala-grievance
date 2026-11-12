const config = require('./config');
const app = require('./app');
const { migrate } = require('./db/migrate');
const { seedIfEmpty } = require('./db/seed');

(async () => {
  await migrate();
  if (config.seedOnStart) await seedIfEmpty();
  app.listen(config.port, () => console.log(`CM Kerala Grievance Portal API listening on :${config.port}`));
})().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
