package aisupport

import (
	"encoding/csv"
	"errors"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"time"

	"gorgonia.org/gorgonia"
	"gorgonia.org/tensor"
)

const datasetFilename = "schedulord_research_dataset_12000.csv"

type DatasetSample struct {
	X                 [6]float64
	FeasibilityTarget float64
	LoadTarget        float64
	PriorityTarget    float64
}

// TrainedLogisticFeasibility is logistic regression in scaled feature space.
type TrainedLogisticFeasibility struct {
	Scaler FeatureScaler
	W      [6]float64
	Bias   float64
}

func (m *TrainedLogisticFeasibility) Predict(in Input) float64 {
	x, err := m.Scaler.scaleFeatures(in)
	if err != nil {
		return 0.5
	}
	z := m.Bias
	for i := 0; i < 6; i++ {
		z += m.W[i] * x[i]
	}
	return clamp01(sigmoid(z))
}

type FeatureScaler struct {
	MaxAvailableResources float64
	MaxQueueLength        float64
}

func (s *FeatureScaler) scaleFeatures(in Input) ([6]float64, error) {
	if in.ResourceType != "GPU" && in.ResourceType != "CPU" {
		return [6]float64{}, errors.New("unknown resource type")
	}

	// Priority mapping: match dataset priority categories.
	var priorityCode float64
	switch {
	case in.Priority < 34:
		priorityCode = 0.1 // Low
	case in.Priority < 67:
		priorityCode = 0.5 // Medium
	default:
		priorityCode = 0.9 // High
	}

	gpu := 0.0
	if in.ResourceType == "GPU" {
		gpu = 1.0
	}

	availNorm := 0.0
	if s.MaxAvailableResources > 0 {
		availNorm = float64(in.AvailableResources) / s.MaxAvailableResources
	}

	queueNorm := 0.0
	if s.MaxQueueLength > 0 {
		queueNorm = float64(in.QueueLength) / s.MaxQueueLength
	}

	admin := 0.0
	if in.UserRole == "admin" {
		admin = 1.0
	}

	// in.SystemLoad is already 0..1.
	return [6]float64{
		gpu,
		priorityCode,
		in.SystemLoad,
		availNorm,
		queueNorm,
		admin,
	}, nil
}

func resolveDatasetPath() (string, bool) {
	candidates := []string{}

	if p := os.Getenv("AI_DATASET_PATH"); p != "" {
		candidates = append(candidates, p)
	}

	// Common local relative locations.
	candidates = append(candidates,
		filepath.Join(".", datasetFilename),
		filepath.Join("..", datasetFilename),
		filepath.Join("..", "..", datasetFilename),
		filepath.Join("/src", datasetFilename),
	)

	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p, true
		}
	}
	return "", false
}

func parsePriorityCode(s string) (float64, error) {
	switch s {
	case "Low":
		return 0.1, nil
	case "Medium":
		return 0.5, nil
	case "High":
		return 0.9, nil
	default:
		return 0, errors.New("unknown priority code: " + s)
	}
}

func parseResourceTypeGPU(s string) (float64, error) {
	switch s {
	case "GPU":
		return 1.0, nil
	case "CPU":
		return 0.0, nil
	default:
		return 0, errors.New("unknown resource type: " + s)
	}
}

func parseUserRoleAdmin(s string) (float64, error) {
	switch s {
	case "admin":
		return 1.0, nil
	case "user":
		return 0.0, nil
	default:
		return 0, errors.New("unknown user role: " + s)
	}
}

