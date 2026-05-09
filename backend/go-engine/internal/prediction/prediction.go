package prediction

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"schedulord-go-engine/internal/aisupport"
)

// Tunables for demand signal / spike UX (single place to refine sensitivity).
const (
	emaAlpha            = 0.17 // gentler smoothing than 0.2 → fewer jittery flips
	trendLookback       = 7    // slightly longer window → stabler velocity for labels
	spikeHistoryWindow  = 24   // balance responsiveness vs noise for spike math
	movementFloor       = 0.035
	baseRiskFloor       = 0.06 // modest baseline uncertainty once trained
	baseRiskDemandCoeff = 0.24 // demand-linked spike contribution (was ~0.35*demand, toned down)
	velocityRiskCoeff   = 0.52 // momentum multiplier after normalization
	velocityRiskCap     = 0.50 // avoid dominating purely from normalized velocity
	spikeRecommendCut   = 0.48 // slightly earlier “prioritize” vs old 0.55
	trendNormIncreasing = 0.28 // normalized velocity threshold → increasing
	trendNormDecreasing = -0.28
)

type Engine struct {
	mu      sync.Mutex
	signal  map[string]float64
	last    map[string]time.Time
	history map[string][]dataPoint
	ai      *aisupport.Pipeline
	profile map[string]resourceProfile
	rec     map[string]recommendationModel
}

type dataPoint struct {
	value float64
	at    time.Time
}

type resourceProfile struct {
	Priority           int
	Quantity           int
	UserRole           string
	QueueLength        int
	AvailableResources int
	TotalResources     int
	SystemLoad         float64
	HistoricalSuccess  float64
	Samples            int
}

type recommendationSample struct {
	priority   float64
	systemLoad float64
	available  float64
	queue      float64
	admin      float64
	success    float64
}

type recommendationModel struct {
	W            [5]float64
	Bias         float64
	MaxAvailable float64
	MaxQueue     float64
	Trained      bool
}

func canonicalResourceType(resourceType string) string {
	rt := strings.ToLower(strings.TrimSpace(resourceType))
	switch rt {
	case "":
		return ""
	case "compute", "cpu", "cpus", "general_compute", "general-compute":
		return "cpu"
	case "gpu", "gpus", "accelerated", "accelerator", "tpu", "tpus":
		return "gpu"
	default:
		return rt
	}
}

func New() *Engine {
	aiPipeline := aisupport.New()
	return &Engine{
		signal:  make(map[string]float64),
		last:    make(map[string]time.Time),
		history: make(map[string][]dataPoint),
		ai:      aiPipeline,
		profile: make(map[string]resourceProfile),
		rec:     make(map[string]recommendationModel),
	}
}

func (p *Engine) Bump(resourceType string, amount float64) {
	p.mu.Lock()
	defer p.mu.Unlock()

	rt := canonicalResourceType(resourceType)
	if rt == "" {
		return
	}

	prev := p.signal[rt]
	p.signal[rt] = emaAlpha*amount + (1.0-emaAlpha)*prev
	p.last[rt] = time.Now()

	p.history[rt] = append(p.history[rt], dataPoint{
		value: p.signal[rt],
		at:    time.Now(),
	})
	if len(p.history[rt]) > 100 {
		p.history[rt] = p.history[rt][1:]
	}
}

