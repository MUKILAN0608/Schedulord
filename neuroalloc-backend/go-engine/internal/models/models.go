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
}

type ProcessPayload struct {
	Request   Request    `json:"request"`
	Resources []Resource `json:"resources"`
}

type Allocation struct {
	ResourceID string                 `json:"resourceId"`
	Score      float64                `json:"score"`
	Reason     string                 `json:"reason,omitempty"`
	Details    map[string]interface{} `json:"details,omitempty"`
}

type ProcessResult struct {
	Allocation Allocation `json:"allocation"`
}

