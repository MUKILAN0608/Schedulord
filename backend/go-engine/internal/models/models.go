package models

type Resource struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Capacity    int    `json:"capacity"`
	IsAvailable bool   `json:"isAvailable"`
}

type Request struct {
	ID           string `json:"id"`
	ResourceType string `json:"resourceType"`
	Quantity     int    `json:"quantity"`
	Priority     int    `json:"priority"`
	UserRole     string `json:"userRole,omitempty"`
	Timestamp    string `json:"timestamp,omitempty"`
	QueueLength  int    `json:"queueLength,omitempty"`
}

type ProcessPayload struct {
	Request   Request    `json:"request"`
	Resources []Resource `json:"resources"`
}

type Allocation struct {
	ResourceID   string                 `json:"resourceId"`
	Score        float64                `json:"score"`
	Confidence   float64                `json:"confidence"`
	Strategy     string                 `json:"strategy"`
	Reason       string                 `json:"reason,omitempty"`
	Alternatives []AlternativeAlloc     `json:"alternatives,omitempty"`
	Details      map[string]interface{} `json:"details,omitempty"`
}

type AlternativeAlloc struct {
	ResourceID string  `json:"resourceId"`
	Score      float64 `json:"score"`
	Strategy   string  `json:"strategy"`
}

type ProcessResult struct {
	Allocation Allocation             `json:"allocation"`
	Simulation map[string]interface{} `json:"simulation,omitempty"`
	Prediction map[string]interface{} `json:"prediction,omitempty"`
}