func loadDataset(datasetPath string) ([]DatasetSample, FeatureScaler, error) {
	f, err := os.Open(datasetPath)
	if err != nil {
		return nil, FeatureScaler{}, err
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.FieldsPerRecord = -1

	header, err := r.Read()
	if err != nil {
		return nil, FeatureScaler{}, err
	}

	idx := map[string]int{}
	for i, h := range header {
		idx[h] = i
	}

	required := []string{
		"resource_type",
		"priority",
		"system_load",
		"available_resources",
		"queue_length",
		"user_role",
		"success",
		"predicted_load",
	}
	for _, k := range required {
		if _, ok := idx[k]; !ok {
			return nil, FeatureScaler{}, errors.New("dataset missing column: " + k)
		}
	}

	var samples []DatasetSample
	var maxAvail float64
	var maxQueue float64

	for {
		row, err := r.Read()
		if err != nil {
			break
		}

		gpu, err := parseResourceTypeGPU(row[idx["resource_type"]])
		if err != nil {
			continue
		}

		pri, err := parsePriorityCode(row[idx["priority"]])
		if err != nil {
			continue
		}

		systemLoadPct, err := strconv.ParseFloat(row[idx["system_load"]], 64)
		if err != nil {
			continue
		}
		systemLoad := systemLoadPct / 100.0

		avail, err := strconv.ParseFloat(row[idx["available_resources"]], 64)
		if err != nil {
			continue
		}

		queueLen, err := strconv.ParseFloat(row[idx["queue_length"]], 64)
		if err != nil {
			continue
		}

		admin, err := parseUserRoleAdmin(row[idx["user_role"]])
		if err != nil {
			continue
		}

		success, err := strconv.ParseFloat(row[idx["success"]], 64)
		if err != nil {
			continue
		}
		predictedLoad, err := strconv.ParseFloat(row[idx["predicted_load"]], 64)
		if err != nil {
			continue
		}

		if avail > maxAvail {
			maxAvail = avail
		}
		if queueLen > maxQueue {
			maxQueue = queueLen
		}

		// y vectors:
		// - feasibility: success probability
		// - load: predicted_load normalized to 0..1
		// - priority: use success as proxy for now (ranking quality proxy)
		samples = append(samples, DatasetSample{
			X: [6]float64{
				gpu,
				pri,
				systemLoad,
				avail,    // keep raw for scaling later
				queueLen, // keep raw for scaling later
				admin,
			},
			FeasibilityTarget: success,
			PriorityTarget:    success,
			LoadTarget:        predictedLoad / 100.0,
		})
	}

	// Second pass: scale raw feature slots 3 and 4 with discovered maxima.
	scaler := FeatureScaler{
		MaxAvailableResources: maxAvail,
		MaxQueueLength:        maxQueue,
	}

	for i := range samples {
		s := &samples[i]
		if scaler.MaxAvailableResources > 0 {
			s.X[3] = s.X[3] / scaler.MaxAvailableResources
		}
		if scaler.MaxQueueLength > 0 {
			s.X[4] = s.X[4] / scaler.MaxQueueLength
		}
	}

	return samples, scaler, nil
}

// TrainLogisticFeasibility trains feasibility score as logistic regression.
func TrainLogisticFeasibility(samples []DatasetSample) (w [6]float64, bias float64) {
	// Simple SGD/gradient descent.
	lr := 0.15
	epochs := 120

	rand.Seed(time.Now().UnixNano())

	for e := 0; e < epochs; e++ {
		rand.Shuffle(len(samples), func(i, j int) { samples[i], samples[j] = samples[j], samples[i] })
		for _, s := range samples {
			z := bias
			for i := 0; i < 6; i++ {
				z += w[i] * s.X[i]
			}
			p := 1.0 / (1.0 + math.Exp(-z))
			grad := p - s.FeasibilityTarget
			for i := 0; i < 6; i++ {
				w[i] -= lr * grad * s.X[i]
			}
			bias -= lr * grad
		}
	}
	return w, bias
}

// ---- Random Forest Regressor (Decision Tree Ensemble) ----

type rfNode struct {
	isLeaf    bool
	feature   int
	threshold float64
	value     float64
	left      *rfNode
	right     *rfNode
}

func meanY(samples []DatasetSample) float64 {
	if len(samples) == 0 {
		return 0
	}
	sum := 0.0
	for _, s := range samples {
		sum += s.LoadTarget
	}
	return sum / float64(len(samples))
}

func mse(samples []DatasetSample, m float64) float64 {
	if len(samples) == 0 {
		return 0
	}
	sum := 0.0
	for _, s := range samples {
		d := s.LoadTarget - m
		sum += d * d
	}
	return sum / float64(len(samples))
}

func buildRFNode(samples []DatasetSample, depth, maxDepth, minLeaf int, featureSubset int) *rfNode {
	if depth >= maxDepth || len(samples) <= minLeaf {
		return &rfNode{isLeaf: true, value: meanY(samples)}
	}

	n := len(samples)

	// Pick random subset of features to try.
	perm := rand.Perm(6)
	if featureSubset > 6 {
		featureSubset = 6
	}
	candidates := perm[:featureSubset]

	bestMSE := math.Inf(1)
	bestFeature := -1
	bestThresh := 0.0

	totalMean := meanY(samples)
	_ = totalMean

	for _, f := range candidates {
		// Candidate thresholds from quantiles of values.
		values := make([]float64, n)
		for i, s := range samples {
			values[i] = s.X[f]
		}
		sort.Float64s(values)

		// Pick up to 9 thresholds.
		uniqueCount := 0
		for i := 1; i < n; i++ {
			if values[i] != values[i-1] {
				uniqueCount++
			}
		}
		if uniqueCount == 0 {
			continue
		}

		numThresh := 9
		if uniqueCount < numThresh {
			numThresh = uniqueCount
		}
		for t := 1; t <= numThresh; t++ {
			pos := int(float64(t) * float64(n) / float64(numThresh+1))
			if pos <= 0 || pos >= n {
				continue
			}
			th := values[pos]

			left := make([]DatasetSample, 0, n/2)
			right := make([]DatasetSample, 0, n/2)
			for _, s := range samples {
				if s.X[f] <= th {
					left = append(left, s)
				} else {
					right = append(right, s)
				}
			}

			if len(left) == 0 || len(right) == 0 {
				continue
			}

			mL := meanY(left)
			mR := meanY(right)
			mseSplit := (float64(len(left))/float64(n))*mse(left, mL) + (float64(len(right))/float64(n))*mse(right, mR)

			if mseSplit < bestMSE {
				bestMSE = mseSplit
				bestFeature = f
				bestThresh = th
			}
		}
	}

	if bestFeature == -1 {
		return &rfNode{isLeaf: true, value: meanY(samples)}
	}

	leftSamples := make([]DatasetSample, 0, n/2)
	rightSamples := make([]DatasetSample, 0, n/2)
	for _, s := range samples {
		if s.X[bestFeature] <= bestThresh {
			leftSamples = append(leftSamples, s)
		} else {
			rightSamples = append(rightSamples, s)
		}
	}

	if len(leftSamples) == 0 || len(rightSamples) == 0 {
		return &rfNode{isLeaf: true, value: meanY(samples)}
	}

	return &rfNode{
		isLeaf:    false,
		feature:   bestFeature,
		threshold: bestThresh,
		left:      buildRFNode(leftSamples, depth+1, maxDepth, minLeaf, featureSubset),
		right:     buildRFNode(rightSamples, depth+1, maxDepth, minLeaf, featureSubset),
	}
}

type RandomForestLoadModel struct {
	Scaler FeatureScaler
	trees  []*rfNode
}

func (m *RandomForestLoadModel) Predict(in Input) float64 {
	if len(m.trees) == 0 {
		return 0.5
	}
	x, err := m.Scaler.scaleFeatures(in)
	if err != nil {
		return 0.5
	}
	sum := 0.0
	for _, t := range m.trees {
		sum += t.predict(x[:])
	}
	return clamp01(sum / float64(len(m.trees)))
}

func (n *rfNode) predict(x []float64) float64 {
	if n.isLeaf {
		return n.value
	}
	if x[n.feature] <= n.threshold {
		if n.left == nil {
			return n.value
		}
		return n.left.predict(x)
	}
	if n.right == nil {
		return n.value
	}
	return n.right.predict(x)
}

func TrainRandomForestLoad(samples []DatasetSample, scaler FeatureScaler) *RandomForestLoadModel {
	if len(samples) < 50 {
		return &RandomForestLoadModel{Scaler: scaler, trees: nil}
	}

	nTrees := 25
	maxDepth := 6
	minLeaf := 15
	featureSubset := 3

	rand.Seed(time.Now().UnixNano())

	trees := make([]*rfNode, 0, nTrees)
	for i := 0; i < nTrees; i++ {
		boot := make([]DatasetSample, 0, len(samples))
		for j := 0; j < len(samples); j++ {
			boot = append(boot, samples[rand.Intn(len(samples))])
		}
		trees = append(trees, buildRFNode(boot, 0, maxDepth, minLeaf, featureSubset))
	}
	return &RandomForestLoadModel{Scaler: scaler, trees: trees}
}

// ---- Gorgonia priority NN (1 hidden layer) ----

// NNPriorityModel is a neural network priority scorer. Training uses Gorgonia;
// inference uses extracted weights for speed.
type NNPriorityModel struct {
	Scaler FeatureScaler

	// 1-hidden-layer MLP weights (featureCount+1 bias feature).
	// W1: [nIn+1][hidden], W2: [hidden][1]
	W1     [][]float64
	W2     []float64
	Hidden int
}

func (m *NNPriorityModel) Predict(in Input) float64 {
	x, err := m.Scaler.scaleFeatures(in)
	if err != nil {
		return 0.5
	}
	// Append bias feature = 1
	xb := make([]float64, 0, 7)
	xb = append(xb, x[:]...)
	xb = append(xb, 1.0)

	// Hidden layer
	h := make([]float64, m.Hidden)
	for j := 0; j < m.Hidden; j++ {
		sum := 0.0
		for i := 0; i < len(xb); i++ {
			sum += xb[i] * m.W1[i][j]
		}
		// ReLU
		if sum < 0 {
			sum = 0
		}
		h[j] = sum
	}

	// Output layer
	outZ := 0.0
	for j := 0; j < m.Hidden; j++ {
		outZ += h[j] * m.W2[j]
	}
	// Sigmoid
	return clamp01(1.0 / (1.0 + math.Exp(-outZ)))
}

func TrainNNPriorityGorgonia(samples []DatasetSample, scaler FeatureScaler) (*NNPriorityModel, error) {
	if len(samples) < 100 {
		return nil, errors.New("not enough dataset rows for NN training")
	}

	features := 6
	hidden := 8
	inWithBias := features + 1

	// Build feature matrix + label matrix for training.
	// y is binary success probability.
	xData := make([]float64, 0, len(samples)*inWithBias)
	yData := make([]float64, 0, len(samples))

	for _, s := range samples {
		for i := 0; i < features; i++ {
			xData = append(xData, s.X[i])
		}
		xData = append(xData, 1.0) // bias constant feature
		yData = append(yData, s.PriorityTarget)
	}

	// Training with Gorgonia: small epochs, small network.
	batchSize := 256
	epochs := 12
	lr := 0.02

	rand.Seed(time.Now().UnixNano())
	g := gorgonia.NewGraph()

	xNode := gorgonia.NewMatrix(g, tensor.Float64, gorgonia.WithShape(batchSize, inWithBias), gorgonia.WithName("x"))
	yNode := gorgonia.NewMatrix(g, tensor.Float64, gorgonia.WithShape(batchSize, 1), gorgonia.WithName("y"))

	w1 := gorgonia.NewMatrix(g, tensor.Float64, gorgonia.WithShape(inWithBias, hidden), gorgonia.WithName("w1"), gorgonia.WithInit(gorgonia.GlorotN(1.0)))
	w2 := gorgonia.NewMatrix(g, tensor.Float64, gorgonia.WithShape(hidden, 1), gorgonia.WithName("w2"), gorgonia.WithInit(gorgonia.GlorotN(1.0)))

	// Forward
	// l0 = x*w1
	l0, err := gorgonia.Mul(xNode, w1)
	if err != nil {
		return nil, err
	}
	h1 := gorgonia.Must(gorgonia.Rectify(l0))

	// outZ = h1*w2
	outZ, err := gorgonia.Mul(h1, w2)
	if err != nil {
		return nil, err
	}
	out := gorgonia.Must(gorgonia.Sigmoid(outZ))

	// BCE loss (mean):
	// cost = -mean( y*log(p) + (1-y)*log(1-p) )
	oneScalar := gorgonia.NewConstant(1.0)
	oneMinusOut := gorgonia.Must(gorgonia.Sub(oneScalar, out))
	logOut := gorgonia.Must(gorgonia.Log(out))
	logOneMinusOut := gorgonia.Must(gorgonia.Log(oneMinusOut))

	oneMinusY := gorgonia.Must(gorgonia.Sub(oneScalar, yNode))
	term1 := gorgonia.Must(gorgonia.HadamardProd(yNode, logOut))
	term2 := gorgonia.Must(gorgonia.HadamardProd(oneMinusY, logOneMinusOut))

	// cost = -mean(term1 + term2)
	sumTerms := gorgonia.Must(gorgonia.Add(term1, term2))
	mean := gorgonia.Must(gorgonia.Mean(sumTerms))
	cost := gorgonia.Must(gorgonia.Neg(mean))

	learnables := gorgonia.Nodes{w1, w2}
	if _, err := gorgonia.Grad(cost, learnables...); err != nil {
		return nil, err
	}

	vm := gorgonia.NewTapeMachine(g, gorgonia.BindDualValues(learnables...))
	solver := gorgonia.NewRMSPropSolver(gorgonia.WithLearnRate(lr), gorgonia.WithBatchSize(float64(batchSize)))
	defer vm.Close()

	total := len(samples)
	numBatches := int(math.Ceil(float64(total) / float64(batchSize)))

	for ep := 0; ep < epochs; ep++ {
		// shuffle indices
		perm := rand.Perm(total)
		for b := 0; b < numBatches; b++ {
			start := b * batchSize
			end := (b + 1) * batchSize
			if start >= total {
				break
			}
			if end > total {
				// Drop last partial batch to keep static shapes.
				break
			}

			batchIdx := perm[start:end]
			xb := make([]float64, batchSize*inWithBias)
			yb := make([]float64, batchSize)

			for i, idx := range batchIdx {
				copy(xb[i*inWithBias:(i+1)*inWithBias], xData[idx*inWithBias:idx*inWithBias+inWithBias])
				yb[i] = yData[idx]
			}

			xT := tensor.New(tensor.WithShape(batchSize, inWithBias), tensor.WithBacking(xb))
			yT := tensor.New(tensor.WithShape(batchSize, 1), tensor.WithBacking(yb))

			gorgonia.Let(xNode, xT)
			gorgonia.Let(yNode, yT)

			if err := vm.RunAll(); err != nil {
				return nil, err
			}
			// Step weights
			if err := solver.Step(gorgonia.NodesToValueGrads(learnables)); err != nil {
				return nil, err
			}
			vm.Reset()
		}
	}

	// Extract weights
	w1Val := w1.Value().Data().([]float64)
	w2Val := w2.Value().Data().([]float64)

	// Build weight slices:
	W1 := make([][]float64, inWithBias)
	for i := 0; i < inWithBias; i++ {
		W1[i] = make([]float64, hidden)
		for j := 0; j < hidden; j++ {
			W1[i][j] = w1Val[i*hidden+j]
		}
	}
	W2 := make([]float64, hidden)
	for j := 0; j < hidden; j++ {
		W2[j] = w2Val[j*1+0]
	}

	return &NNPriorityModel{
		Scaler: scaler,
		W1:     W1,
		W2:     W2,
		Hidden: hidden,
	}, nil
}

// NewTrainedPipelineFromDataset trains all AI support models from the CSV dataset.
func NewTrainedPipelineFromDataset(datasetPath string) (*Pipeline, error) {
	samples, scaler, err := loadDataset(datasetPath)
	if err != nil {
		return nil, err
	}
	if len(samples) < 500 {
		return nil, errors.New("dataset too small for training")
	}

	// 1) Feasibility logistic regression
	w, bias := TrainLogisticFeasibility(samples)
	feasModel := &TrainedLogisticFeasibility{
		Scaler: scaler,
		W:      w,
		Bias:   bias,
	}

	// 2) Load prediction random forest
	loadModel := TrainRandomForestLoad(samples, scaler)

	// 3) Priority score (NN) trained with gorgonia
	priorityModel, err := TrainNNPriorityGorgonia(samples, scaler)
	if err != nil {
		return nil, err
	}

	return &Pipeline{
		feasibility: feasModel,
		load:        loadModel,
		priority:    priorityModel,
		modelSource: "trained_dataset",
	}, nil
}

// NewHeuristicPipeline returns a working fallback (no dataset training).
func NewHeuristicPipeline() *Pipeline {
	return &Pipeline{
		feasibility: NewLogisticFeasibility(),
		load:        NewTreeLoadPredictor(),
		priority:    NewGorgoniaPriorityScorer(),
		modelSource: "heuristic_fallback",
	}
}

// NewTrainedPipeline resolves dataset path and trains all models.
func New() *Pipeline {
	datasetPath, ok := resolveDatasetPath()
	if !ok {
		panic("AI strict mode: training dataset not found (schedulord_research_dataset_12000.csv)")
	}

	trained, err := NewTrainedPipelineFromDataset(datasetPath)
	if err != nil {
		panic("AI strict mode: failed to train models from dataset: " + err.Error())
	}
	return trained
}
