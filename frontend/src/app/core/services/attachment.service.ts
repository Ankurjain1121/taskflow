import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, from, switchMap, tap, catchError, throwError, finalize } from 'rxjs';

export interface Attachment {
  id: string;
  task_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  uploaded_by: string;
  created_at: string;
  uploader: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface UploadUrlResponse {
  uploadUrl: string;
  storageKey: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
}

export interface ConfirmUploadRequest {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadProgress {
  status: 'pending' | 'uploading' | 'confirming' | 'completed' | 'error';
  progress: number;
  fileName: string;
  fileSize: number;
  error?: string;
  attachment?: Attachment;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable({
  providedIn: 'root',
})
export class AttachmentService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getUploadUrl(taskId: string, file: File): Observable<UploadUrlResponse> {
    return this.http.post<UploadUrlResponse>(
      `${this.apiUrl}/tasks/${taskId}/attachments/upload-url`,
      {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      }
    );
  }

  confirmUpload(
    taskId: string,
    data: ConfirmUploadRequest
  ): Observable<Attachment> {
    return this.http.post<Attachment>(
      `${this.apiUrl}/tasks/${taskId}/attachments/confirm`,
      data
    );
  }

  getDownloadUrl(id: string): Observable<DownloadUrlResponse> {
    return this.http.get<DownloadUrlResponse>(
      `${this.apiUrl}/attachments/${id}/download-url`
    );
  }

  listByTask(taskId: string): Observable<Attachment[]> {
    return this.http.get<Attachment[]>(
      `${this.apiUrl}/tasks/${taskId}/attachments`
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/attachments/${id}`);
  }

  /**
   * Orchestrates the full upload flow with progress reporting:
   * 1. Validate file size client-side
   * 2. Get presigned URL from backend
   * 3. Upload directly to MinIO with progress events
   * 4. Confirm upload with backend
   */
  uploadFile(taskId: string, file: File): Observable<UploadProgress> {
    const subject = new Subject<UploadProgress>();

    // Client-side size validation
    if (file.size > MAX_FILE_SIZE) {
      setTimeout(() => {
        subject.next({
          status: 'error',
          progress: 0,
          fileName: file.name,
          fileSize: file.size,
          error: `File size exceeds maximum allowed (10MB). File is ${this.formatFileSize(file.size)}.`,
        });
        subject.complete();
      }, 0);
      return subject.asObservable();
    }

    // Start the upload process
    subject.next({
      status: 'pending',
      progress: 0,
      fileName: file.name,
      fileSize: file.size,
    });

    // Step 1: Get presigned upload URL
    this.getUploadUrl(taskId, file)
      .pipe(
        switchMap((urlResponse) => {
          // Step 2: Upload to MinIO using XMLHttpRequest for progress
          return this.uploadToPresignedUrl(
            urlResponse.uploadUrl,
            file,
            subject
          ).pipe(
            switchMap(() => {
              // Step 3: Confirm upload
              subject.next({
                status: 'confirming',
                progress: 100,
                fileName: file.name,
                fileSize: file.size,
              });

              return this.confirmUpload(taskId, {
                storageKey: urlResponse.storageKey,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || 'application/octet-stream',
              });
            })
          );
        }),
        catchError((error) => {
          subject.next({
            status: 'error',
            progress: 0,
            fileName: file.name,
            fileSize: file.size,
            error: error.message || 'Upload failed',
          });
          return throwError(() => error);
        }),
        finalize(() => subject.complete())
      )
      .subscribe({
        next: (attachment) => {
          subject.next({
            status: 'completed',
            progress: 100,
            fileName: file.name,
            fileSize: file.size,
            attachment,
          });
        },
        error: () => {
          // Error already handled in catchError
        },
      });

    return subject.asObservable();
  }

  private uploadToPresignedUrl(
    url: string,
    file: File,
    progressSubject: Subject<UploadProgress>
  ): Observable<void> {
    return new Observable((observer) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          progressSubject.next({
            status: 'uploading',
            progress,
            fileName: file.name,
            fileSize: file.size,
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next();
          observer.complete();
        } else {
          observer.error(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        observer.error(new Error('Upload failed due to network error'));
      });

      xhr.addEventListener('abort', () => {
        observer.error(new Error('Upload was cancelled'));
      });

      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);

      // Return cleanup function
      return () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) {
          xhr.abort();
        }
      };
    });
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
