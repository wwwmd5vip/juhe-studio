# Build stage
FROM golang:1.25-alpine AS builder

ENV GOTOOLCHAIN=auto
ENV GOPROXY=https://goproxy.cn,direct

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server cmd/server/main.go

# Runtime stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

USER 1000

WORKDIR /app

COPY --from=builder --chown=1000:1000 /app/server /app/server

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/api/public/status | grep -q '"status":"ok"'

CMD ["./server"]
