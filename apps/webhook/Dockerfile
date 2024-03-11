FROM amd64/golang:1.22 AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o /webhook

FROM golang:1.22 AS runner
WORKDIR /app
COPY --from=builder /webhook /webhook
EXPOSE 8080

ENTRYPOINT ["/webhook", ":8080"]
