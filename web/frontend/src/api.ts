import type { PodInfo, FileInfo } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

class ApiClient {
  async listPods(namespace: string): Promise<PodInfo[]> {
    const response = await fetch(`${API_BASE}/api/pods?namespace=${namespace}`);
    if (!response.ok) {
      throw new Error(`Failed to list pods: ${response.statusText}`);
    }
    return response.json();
  }

  async listFiles(
    namespace: string,
    podName: string,
    containerName: string,
    path: string
  ): Promise<FileInfo[]> {
    const params = new URLSearchParams({
      namespace,
      pod: podName,
      container: containerName,
      path,
    });
    const response = await fetch(`${API_BASE}/api/files/list?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }
    return response.json();
  }

  async readFile(
    namespace: string,
    podName: string,
    containerName: string,
    filePath: string
  ): Promise<Blob> {
    const params = new URLSearchParams({
      namespace,
      pod: podName,
      container: containerName,
      path: filePath,
    });
    const response = await fetch(`${API_BASE}/api/files/read?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    return response.blob();
  }

  async writeFile(
    namespace: string,
    podName: string,
    containerName: string,
    filePath: string,
    content: Blob
  ): Promise<void> {
    const params = new URLSearchParams({
      namespace,
      pod: podName,
      container: containerName,
      path: filePath,
    });
    const response = await fetch(`${API_BASE}/api/files/write?${params}`, {
      method: 'POST',
      body: content,
    });
    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.statusText}`);
    }
  }

  async deleteFile(
    namespace: string,
    podName: string,
    containerName: string,
    filePath: string
  ): Promise<void> {
    const params = new URLSearchParams({
      namespace,
      pod: podName,
      container: containerName,
      path: filePath,
    });
    const response = await fetch(`${API_BASE}/api/files/delete?${params}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  async copyFile(data: {
    srcNamespace: string;
    srcPod: string;
    srcContainer: string;
    srcPath: string;
    dstNamespace: string;
    dstPod: string;
    dstContainer: string;
    dstPath: string;
  }): Promise<void> {
    const response = await fetch(`${API_BASE}/api/files/copy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Failed to copy file: ${response.statusText}`);
    }
  }

  async searchByName(
    namespace: string,
    podName: string,
    containerName: string,
    searchPath: string,
    pattern: string
  ): Promise<string[]> {
    const params = new URLSearchParams({
      namespace,
      pod: podName,
      container: containerName,
      searchPath,
      pattern,
    });
    const response = await fetch(`${API_BASE}/api/search/name?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }
    return response.json();
  }

  async searchByContent(
    namespace: string,
    podName: string,
    containerName: string,
    searchPath: string,
    content: string
  ): Promise<string[]> {
    const params = new URLSearchParams({
      namespace,
      pod: podName,
      container: containerName,
      searchPath,
      content,
    });
    const response = await fetch(`${API_BASE}/api/search/content?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }
    return response.json();
  }
}

export const api = new ApiClient();
