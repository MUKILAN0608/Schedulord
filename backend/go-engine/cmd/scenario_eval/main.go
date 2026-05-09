package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"schedulord-go-engine/internal/prediction"
)

type scenario struct {
	Name         string
	ResourceType string
	Bumps        []float64
}

func main() {
	datasetPath, ok := resolveDatasetPath()
	if !ok {
		fmt.Println("ERROR: dataset not found (schedulord_research_dataset_12000.csv)")
		os.Exit(1)
	}

	scenarios := []scenario{
		{Name: "CPU steady baseline", ResourceType: "CPU", Bumps: []float64{0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8}},
		{Name: "CPU sharp increase", ResourceType: "CPU", Bumps: []float64{0.3, 0.4, 0.6, 0.8, 1.0, 1.0, 1.0}},
		{Name: "CPU gradual decline", ResourceType: "CPU", Bumps: []float64{1.0, 0.9, 0.8, 0.7, 0.55, 0.4, 0.3}},
		{Name: "CPU volatile spikes", ResourceType: "CPU", Bumps: []float64{0.2, 1.0, 0.25, 0.95, 0.3, 1.0, 0.35}},
		{Name: "GPU baseline medium", ResourceType: "GPU", Bumps: []float64{0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6}},
		{Name: "GPU surge sustained", ResourceType: "GPU", Bumps: []float64{0.4, 0.5, 0.7, 0.9, 1.0, 1.0, 1.0}},
		{Name: "GPU cooling down", ResourceType: "GPU", Bumps: []float64{0.95, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25}},
		{Name: "GPU low demand", ResourceType: "GPU", Bumps: []float64{0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2}},
		{Name: "TPU alias growth", ResourceType: "TPU", Bumps: []float64{0.25, 0.35, 0.5, 0.65, 0.85, 1.0, 1.0}},
		{Name: "TPU alias decline", ResourceType: "TPU", Bumps: []float64{1.0, 0.9, 0.75, 0.6, 0.45, 0.35, 0.25}},
		{Name: "All mixed stable", ResourceType: "all", Bumps: []float64{0.65, 0.7, 0.68, 0.7, 0.69, 0.7, 0.69}},
		{Name: "All growth", ResourceType: "all", Bumps: []float64{0.35, 0.45, 0.55, 0.7, 0.82, 0.95, 1.0}},
		{Name: "Compute alias stress", ResourceType: "Compute", Bumps: []float64{0.5, 0.7, 0.9, 1.0, 1.0, 1.0, 1.0}},
		{Name: "Compute alias recovery", ResourceType: "Compute", Bumps: []float64{1.0, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35}},
		{Name: "All oscillating pressure", ResourceType: "all", Bumps: []float64{0.3, 0.8, 0.35, 0.85, 0.4, 0.9, 0.45}},
	}

	fmt.Printf("DATASET=%s\n", datasetPath)
	fmt.Println("MODEL_EVALUATION=15_CASES")
	fmt.Println(strings.Repeat("-", 120))

	for i, sc := range scenarios {
		eng := prediction.New()
		if err := eng.WarmStartFromCSV(datasetPath); err != nil {
			fmt.Printf("CASE %02d | %s | ERROR loading dataset: %v\n", i+1, sc.Name, err)
			continue
		}
		for _, b := range sc.Bumps {
			eng.Bump(sc.ResourceType, b)
		}

		out := eng.Predict(sc.ResourceType)
		fmt.Printf(
			"CASE %02d | name=%s | type=%s | trained=%v | aiScore=%v | recScore=%v | trend=%v | spike=%v | recommendation=%v\n",
			i+1,
			sc.Name,
			sc.ResourceType,
			out["trained"],
			out["aiScore"],
			out["recommendationScore"],
			out["trend"],
			out["spikeProbability"],
			out["recommendation"],
		)
	}
}

func resolveDatasetPath() (string, bool) {
	candidates := []string{}
	if p := os.Getenv("AI_DATASET_PATH"); p != "" {
		candidates = append(candidates, p)
	}
	candidates = append(candidates,
		filepath.Join(".", "schedulord_research_dataset_12000.csv"),
		filepath.Join("..", "schedulord_research_dataset_12000.csv"),
		filepath.Join("..", "..", "schedulord_research_dataset_12000.csv"),
		filepath.Join("..", "..", "..", "schedulord_research_dataset_12000.csv"),
		filepath.Join("/src", "schedulord_research_dataset_12000.csv"),
	)
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
	}
	return "", false
}
