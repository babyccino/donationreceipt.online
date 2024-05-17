package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"webhook/broadcastserver"

	"github.com/joho/godotenv"
	_ "github.com/tursodatabase/libsql-client-go/libsql"
)

func main() {
	log.SetFlags(0)

	err := run()
	if err != nil {
		log.Fatal(err)
	}
}

func getEnv() (dbUrl string, dbAuthToken string, snsArn string, err error) {
	dbUrl, dbUrlExists := os.LookupEnv("LIB_SQL_DB_URL")
	dbAuthToken, dbAuthTokenExists := os.LookupEnv("LIB_SQL_AUTH_TOKEN")
	snsArn, snsArnExists := os.LookupEnv("SNS_ARN")
	if !dbUrlExists || !snsArnExists || !dbAuthTokenExists {
		err := godotenv.Load("./.env")
		if err != nil {
			log.Fatal("env variables not found and .env file not found")
		}

		dbUrl, dbUrlExists = os.LookupEnv("LIB_SQL_DB_URL")
		dbAuthToken, dbAuthTokenExists = os.LookupEnv("LIB_SQL_AUTH_TOKEN")
		snsArn, snsArnExists = os.LookupEnv("SNS_ARN")
		if !dbUrlExists || !snsArnExists || !dbAuthTokenExists {
			return "", "", "", errors.New("env variables not found in .env file")
		}
	}

	return dbUrl, dbAuthToken, snsArn, nil
}

// run initializes the chatServer and then
// starts a http.Server for the passed in address.
func run() error {
	if len(os.Args) < 2 {
		return errors.New("please provide an address to listen on as the first argument")
	}

	dbUrl, dbAuthToken, snsArn, err := getEnv()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fatal-error] %s",  err)
		os.Exit(1)
	}

	db, err := sql.Open("libsql", fmt.Sprintf("%s?authToken=%s", dbUrl, dbAuthToken))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fatal-error] failed to open db %s: %s", dbUrl, err)
		os.Exit(1)
	}

	chatServer, err := broadcastserver.NewBroadcastServer(snsArn, db, 30*time.Second)
	if err != nil {
		return err
	}

	httpServer := &http.Server{
		Handler:      chatServer,
		ReadTimeout:  time.Second * 10,
		WriteTimeout: time.Second * 10,
	}
	httpServer.RegisterOnShutdown(chatServer.OnShutdown)
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
