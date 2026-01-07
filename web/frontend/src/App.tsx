import { useState, useEffect } from 'react';
import PodSelector from './components/PodSelector';
import FileExplorer from './components/FileExplorer';
import SearchBar from './components/SearchBar';
import type { PodInfo } from './types';
import { api } from './api';

function App() {
  const [namespace, setNamespace] = useState('default');
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [selectedPod, setSelectedPod] = useState<PodInfo | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadPods();
  }, [namespace]);

  const loadPods = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listPods(namespace);
      setPods(data);
      if (data.length > 0) {
        setSelectedPod(data[0]);
        if (data[0].containers.length > 0) {
          setSelectedContainer(data[0].containers[0]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">KubeFileX</h1>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm">Namespace:</span>
                <input
                  type="text"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value)}
                  className="px-3 py-1 rounded bg-white text-gray-900 text-sm"
                  placeholder="default"
                />
              </label>
              <button
                onClick={loadPods}
                className="px-4 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
          <p className="text-sm text-blue-100 mt-2">
            Browse, search, and transfer files across Kubernetes Pods
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Sidebar - Pod Selector */}
            <div className="col-span-3">
              <PodSelector
                pods={pods}
                selectedPod={selectedPod}
                selectedContainer={selectedContainer}
                onPodSelect={setSelectedPod}
                onContainerSelect={setSelectedContainer}
              />
            </div>

            {/* Main Area - File Explorer */}
            <div className="col-span-9">
              {selectedPod && selectedContainer ? (
                <>
                  <SearchBar
                    namespace={namespace}
                    podName={selectedPod.name}
                    containerName={selectedContainer}
                  />
                  <FileExplorer
                    namespace={namespace}
                    podName={selectedPod.name}
                    containerName={selectedContainer}
                    volumes={selectedPod.volumes}
                  />
                </>
              ) : (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                  Select a pod and container to browse files
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="container mx-auto px-4 py-4 text-center text-sm">
          <p>KubeFileX - Kubernetes File Management Tool</p>
          <p className="text-gray-400 mt-1">
            Secure file operations with Kubernetes RBAC
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
