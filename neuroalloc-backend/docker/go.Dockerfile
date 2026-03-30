FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go-engine/go.mod go-engine/go.sum ./
RUN go mod download
COPY go-engine/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/go-engine ./cmd

FROM gcr.io/distroless/static:nonroot
WORKDIR /
COPY --from=build /out/go-engine /go-engine
EXPOSE 9090
USER nonroot:nonroot
ENTRYPOINT ["/go-engine"]