func (p *Engine) Predict(resourceType string) map[string]interface{} {
	p.mu.Lock()
	defer p.mu.Unlock()

	rt := canonicalResourceType(resourceType)
	if rt == "" {
		rt = "all"
	}

	history := p.history[rt]
	demand := p.signal[rt]
	lastUpdate := p.last[rt]

	trend := "stable"
	velocity := 0.0

	windowSpike := history
	if len(windowSpike) > spikeHistoryWindow {
		windowSpike = windowSpike[len(windowSpike)-spikeHistoryWindow:]
	}

	movementRange := movementFloor
	minV, maxV := 0.0, 0.0
	if len(windowSpike) >= 3 {
		minV, maxV = windowSpike[0].value, windowSpike[0].value
		for _, pt := range windowSpike {
			if pt.value < minV {
				minV = pt.value
			}
			if pt.value > maxV {
				maxV = pt.value
			}
		}
		movementRange = math.Max(movementFloor, maxV-minV)
	}

	if len(history) >= trendLookback {
		recent := history[len(history)-trendLookback:]
		first := recent[0].value
		last := recent[len(recent)-1].value
		velocity = last - first
		vNorm := velocity / movementRange
		switch {
		case vNorm > trendNormIncreasing:
			trend = "increasing"
		case vNorm < trendNormDecreasing:
			trend = "decreasing"
		}
	}

	spikeProbability := 0.0
	if len(history) >= trendLookback {
		velocityNorm := velocity / movementRange
		if velocityNorm < 0 {
			velocityNorm = 0
		}
		if velocityNorm > 3 {
			velocityNorm = 3
		}

		baseRisk := baseRiskFloor + demand*baseRiskDemandCoeff
		velocityRisk := math.Min(velocityRiskCap, velocityNorm*velocityRiskCoeff)
		raw := baseRisk + velocityRisk
		// Mild logistic squash → extremes soften slightly (finer UX on percentages).
		spikeProbability = 1 / (1 + math.Exp(-4*(raw-0.5)))
	}

	ready := len(history) >= trendLookback
	profile := p.profile[rt]
	modelOut, modelErr := p.aiOutput(rt, profile)

	recommendationScore, recTrained, recErr := p.recommendationScore(rt, profile)
	recommendation := modelOut.recommendation
	if recErr == nil {
		switch {
		case recommendationScore >= 0.68:
			recommendation = "Prioritize approval. Trained recommendation model predicts high allocation success."
		case recommendationScore <= 0.35:
			recommendation = "Hold or review allocation manually. Trained model predicts low near-term success."
		default:
			recommendation = "Moderate confidence. Approve selectively based on priority and current capacity."
		}
	}
	if recommendation == "" {
		recommendation = "Maintain current allocation policy and monitor incoming requests."
		if !ready {
			recommendation = "Training in progress for this resource type. Need at least " + strconv.Itoa(trendLookback) + " data points before trend/spike recommendations are reliable."
		} else if spikeProbability >= spikeRecommendCut || trend == "increasing" {
			recommendation = "Prioritize approval and increase buffer capacity to prepare for likely demand spike."
		} else if trend == "decreasing" {
			recommendation = "Demand is easing. Keep approvals selective and optimize for efficiency."
		}
	}

	validationErr := validatePredictionOutput(demand, spikeProbability, modelOut)
	if validationErr != nil {
		log.Printf("prediction validation warning resourceType=%s canonicalType=%s err=%v", resourceType, rt, validationErr)
	}
	if modelErr != nil {
		log.Printf("prediction model error resourceType=%s canonicalType=%s err=%v", resourceType, rt, modelErr)
	}

	respError := buildPredictionError(modelErr, validationErr)
	trained := ready && modelOut.modelReady && modelErr == nil && validationErr == nil

	resp := map[string]interface{}{
		"resourceType":          resourceType,
		"canonicalType":         rt,
		"demandSignal":          demand,
		"trend":                 trend,
		"velocity":              velocity,
		"spikeProbability":      spikeProbability,
		"dataPoints":            len(history),
		"lastUpdated":           lastUpdate,
		"method":                "ema-with-trained-ai",
		"trained":               trained,
		"recommendation":        recommendation,
		"recommendationTrained": recTrained,
		"decisionLog":           modelOut.decisionLog,
	}

	if modelErr == nil && validationErr == nil {
		aiScore := 0.4*modelOut.feasibilityScore + 0.4*modelOut.priorityScore + 0.2*(1.0-modelOut.predictedLoad)
		resp["feasibilityScore"] = modelOut.feasibilityScore
		resp["predictedLoad"] = modelOut.predictedLoad
		resp["priorityScore"] = modelOut.priorityScore
		resp["aiScore"] = clamp01(aiScore)
		if recErr == nil {
			resp["recommendationScore"] = recommendationScore
		} else {
			resp["recommendationScore"] = nil
		}
	} else {
		// Do not emit fake numeric zeros when model output is invalid/unavailable.
		resp["feasibilityScore"] = nil
		resp["predictedLoad"] = nil
		resp["priorityScore"] = nil
		resp["aiScore"] = nil
		resp["recommendationScore"] = nil
	}
	if respError != nil {
		resp["error"] = respError
	}
	return resp
}

