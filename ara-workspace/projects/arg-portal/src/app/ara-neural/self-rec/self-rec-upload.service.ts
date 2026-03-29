import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UploadResponse {
  source: 'A' | 'B';
  name: string;
  size: number;
  columns: string[];
  preview: string[][];
}

@Injectable({ providedIn: 'root' })
export class SelfRecUploadService {

  private readonly http = inject(HttpClient);

  upload(file: File, source: 'A' | 'B'): Observable<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('source', source);
    return this.http.post<UploadResponse>('/api/ara-self-rec/uploads', form);
  }
}
