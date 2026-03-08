export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';

export type UploadTask = {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  parentId: string | null;
  status: UploadStatus;
  progress: number; // 0-100
  uploadedBytes: number;
  error?: string;
  abortController?: AbortController;
  createdAt: number;
};

export type UploadProgress = {
  uploadedBytes: number;
  totalBytes: number;
  progress: number; // 0-100
};

export type UploadResult = {
  success: true;
  fileId: string;
  name: string;
} | {
  success: false;
  error: string;
};
