/**
 * ARA Neural Backend — Entry Point
 * =================================
 * Loads data into memory first, then starts the HTTP server.
 * This guarantees the first API request never hits a cold/empty data store.
 */
import app                  from './app';
import { config }           from './config';
import { NeuralDataService } from './services/neural.service';

NeuralDataService.load()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`[ARA Neural API] Listening on http://localhost:${config.port}`);
      console.log(`[ARA Neural API] Health check: http://localhost:${config.port}/health`);
      console.log(`[ARA Neural API] FULL_KEY list: http://localhost:${config.port}/api/ara-neural/fullkeys`);
    });
  })
  .catch((err: Error) => {
    console.error('[ARA Neural API] Startup failed:', err.message);
    process.exit(1);
  });
