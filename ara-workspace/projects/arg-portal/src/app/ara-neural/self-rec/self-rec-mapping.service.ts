import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MappingRow {
  sourceAField: string;
  sourceBField: string | null;
  confidence: 'high' | 'low' | 'none';
}

export interface SuggestResponse {
  mappings: MappingRow[];
}

export interface SaveMappingResponse {
  saved: boolean;
  mappingId: string;
  mappedCount: number;
}

@Injectable({ providedIn: 'root' })
export class SelfRecMappingService {

  private readonly http = inject(HttpClient);

  suggest(columnsA: string[], columnsB: string[]): Observable<SuggestResponse> {
    return this.http.post<SuggestResponse>('/api/ara-self-rec/mapping/suggest', {
      columnsA,
      columnsB,
    });
  }

  saveMapping(mappings: MappingRow[]): Observable<SaveMappingResponse> {
    return this.http.post<SaveMappingResponse>('/api/ara-self-rec/mapping', { mappings });
  }
}
