package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path/filepath"

	"github.com/yorelog/kube-FileX/internal/k8s"
)

// Server represents the API server
type Server struct {
	k8sClient *k8s.Client
	mux       *http.ServeMux
}

// NewServer creates a new API server
func NewServer(k8sClient *k8s.Client) *Server {
	s := &Server{
		k8sClient: k8sClient,
		mux:       http.NewServeMux(),
	}

	s.setupRoutes()
	return s
}

// ServeHTTP implements http.Handler interface
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for development
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	s.mux.ServeHTTP(w, r)
}

// setupRoutes configures API routes
func (s *Server) setupRoutes() {
	// Pod operations
	s.mux.HandleFunc("/api/pods", s.handleListPods)
	
	// File operations
	s.mux.HandleFunc("/api/files/list", s.handleListFiles)
	s.mux.HandleFunc("/api/files/read", s.handleReadFile)
	s.mux.HandleFunc("/api/files/write", s.handleWriteFile)
	s.mux.HandleFunc("/api/files/delete", s.handleDeleteFile)
	s.mux.HandleFunc("/api/files/copy", s.handleCopyFile)
	
	// Search operations
	s.mux.HandleFunc("/api/search/name", s.handleSearchByName)
	s.mux.HandleFunc("/api/search/content", s.handleSearchByContent)
	
	// Serve frontend static files
	s.mux.HandleFunc("/", s.handleStatic)
}

