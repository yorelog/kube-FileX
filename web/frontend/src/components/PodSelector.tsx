import type { PodInfo } from '../types';

interface PodSelectorProps {
  pods: PodInfo[];
  selectedPod: PodInfo | null;
  selectedContainer: string;
  onPodSelect: (pod: PodInfo) => void;
  onContainerSelect: (container: string) => void;
}

export default function PodSelector({
  pods,
  selectedPod,
  selectedContainer,
  onPodSelect,
  onContainerSelect,
}: PodSelectorProps) {
  const handlePodClick = (pod: PodInfo) => {
    onPodSelect(pod);
    if (pod.containers.length > 0) {
      onContainerSelect(pod.containers[0]);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-800">Pods</h2>
        <p className="text-sm text-gray-500">{pods.length} pod(s)</p>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {pods.map((pod) => (
          <div
            key={pod.name}
            className={`p-3 border-b cursor-pointer transition-colors ${
              selectedPod?.name === pod.name
                ? 'bg-blue-50 border-l-4 border-l-blue-600'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => handlePodClick(pod)}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900 truncate">
                {pod.name}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  pod.status === 'Running'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {pod.status}
              </span>
            </div>
            {selectedPod?.name === pod.name && (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-gray-600 font-medium">
                  Containers:
                </div>
                {pod.containers.map((container) => (
                  <button
                    key={container}
                    onClick={(e) => {
                      e.stopPropagation();
                      onContainerSelect(container);
                    }}
                    className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                      selectedContainer === container
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {container}
                  </button>
                ))}
                {pod.volumes.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 font-medium mb-1">
                      Volumes:
                    </div>
                    {pod.volumes.map((vol) => (
                      <div
                        key={vol.name}
                        className="text-xs text-gray-600 px-2 py-1"
                      >
                        <div className="flex items-center gap-1">
                          {vol.isPv && (
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                          )}
                          <span className="font-medium">{vol.mountPath}</span>
                        </div>
                        <div className="text-gray-500">
                          {vol.type}
                          {vol.readOnly && ' (RO)'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
