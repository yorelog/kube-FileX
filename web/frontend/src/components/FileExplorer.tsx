import { useState, useEffect } from 'react';
import type { FileInfo, VolumeInfo } from '../types';
import { api } from '../api';
import { useToast } from './ToastContext';
import ConfirmDialog from './ConfirmDialog';

interface FileExplorerProps {
  namespace: string;
  podName: string;
  containerName: string;
  volumes: VolumeInfo[];
}

export default function FileExplorer({
  namespace,
  podName,
  containerName,
  volumes,
}: FileExplorerProps) {
  const { showToast } = useToast();
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FileInfo | null>(null);

  useEffect(() => {
    loadFiles(currentPath);
  }, [namespace, podName, containerName, currentPath]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listFiles(namespace, podName, containerName, path);
      // Mark files in PV paths
      const volumePaths = volumes.filter((v) => v.isPv).map((v) => v.mountPath);
      const enrichedFiles = data.map((file) => ({
        ...file,
        isPvPath: volumePaths.some((vp) => file.path.startsWith(vp)),
      }));
      setFiles(enrichedFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const handleFileClick = (file: FileInfo) => {
    if (file.isDir) {
      handleNavigate(file.path);
    } else {
      setSelectedFile(file);
    }
  };

  const handleDownload = async (file: FileInfo) => {
    try {
      const blob = await api.readFile(
        namespace,
        podName,
        containerName,
        file.path
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('File downloaded successfully', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Download failed', 'error');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      const uploadPath = `${currentPath}/${uploadFile.name}`.replace('//', '/');
      await api.writeFile(
        namespace,
        podName,
        containerName,
        uploadPath,
        uploadFile
      );
      showToast('File uploaded successfully', 'success');
      setUploadFile(null);
      loadFiles(currentPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  };

  const handleDelete = async (file: FileInfo) => {
    setDeleteConfirm(file);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await api.deleteFile(namespace, podName, containerName, deleteConfirm.path);
      showToast('File deleted successfully', 'success');
      loadFiles(currentPath);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const getParentPath = (path: string) => {
    if (path === '/') return '/';
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return '/' + parts.join('/');
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Path Navigation */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigate(getParentPath(currentPath))}
            disabled={currentPath === '/'}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <div className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
            {currentPath}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="text-sm"
          />
          {uploadFile && (
            <button
              onClick={handleUpload}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
            >
              Upload
            </button>
          )}
          <button
            onClick={() => loadFiles(currentPath)}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="p-4">
        {error && (
          <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading files...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Size</th>
                  <th className="text-left py-2 px-2">Modified</th>
                  <th className="text-left py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-500">
                      No files in this directory
                    </td>
                  </tr>
                ) : (
                  files.map((file) => (
                    <tr
                      key={file.path}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <button
                          onClick={() => handleFileClick(file)}
                          className="flex items-center gap-2 text-left hover:text-blue-600 transition-colors"
                        >
                          <span className="text-lg">
                            {file.isDir ? '📁' : '📄'}
                          </span>
                          <span className="font-medium">{file.name}</span>
                          {file.isPvPath && (
                            <span className="inline-block px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                              PV
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="py-2 px-2 text-gray-600">
                        {file.isDir ? '-' : formatSize(file.size)}
                      </td>
                      <td className="py-2 px-2 text-gray-600 font-mono text-xs">
                        {file.modTime}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-1">
                          {!file.isDir && (
                            <button
                              onClick={() => handleDownload(file)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                            >
                              Download
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(file)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {selectedFile && !selectedFile.isDir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">{selectedFile.name}</h3>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>Path:</strong> {selectedFile.path}
                </p>
                <p>
                  <strong>Size:</strong> {formatSize(selectedFile.size)}
                </p>
                <p>
                  <strong>Modified:</strong> {selectedFile.modTime}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handleDownload(selectedFile)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
