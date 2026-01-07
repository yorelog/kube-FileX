package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/yorelog/kube-FileX/internal/api"
	"github.com/yorelog/kube-FileX/internal/k8s"
)

func main() {
	port := flag.String("port", "8080", "Server port")
	kubeconfig := flag.String("kubeconfig", "", "Path to kubeconfig file (optional, uses in-cluster config if not specified)")
	flag.Parse()

	// Initialize Kubernetes client
	k8sClient, err := k8s.NewClient(*kubeconfig)
	if err != nil {
		log.Fatalf("Failed to create Kubernetes client: %v", err)
	}

	// Initialize API server
	server := api.NewServer(k8sClient)

	addr := ":" + *port
	log.Printf("Starting KubeFileX server on %s", addr)
	if err := http.ListenAndServe(addr, server); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
