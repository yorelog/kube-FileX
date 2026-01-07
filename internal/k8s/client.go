package k8s

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/client-go/util/homedir"
)

// Client wraps Kubernetes client operations
type Client struct {
	clientset  *kubernetes.Clientset
	restConfig *rest.Config
}

// PodInfo contains information about a Pod
type PodInfo struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Status     string            `json:"status"`
	Containers []string          `json:"containers"`
	Volumes    []VolumeInfo      `json:"volumes"`
	Labels     map[string]string `json:"labels"`
}

// VolumeInfo contains information about Pod volumes
type VolumeInfo struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	MountPath string `json:"mountPath"`
	ReadOnly  bool   `json:"readOnly"`
	IsPV      bool   `json:"isPv"`
}

// FileInfo represents a file or directory
type FileInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	IsDir    bool   `json:"isDir"`
	Size     int64  `json:"size"`
	ModTime  string `json:"modTime"`
	IsPVPath bool   `json:"isPvPath"`
}

// NewClient creates a new Kubernetes client
func NewClient(kubeconfig string) (*Client, error) {
	var config *rest.Config
	var err error

	if kubeconfig == "" {
		// Try in-cluster config first
		config, err = rest.InClusterConfig()
		if err != nil {
			// Fall back to default kubeconfig location
			if home := homedir.HomeDir(); home != "" {
				kubeconfig = filepath.Join(home, ".kube", "config")
			}
		}
	}

	if config == nil {
		config, err = clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			return nil, fmt.Errorf("failed to build config: %v", err)
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %v", err)
	}

	return &Client{
		clientset:  clientset,
		restConfig: config,
	}, nil
}

// ListPods lists all pods in a namespace
func (c *Client) ListPods(ctx context.Context, namespace string) ([]PodInfo, error) {
	pods, err := c.clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %v", err)
	}

	var podInfos []PodInfo
	for _, pod := range pods.Items {
		podInfo := PodInfo{
			Name:      pod.Name,
			Namespace: pod.Namespace,
			Status:    string(pod.Status.Phase),
			Labels:    pod.Labels,
		}

		// Extract container names
		for _, container := range pod.Spec.Containers {
			podInfo.Containers = append(podInfo.Containers, container.Name)
		}

		// Extract volume information
		volumeMap := make(map[string]corev1.Volume)
		for _, vol := range pod.Spec.Volumes {
			volumeMap[vol.Name] = vol
		}

		for _, container := range pod.Spec.Containers {
			for _, mount := range container.VolumeMounts {
				vol, exists := volumeMap[mount.Name]
				if !exists {
					continue
				}

				volInfo := VolumeInfo{
					Name:      mount.Name,
					MountPath: mount.MountPath,
					ReadOnly:  mount.ReadOnly,
				}

				// Determine volume type and if it's a PV
				if vol.PersistentVolumeClaim != nil {
					volInfo.Type = "PersistentVolumeClaim"
					volInfo.IsPV = true
				} else if vol.ConfigMap != nil {
					volInfo.Type = "ConfigMap"
				} else if vol.Secret != nil {
					volInfo.Type = "Secret"
				} else if vol.EmptyDir != nil {
					volInfo.Type = "EmptyDir"
				} else if vol.HostPath != nil {
					volInfo.Type = "HostPath"
				} else {
					volInfo.Type = "Other"
				}

				podInfo.Volumes = append(podInfo.Volumes, volInfo)
			}
		}

		podInfos = append(podInfos, podInfo)
	}

	return podInfos, nil
}

// ListFiles lists files in a directory within a pod
func (c *Client) ListFiles(ctx context.Context, namespace, podName, containerName, path string) ([]FileInfo, error) {
	// Use ls -la command to list files with details
	cmd := []string{"ls", "-la", "--time-style=+%Y-%m-%d_%H:%M:%S", path}
	
	stdout, _, err := c.execCommand(ctx, namespace, podName, containerName, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to list files: %v", err)
	}

	return parseFileList(stdout, path), nil
}

// ReadFile reads a file from a pod
func (c *Client) ReadFile(ctx context.Context, namespace, podName, containerName, filePath string) ([]byte, error) {
	cmd := []string{"cat", filePath}
	
	stdout, _, err := c.execCommand(ctx, namespace, podName, containerName, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %v", err)
	}

	return stdout, nil
}

