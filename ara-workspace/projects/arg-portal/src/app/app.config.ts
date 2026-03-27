import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { NeuralSchemaService } from './ara-neural/services/neural-schema.service';
import { BackendNeuralSchemaService } from './ara-neural/services/backend-neural-schema.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // ARA Neural — backed by Express API (proxied via proxy.conf.json in dev)
    // To revert to local mock: swap useClass → LocalMockNeuralSchemaService
    { provide: NeuralSchemaService, useClass: BackendNeuralSchemaService },
  ],
};
