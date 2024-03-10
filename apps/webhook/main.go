package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"
)

func main() {
	log.SetFlags(0)

	err := run()
	if err != nil {
		log.Fatal(err)
	}
}

// run initializes the chatServer and then
// starts a http.Server for the passed in address.
func run() error {
	if len(os.Args) < 2 {
		return errors.New("please provide an address to listen on as the first argument")
	}

	snsArn, exists := os.LookupEnv("SNS_ARN")
	if !exists {
		return errors.New("SNS_ARN environment variable not set")
	}

	chatServer := newBroadcastServer(snsArn)
	httpServer := &http.Server{
		Handler:      chatServer,
		ReadTimeout:  time.Second * 10,
		WriteTimeout: time.Second * 10,
	}
	errc := make(chan error, 1)
	addr := os.Args[1]
	httpServer.Addr = addr
	go func() {
		log.Printf("listening on http://%v", addr)
		errc <- httpServer.ListenAndServe()
	}()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, os.Interrupt)
	select {
	case err := <-errc:
		log.Printf("failed to serve: %v", err)
	case sig := <-sigs:
		log.Printf("terminating: %v", sig)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Nanosecond*1)
	defer cancel()

	return httpServer.Shutdown(ctx)
}