// handleListPods lists pods in a namespace
func (s *Server) handleListPods(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	if namespace == "" {
		namespace = "default"
	}

	pods, err := s.k8sClient.ListPods(r.Context(), namespace)
	if err != nil {
		respondError(w, fmt.Errorf("failed to list pods: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, pods)
}

// handleListFiles lists files in a pod directory
func (s *Server) handleListFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")
	path := r.URL.Query().Get("path")

	if namespace == "" || podName == "" || container == "" {
		respondError(w, fmt.Errorf("namespace, pod, and container are required"), http.StatusBadRequest)
		return
	}

	if path == "" {
		path = "/"
	}

	files, err := s.k8sClient.ListFiles(r.Context(), namespace, podName, container, path)
	if err != nil {
		respondError(w, fmt.Errorf("failed to list files: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, files)
}

// handleReadFile reads a file from a pod
func (s *Server) handleReadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")
	filePath := r.URL.Query().Get("path")

	if namespace == "" || podName == "" || container == "" || filePath == "" {
		respondError(w, fmt.Errorf("namespace, pod, container, and path are required"), http.StatusBadRequest)
		return
	}

	content, err := s.k8sClient.ReadFile(r.Context(), namespace, podName, container, filePath)
	if err != nil {
		respondError(w, fmt.Errorf("failed to read file: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filepath.Base(filePath)))
	w.Write(content)
}

// handleWriteFile writes content to a file in a pod
func (s *Server) handleWriteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")
	filePath := r.URL.Query().Get("path")

	if namespace == "" || podName == "" || container == "" || filePath == "" {
		respondError(w, fmt.Errorf("namespace, pod, container, and path are required"), http.StatusBadRequest)
		return
	}

	content, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, fmt.Errorf("failed to read request body: %v", err), http.StatusBadRequest)
		return
	}

	err = s.k8sClient.WriteFile(r.Context(), namespace, podName, container, filePath, content)
	if err != nil {
		respondError(w, fmt.Errorf("failed to write file: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"status": "success"})
}

// handleDeleteFile deletes a file from a pod
func (s *Server) handleDeleteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")
	filePath := r.URL.Query().Get("path")

	if namespace == "" || podName == "" || container == "" || filePath == "" {
		respondError(w, fmt.Errorf("namespace, pod, container, and path are required"), http.StatusBadRequest)
		return
	}

	err := s.k8sClient.DeleteFile(r.Context(), namespace, podName, container, filePath)
	if err != nil {
		respondError(w, fmt.Errorf("failed to delete file: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, map[string]string{"status": "success"})
}

// handleCopyFile copies a file within or between pods
func (s *Server) handleCopyFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		SrcNamespace  string `json:"srcNamespace"`
		SrcPod        string `json:"srcPod"`
		SrcContainer  string `json:"srcContainer"`
		SrcPath       string `json:"srcPath"`
		DstNamespace  string `json:"dstNamespace"`
		DstPod        string `json:"dstPod"`
		DstContainer  string `json:"dstContainer"`
		DstPath       string `json:"dstPath"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, fmt.Errorf("invalid request body: %v", err), http.StatusBadRequest)
		return
	}

	// If copying to the same pod, use cp command
	if req.SrcNamespace == req.DstNamespace && req.SrcPod == req.DstPod && req.SrcContainer == req.DstContainer {
		err := s.k8sClient.CopyFile(r.Context(), req.SrcNamespace, req.SrcPod, req.SrcContainer, req.SrcPath, req.DstPath)
		if err != nil {
			respondError(w, fmt.Errorf("failed to copy file: %v", err), http.StatusInternalServerError)
			return
		}
	} else {
		// If copying between pods, read from source and write to destination
		content, err := s.k8sClient.ReadFile(r.Context(), req.SrcNamespace, req.SrcPod, req.SrcContainer, req.SrcPath)
		if err != nil {
			respondError(w, fmt.Errorf("failed to read source file: %v", err), http.StatusInternalServerError)
			return
		}

		err = s.k8sClient.WriteFile(r.Context(), req.DstNamespace, req.DstPod, req.DstContainer, req.DstPath, content)
		if err != nil {
			respondError(w, fmt.Errorf("failed to write destination file: %v", err), http.StatusInternalServerError)
			return
		}
	}

	respondJSON(w, map[string]string{"status": "success"})
}

// handleSearchByName searches files by name pattern
func (s *Server) handleSearchByName(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")
	searchPath := r.URL.Query().Get("searchPath")
	pattern := r.URL.Query().Get("pattern")

	if namespace == "" || podName == "" || container == "" || pattern == "" {
		respondError(w, fmt.Errorf("namespace, pod, container, and pattern are required"), http.StatusBadRequest)
		return
	}

	if searchPath == "" {
		searchPath = "/"
	}

	results, err := s.k8sClient.SearchFilesByName(r.Context(), namespace, podName, container, searchPath, pattern)
	if err != nil {
		respondError(w, fmt.Errorf("failed to search files: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, results)
}

// handleSearchByContent searches files by content
func (s *Server) handleSearchByContent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	namespace := r.URL.Query().Get("namespace")
	podName := r.URL.Query().Get("pod")
	container := r.URL.Query().Get("container")
	searchPath := r.URL.Query().Get("searchPath")
	content := r.URL.Query().Get("content")

	if namespace == "" || podName == "" || container == "" || content == "" {
		respondError(w, fmt.Errorf("namespace, pod, container, and content are required"), http.StatusBadRequest)
		return
	}

	if searchPath == "" {
		searchPath = "/"
	}

	results, err := s.k8sClient.SearchFilesByContent(r.Context(), namespace, podName, container, searchPath, content)
	if err != nil {
		respondError(w, fmt.Errorf("failed to search files: %v", err), http.StatusInternalServerError)
		return
	}

	respondJSON(w, results)
}

// handleStatic serves static frontend files
func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	// For now, return a simple HTML page
	// In production, this would serve the built React app
	html := `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KubeFileX</title>
</head>
<body>
    <h1>KubeFileX</h1>
    <p>API server is running. Frontend coming soon.</p>
    <p>API endpoints:</p>
    <ul>
        <li>GET /api/pods?namespace=default</li>
        <li>GET /api/files/list?namespace=default&pod=podname&container=containername&path=/</li>
        <li>GET /api/files/read?namespace=default&pod=podname&container=containername&path=/path/to/file</li>
        <li>POST /api/files/write?namespace=default&pod=podname&container=containername&path=/path/to/file</li>
        <li>DELETE /api/files/delete?namespace=default&pod=podname&container=containername&path=/path/to/file</li>
        <li>POST /api/files/copy (with JSON body)</li>
        <li>GET /api/search/name?namespace=default&pod=podname&container=containername&pattern=*.log</li>
        <li>GET /api/search/content?namespace=default&pod=podname&container=containername&content=error</li>
    </ul>
</body>
</html>`
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

// respondJSON sends a JSON response
func respondJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// respondError sends an error response
func respondError(w http.ResponseWriter, err error, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error": err.Error(),
	})
}
