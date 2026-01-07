import { useState } from 'react';
import { api } from '../api';

interface SearchBarProps {
  namespace: string;
  podName: string;
  containerName: string;
}

export default function SearchBar({
  namespace,
  podName,
  containerName,
}: SearchBarProps) {
  const [searchType, setSearchType] = useState<'name' | 'content'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPath, setSearchPath] = useState('/');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    setLoading(true);
    setError('');
    setShowResults(true);
    try {
      let data: string[];
      if (searchType === 'name') {
        data = await api.searchByName(
          namespace,
          podName,
          containerName,
          searchPath,
          searchQuery
        );
      } else {
        data = await api.searchByContent(
          namespace,
          podName,
          containerName,
          searchPath,
          searchQuery
        );
      }
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setSearchType('name')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              searchType === 'name'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            By Name
          </button>
          <button
            onClick={() => setSearchType('content')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              searchType === 'content'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            By Content
          </button>
        </div>
        <input
          type="text"
          value={searchPath}
          onChange={(e) => setSearchPath(e.target.value)}
          placeholder="Search path"
          className="px-3 py-1 border rounded text-sm w-32"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={
            searchType === 'name' ? 'e.g., *.log' : 'Search text...'
          }
          className="flex-1 px-3 py-1 border rounded text-sm"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        {showResults && (
          <button
            onClick={() => setShowResults(false)}
            className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {showResults && (
        <div className="mt-3 border-t pt-3">
          {error && (
            <div className="text-red-600 text-sm mb-2">{error}</div>
          )}
          {loading ? (
            <div className="text-gray-500 text-sm">Searching...</div>
          ) : (
            <>
              <div className="text-sm text-gray-600 mb-2">
                Found {results.length} result(s)
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="text-sm font-mono bg-gray-50 px-2 py-1 rounded"
                  >
                    {result}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
