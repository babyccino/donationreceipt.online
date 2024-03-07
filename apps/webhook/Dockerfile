FROM golang:1.22

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./

RUN go build -o /webhook

EXPOSE 8080

CMD ["/webhook", ":8080"]