// WarmStartFromCSV seeds per-resource demand signals from historical dataset rows.
// It does not fallback across resource types; each type is trained independently.
func (p *Engine) WarmStartFromCSV(datasetPath string) error {
	f, err := os.Open(datasetPath)
	if err != nil {
		return err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err != nil {
		return err
	}

	index := map[string]int{}
	for i, col := range header {
		index[strings.TrimSpace(col)] = i
	}

	rtIdx, ok := index["resource_type"]
	if !ok {
		return errors.New("dataset missing resource_type column")
	}
	successIdx, ok := index["success"]
	if !ok {
		return errors.New("dataset missing success column")
	}

	samplesByType := map[string][]recommendationSample{
		"all": {},
		"cpu": {},
		"gpu": {},
	}

	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue
		}
		if rtIdx >= len(row) || successIdx >= len(row) {
			continue
		}

		rt := canonicalResourceType(row[rtIdx])
		if rt == "" {
			continue
		}
		success, parseErr := strconv.ParseFloat(strings.TrimSpace(row[successIdx]), 64)
		if parseErr != nil {
			continue
		}

		amount := 0.2
		if success >= 0.5 {
			amount = 1.0
		}
		p.Bump(rt, amount)
		// Keep "all" warm history/profile seeded from the same dataset so
		// /predict?resourceType=all can return trained outputs immediately.
		p.Bump("all", amount)
		p.updateProfileFromDatasetRow(index, row, rt, success)
		p.updateProfileFromDatasetRow(index, row, "all", success)

		recSample := recommendationSample{
			priority:   float64(parsePriorityValue(index, row)) / 100.0,
			systemLoad: parsePercentValue(index, row, "system_load"),
			available:  float64(parseIntValue(index, row, "available_resources", 0)),
			queue:      float64(parseIntValue(index, row, "queue_length", 0)),
			admin: func() float64 {
				if parseStringValue(index, row, "user_role") == "admin" {
					return 1.0
				}
				return 0.0
			}(),
			success: clamp01(success),
		}
		samplesByType[rt] = append(samplesByType[rt], recSample)
		samplesByType["all"] = append(samplesByType["all"], recSample)
	}

	for rt, samples := range samplesByType {
		p.rec[rt] = trainRecommendationModel(samples)
	}

	return nil
}

func trainRecommendationModel(samples []recommendationSample) recommendationModel {
	if len(samples) < 100 {
		return recommendationModel{Trained: false}
	}

	maxAvail := 1.0
	maxQueue := 1.0
	for _, s := range samples {
		if s.available > maxAvail {
			maxAvail = s.available
		}
		if s.queue > maxQueue {
			maxQueue = s.queue
		}
	}

	model := recommendationModel{
		MaxAvailable: maxAvail,
		MaxQueue:     maxQueue,
		Trained:      true,
	}

	lr := 0.08
	epochs := 140
	for ep := 0; ep < epochs; ep++ {
		for _, s := range samples {
			x := [5]float64{
				clamp01(s.priority),
				clamp01(s.systemLoad),
				clamp01(s.available / maxAvail),
				clamp01(s.queue / maxQueue),
				clamp01(s.admin),
			}
			z := model.Bias
			for i := 0; i < len(model.W); i++ {
				z += model.W[i] * x[i]
			}
			pred := 1.0 / (1.0 + math.Exp(-z))
			grad := pred - clamp01(s.success)
			for i := 0; i < len(model.W); i++ {
				model.W[i] -= lr * grad * x[i]
			}
			model.Bias -= lr * grad
		}
	}
	return model
}

func (p *Engine) recommendationScore(rt string, profile resourceProfile) (float64, bool, error) {
	m, ok := p.rec[rt]
	if !ok || !m.Trained {
		return 0, false, errors.New("recommendation model not trained for resource type")
	}
	if profile.Samples == 0 {
		return 0, false, errors.New("insufficient profile for recommendation score")
	}
	role := 0.0
	if profile.UserRole == "admin" {
		role = 1.0
	}
	x := [5]float64{
		clamp01(float64(profile.Priority/profile.Samples) / 100.0),
		clamp01(profile.SystemLoad / float64(profile.Samples)),
		clamp01(float64(profile.AvailableResources/profile.Samples) / m.MaxAvailable),
		clamp01(float64(profile.QueueLength/profile.Samples) / m.MaxQueue),
		role,
	}
	z := m.Bias
	for i := 0; i < len(m.W); i++ {
		z += m.W[i] * x[i]
	}
	return clamp01(1.0 / (1.0 + math.Exp(-z))), true, nil
}

type aiPrediction struct {
	feasibilityScore float64
	predictedLoad    float64
	priorityScore    float64
	decisionLog      []string
	recommendation   string
	modelReady       bool
}

