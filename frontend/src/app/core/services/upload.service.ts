import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UploadService {
  private readonly apiUrl = '/api/uploads';

  constructor(private http: HttpClient) {}

  getAvatarUploadUrl(
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): Observable<{ upload_url: string; storage_key: string }> {
    return this.http.post<{ upload_url: string; storage_key: string }>(
      `${this.apiUrl}/avatar`,
      { file_name: fileName, file_size: fileSize, mime_type: mimeType },
    );
  }

  confirmAvatarUpload(storageKey: string): Observable<{ avatar_url: string }> {
    return this.http.post<{ avatar_url: string }>(
      `${this.apiUrl}/avatar/confirm`,
      { storage_key: storageKey },
    );
  }

  getLogoUploadUrl(
    workspaceId: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
  ): Observable<{ upload_url: string; storage_key: string }> {
    return this.http.post<{ upload_url: string; storage_key: string }>(
      `${this.apiUrl}/workspace-logo`,
      { workspace_id: workspaceId, file_name: fileName, file_size: fileSize, mime_type: mimeType },
    );
  }

  confirmLogoUpload(
    workspaceId: string,
    storageKey: string,
  ): Observable<{ logo_url: string }> {
    return this.http.post<{ logo_url: string }>(
      `${this.apiUrl}/workspace-logo/confirm`,
      { workspace_id: workspaceId, storage_key: storageKey },
    );
  }

  uploadFileToPresignedUrl(url: string, file: File): Observable<void> {
    return this.http.put<void>(url, file, {
      headers: { 'Content-Type': file.type },
    });
  }
}
