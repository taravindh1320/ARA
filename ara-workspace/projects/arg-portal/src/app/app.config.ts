import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import {
  NeuralSchemaService,
  LocalMockNeuralSchemaService,
} from './ara-neural/services/neural-schema.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    // ARA Neural — swap useClass → BackendNeuralSchemaService when real API is ready
    { provide: NeuralSchemaService, useClass: LocalMockNeuralSchemaService },
  ],
};