func (p *Engine) aiOutput(rt string, profile resourceProfile) (aiPrediction, error) {
	if p.ai == nil {
		return aiPrediction{}, errors.New("trained ai pipeline unavailable")
	}
	if rt == "all" {
		return p.aiOutputForAll()
	}

	input, err := profile.toAIInput(rt)
	if err != nil {
		return aiPrediction{}, err
	}
	out := p.ai.Evaluate(input)
	return aiPrediction{
		feasibilityScore: out.FeasibilityScore,
		predictedLoad:    out.PredictedLoad,
		priorityScore:    out.PriorityScore,
		decisionLog:      out.DecisionLog,
		recommendation:   recommendationFromAI(out),
		modelReady:       profile.Samples > 0,
	}, nil
}

func (p *Engine) aiOutputForAll() (aiPrediction, error) {
	cpuProfile := p.profile["cpu"]
	gpuProfile := p.profile["gpu"]
	totalSamples := cpuProfile.Samples + gpuProfile.Samples
	if totalSamples == 0 {
		// Fallback to aggregated profile if type-specific split is unavailable.
		totalProfile := p.profile["all"]
		if totalProfile.Samples == 0 {
			return aiPrediction{}, errors.New("insufficient dataset profile samples")
		}
		input, err := totalProfile.toAIInput("cpu")
		if err != nil {
			return aiPrediction{}, err
		}
		out := p.ai.Evaluate(input)
		return aiPrediction{
			feasibilityScore: out.FeasibilityScore,
			predictedLoad:    out.PredictedLoad,
			priorityScore:    out.PriorityScore,
			decisionLog:      append(out.DecisionLog, "aggregate_profile_fallback=true"),
			recommendation:   recommendationFromAI(out),
			modelReady:       true,
		}, nil
	}

	acc := aiPrediction{}
	var mergedLogs []string
	if cpuProfile.Samples > 0 {
		cpuWeight := float64(cpuProfile.Samples) / float64(totalSamples)
		cpuInput, err := cpuProfile.toAIInput("cpu")
		if err != nil {
			return aiPrediction{}, err
		}
		cpuOut := p.ai.Evaluate(cpuInput)
		acc.feasibilityScore += cpuOut.FeasibilityScore * cpuWeight
		acc.predictedLoad += cpuOut.PredictedLoad * cpuWeight
		acc.priorityScore += cpuOut.PriorityScore * cpuWeight
		mergedLogs = append(mergedLogs, cpuOut.DecisionLog...)
	}
	if gpuProfile.Samples > 0 {
		gpuWeight := float64(gpuProfile.Samples) / float64(totalSamples)
		gpuInput, err := gpuProfile.toAIInput("gpu")
		if err != nil {
			return aiPrediction{}, err
		}
		gpuOut := p.ai.Evaluate(gpuInput)
		acc.feasibilityScore += gpuOut.FeasibilityScore * gpuWeight
		acc.predictedLoad += gpuOut.PredictedLoad * gpuWeight
		acc.priorityScore += gpuOut.PriorityScore * gpuWeight
		mergedLogs = append(mergedLogs, gpuOut.DecisionLog...)
	}

	out := aisupport.Output{
		FeasibilityScore: acc.feasibilityScore,
		PredictedLoad:    acc.predictedLoad,
		PriorityScore:    acc.priorityScore,
		DecisionLog:      append(mergedLogs, "aggregate_mode=weighted_cpu_gpu"),
	}
	return aiPrediction{
		feasibilityScore: out.FeasibilityScore,
		predictedLoad:    out.PredictedLoad,
		priorityScore:    out.PriorityScore,
		decisionLog:      out.DecisionLog,
		recommendation:   recommendationFromAI(out),
		modelReady:       true,
	}, nil
}

func recommendationFromAI(out aisupport.Output) string {
	if out.FeasibilityScore < 0.35 {
		return "Low feasibility predicted. Delay approval or rebalance capacity before accepting new requests."
	}
	if out.PredictedLoad > 0.75 || out.PriorityScore > 0.75 {
		return "Prioritize approval and scale ready resources. Model predicts high near-term pressure."
	}
	if out.PredictedLoad < 0.35 && out.FeasibilityScore > 0.65 {
		return "Capacity is healthy. Approve normally and optimize for throughput."
	}
	return "Maintain current allocation policy and monitor incoming requests."
}

