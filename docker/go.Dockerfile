FROM golang:1.22-alpine AS build
WORKDIR /src
COPY backend/go-engine/go.mod backend/go-engine/go.sum ./
RUN go mod download
COPY backend/go-engine/ ./
# Include AI dataset for on-start training (fallback to heuristics if not present).
COPY schedulord_research_dataset_12000.csv /src/schedulord_research_dataset_12000.csv
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/go-engine ./cmd

FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY --from=build /out/go-engine /go-engine
# Copy dataset into runtime image for AI training.
COPY --from=build /src/schedulord_research_dataset_12000.csv /src/schedulord_research_dataset_12000.csv
EXPOSE 9090
USER nonroot:nonroot
ENTRYPOINT ["/go-engine"]