// WriteFile writes content to a file in a pod
func (c *Client) WriteFile(ctx context.Context, namespace, podName, containerName, filePath string, content []byte) error {
	// Create directory if needed
	dir := filepath.Dir(filePath)
	if dir != "." && dir != "/" {
		mkdirCmd := []string{"mkdir", "-p", dir}
		_, _, err := c.execCommand(ctx, namespace, podName, containerName, mkdirCmd)
		if err != nil {
			return fmt.Errorf("failed to create directory: %v", err)
		}
	}

	// Write file using tee command
	cmd := []string{"tee", filePath}
	
	_, _, err := c.execCommandWithStdin(ctx, namespace, podName, containerName, cmd, content)
	if err != nil {
		return fmt.Errorf("failed to write file: %v", err)
	}

	return nil
}

// SearchFilesByName searches for files by name pattern in a pod
func (c *Client) SearchFilesByName(ctx context.Context, namespace, podName, containerName, searchPath, pattern string) ([]string, error) {
	cmd := []string{"find", searchPath, "-name", pattern, "-type", "f"}
	
	stdout, _, err := c.execCommand(ctx, namespace, podName, containerName, cmd)
	if err != nil {
		return nil, fmt.Errorf("failed to search files: %v", err)
	}

	lines := strings.Split(string(stdout), "\n")
	var results []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			results = append(results, line)
		}
	}

	return results, nil
}

// SearchFilesByContent searches for files containing specific content
func (c *Client) SearchFilesByContent(ctx context.Context, namespace, podName, containerName, searchPath, content string) ([]string, error) {
	cmd := []string{"grep", "-r", "-l", content, searchPath}
	
	stdout, _, err := c.execCommand(ctx, namespace, podName, containerName, cmd)
	if err != nil {
		// grep returns non-zero exit code if no matches found, which is not an error for us
		if len(stdout) == 0 {
			return []string{}, nil
		}
	}

	lines := strings.Split(string(stdout), "\n")
	var results []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			results = append(results, line)
		}
	}

	return results, nil
}

// DeleteFile deletes a file from a pod
func (c *Client) DeleteFile(ctx context.Context, namespace, podName, containerName, filePath string) error {
	cmd := []string{"rm", "-f", filePath}
	
	_, _, err := c.execCommand(ctx, namespace, podName, containerName, cmd)
	if err != nil {
		return fmt.Errorf("failed to delete file: %v", err)
	}

	return nil
}

// CopyFile copies a file within a pod or to another location
func (c *Client) CopyFile(ctx context.Context, namespace, podName, containerName, srcPath, dstPath string) error {
	cmd := []string{"cp", "-r", srcPath, dstPath}
	
	_, _, err := c.execCommand(ctx, namespace, podName, containerName, cmd)
	if err != nil {
		return fmt.Errorf("failed to copy file: %v", err)
	}

	return nil
}

// execCommand executes a command in a pod container
func (c *Client) execCommand(ctx context.Context, namespace, podName, containerName string, cmd []string) ([]byte, []byte, error) {
	return c.execCommandWithStdin(ctx, namespace, podName, containerName, cmd, nil)
}

// execCommandWithStdin executes a command in a pod container with stdin
func (c *Client) execCommandWithStdin(ctx context.Context, namespace, podName, containerName string, cmd []string, stdin []byte) ([]byte, []byte, error) {
	req := c.clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	req.VersionedParams(&corev1.PodExecOptions{
		Container: containerName,
		Command:   cmd,
		Stdin:     stdin != nil,
		Stdout:    true,
		Stderr:    true,
		TTY:       false,
	}, scheme.ParameterCodec)

	exec, err := remotecommand.NewSPDYExecutor(c.restConfig, "POST", req.URL())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create executor: %v", err)
	}

	var stdout, stderr bytes.Buffer
	var stdinReader io.Reader
	if stdin != nil {
		stdinReader = bytes.NewReader(stdin)
	}

	err = exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stdinReader,
		Stdout: &stdout,
		Stderr: &stderr,
		Tty:    false,
	})

	return stdout.Bytes(), stderr.Bytes(), err
}

// parseFileList parses output from ls -la command
func parseFileList(output []byte, basePath string) []FileInfo {
	lines := strings.Split(string(output), "\n")
	var files []FileInfo

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "total") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 9 {
			continue
		}

		// Skip . and ..
		name := fields[8]
		if name == "." || name == ".." {
			continue
		}

		// Parse file info
		fileInfo := FileInfo{
			Name:  name,
			Path:  filepath.Join(basePath, name),
			IsDir: strings.HasPrefix(fields[0], "d"),
		}

		// Try to parse size
		if !fileInfo.IsDir && len(fields) > 4 {
			var size int64
			fmt.Sscanf(fields[4], "%d", &size)
			fileInfo.Size = size
		}

		// Parse modification time
		if len(fields) > 7 {
			fileInfo.ModTime = fields[5] + " " + fields[6]
		}

		files = append(files, fileInfo)
	}

	return files
}