func validatePredictionOutput(demandSignal, spikeProbability float64, modelOut aiPrediction) error {
	if math.IsNaN(demandSignal) || math.IsInf(demandSignal, 0) {
		return errors.New("invalid demand signal")
	}
	if math.IsNaN(spikeProbability) || math.IsInf(spikeProbability, 0) || spikeProbability < 0 || spikeProbability > 1 {
		return errors.New("invalid spike probability")
	}
	check := []struct {
		name  string
		value float64
	}{
		{name: "feasibility_score", value: modelOut.feasibilityScore},
		{name: "predicted_load", value: modelOut.predictedLoad},
		{name: "priority_score", value: modelOut.priorityScore},
	}
	for _, item := range check {
		if math.IsNaN(item.value) || math.IsInf(item.value, 0) || item.value < 0 || item.value > 1 {
			return fmt.Errorf("invalid %s", item.name)
		}
	}
	return nil
}

func buildPredictionError(modelErr, validationErr error) map[string]interface{} {
	if modelErr == nil && validationErr == nil {
		return nil
	}
	if validationErr != nil {
		return map[string]interface{}{
			"code":    "PREDICTION_OUTPUT_INVALID",
			"message": "Prediction output contained invalid values and may be unreliable.",
			"details": validationErr.Error(),
		}
	}
	return map[string]interface{}{
		"code":    "PREDICTION_MODEL_ERROR",
		"message": "Prediction model failed to generate fully trained output.",
		"details": modelErr.Error(),
	}
}

func (p *Engine) updateProfileFromDatasetRow(index map[string]int, row []string, rt string, success float64) {
	if rt == "" {
		return
	}

	profile := p.profile[rt]
	profile.Samples++
	profile.Quantity += parseIntValue(index, row, "quantity", 1)
	profile.Priority += parsePriorityValue(index, row)
	profile.QueueLength += parseIntValue(index, row, "queue_length", 0)

	avail := parseIntValue(index, row, "available_resources", 0)
	profile.AvailableResources += avail
	if avail > 0 {
		profile.TotalResources += avail
	}

	profile.SystemLoad += parsePercentValue(index, row, "system_load")
	profile.HistoricalSuccess += success

	if profile.UserRole == "" {
		role := parseStringValue(index, row, "user_role")
		if role == "admin" || role == "user" {
			profile.UserRole = role
		}
	}
	p.profile[rt] = profile
}

func (rp resourceProfile) toAIInput(rt string) (aisupport.Input, error) {
	if rp.Samples == 0 {
		return aisupport.Input{}, errors.New("insufficient dataset profile samples")
	}
	role := rp.UserRole
	if role == "" {
		role = "user"
	}
	totalResources := rp.TotalResources / rp.Samples
	availableResources := rp.AvailableResources / rp.Samples
	if totalResources < availableResources {
		totalResources = availableResources
	}
	if totalResources <= 0 {
		totalResources = 1
	}

	inputType := strings.ToUpper(rt)
	if inputType != "CPU" && inputType != "GPU" {
		return aisupport.Input{}, fmt.Errorf("unsupported resource type: %s", rt)
	}

	return aisupport.Input{
		ResourceType:       inputType,
		Priority:           maxInt(1, rp.Priority/rp.Samples),
		Quantity:           maxInt(1, rp.Quantity/rp.Samples),
		UserRole:           role,
		RequestTimestamp:   time.Now().UTC(),
		QueueLength:        maxInt(0, rp.QueueLength/rp.Samples),
		AvailableResources: availableResources,
		TotalResources:     totalResources,
		SystemLoad:         clamp01(rp.SystemLoad / float64(rp.Samples)),
		HistoricalSuccess:  clamp01(rp.HistoricalSuccess / float64(rp.Samples)),
	}, nil
}

func parseIntValue(index map[string]int, row []string, key string, fallback int) int {
	i, ok := index[key]
	if !ok || i >= len(row) {
		return fallback
	}
	raw := strings.TrimSpace(row[i])
	if raw == "" {
		return fallback
	}
	f, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return fallback
	}
	return int(math.Round(f))
}

func parsePercentValue(index map[string]int, row []string, key string) float64 {
	i, ok := index[key]
	if !ok || i >= len(row) {
		return 0
	}
	v, err := strconv.ParseFloat(strings.TrimSpace(row[i]), 64)
	if err != nil {
		return 0
	}
	if v > 1 {
		v = v / 100.0
	}
	return clamp01(v)
}

func parsePriorityValue(index map[string]int, row []string) int {
	i, ok := index["priority"]
	if !ok || i >= len(row) {
		return 50
	}
	switch strings.TrimSpace(row[i]) {
	case "High":
		return 90
	case "Medium":
		return 50
	case "Low":
		return 20
	default:
		return 50
	}
}

func parseStringValue(index map[string]int, row []string, key string) string {
	i, ok := index[key]
	if !ok || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(strings.ToLower(row[i]))
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
