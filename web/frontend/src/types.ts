export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  containers: string[];
  volumes: VolumeInfo[];
  labels: Record<string, string>;
}

export interface VolumeInfo {
  name: string;
  type: string;
  mountPath: string;
  readOnly: boolean;
  isPv: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
  isPvPath: boolean;
}

export interface SearchResult {
  path: string;
  pod: string;
  container: string;
}
