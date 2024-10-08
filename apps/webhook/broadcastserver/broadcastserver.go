package broadcastserver

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"webhook/events"

	"nhooyr.io/websocket"
)

type SubscriberGroupEvent struct {
	donorId   string
	status    string
	createdAt time.Time
}

type subscriberGroup struct {
	subscribersLock sync.Mutex
	subscribers     map[*subscriber]struct{}
	eventsLock      sync.Mutex
	events          []SubscriberGroupEvent
	maxEventAge     time.Duration
	lastFlushed     time.Time
	updatedAt       time.Time
	createdAt       time.Time
}

func newSubscriberGroup(maxEventAge time.Duration) *subscriberGroup {
	return &subscriberGroup{
		subscribersLock: sync.Mutex{},
		subscribers:     make(map[*subscriber]struct{}),
		eventsLock:      sync.Mutex{},
		events:          make([]SubscriberGroupEvent, 0),
		maxEventAge:     maxEventAge,
		lastFlushed:     time.Now(),
		createdAt:       time.Now(),
		updatedAt:       time.Now(),
	}
}

func (subGroup *subscriberGroup) addEvent(event SubscriberGroupEvent) {
	subGroup.eventsLock.Lock()
	subGroup.flush()
	subGroup.events = append(subGroup.events, event)
	subGroup.eventsLock.Unlock()

	// if buffer is full the subscriber is closed
	subEvent := SubscriberEvent{DonorId: event.donorId, Status: event.status}
	subGroup.subscribersLock.Lock()
	count := 0
	for sub := range subGroup.subscribers {
		if sub.events == nil {
			continue
		}
		select {
		case sub.events <- subEvent:
			{
				count++
			}
		default:
			sub.closeSlow()
		}
	}
	subGroup.subscribersLock.Unlock()
	fmt.Printf("[debug] %d subscribers were sent an event \n", count)
}

// user must lock eventsLock before calling this
func (subGroup *subscriberGroup) flush() {
	now := time.Now()
	minEventTime := now.Add(-1 * subGroup.maxEventAge)
	if subGroup.lastFlushed.After(minEventTime) {
		return
	}

	subGroup.lastFlushed = now
	var i int
	for i = 0; i < len(subGroup.events); i++ {
		if subGroup.events[i].createdAt.After(minEventTime) {
			break
		}
	}

	if i == 0 {
		return
	}
	eventsLen := len(subGroup.events)
	if i == eventsLen {
		subGroup.events = subGroup.events[:0]
		return
	}

	copy(subGroup.events, subGroup.events[i:])
	subGroup.events = subGroup.events[:(eventsLen - i)]
}

type BroadcastServer struct {
	// logf controls where logs are sent.
	// Defaults to log.Printf.
	logf                func(f string, v ...interface{})
	serveMux            http.ServeMux
	subscriberGroupLock sync.Mutex
	subscriberGroupMap  map[string]*subscriberGroup
	snsArn              string
	db                  *sql.DB
	maxEventAge         time.Duration
}

func NewBroadcastServer(snsArn string, db *sql.DB, maxEventAge time.Duration) (*BroadcastServer, error) {
	server := &BroadcastServer{
		db:                 db,
		snsArn:             snsArn,
		logf:               log.Printf,
		subscriberGroupMap: make(map[string]*subscriberGroup),
		maxEventAge:        maxEventAge,
	}
	server.serveMux.HandleFunc("/", func(writer http.ResponseWriter, req *http.Request) {
		writer.Write([]byte("Go to wss:*/subscribe/campaignId to connect"))
	})
	server.serveMux.HandleFunc("/subscribe/", server.SubscribeHandler)
	server.serveMux.HandleFunc("/publish", server.PublishHandler)
	server.serveMux.HandleFunc("/ping", server.PingHandler)

	return server, nil
}

type SubscriberEvent struct {
	DonorId string `json:"donorId"`
	Status  string `json:"status"`
}

type subscriber struct {
	campaignId string
	events     chan SubscriberEvent
	closeSlow  func()
}

func (server *BroadcastServer) ServeHTTP(writer http.ResponseWriter, req *http.Request) {
	server.serveMux.ServeHTTP(writer, req)
}

func (server *BroadcastServer) PingHandler(writer http.ResponseWriter, req *http.Request) {
	if req.Method != "POST" {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	body := http.MaxBytesReader(writer, req.Body, 1024)
	msg, err := io.ReadAll(body)
	if err != nil {
		http.Error(writer, http.StatusText(http.StatusRequestEntityTooLarge), http.StatusRequestEntityTooLarge)
		return
	}

	var parsedBody struct {
		Ping bool `json:"ping"`
	}
	err2 := json.Unmarshal(msg, &parsedBody)
	fmt.Println(parsedBody.Ping)
	if err2 != nil || !parsedBody.Ping {
		http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}

	writer.WriteHeader(http.StatusAccepted)
	writer.Header().Add("Content-Type", "application/json")
	pong := struct {
		Pong bool `json:"pong"`
	}{Pong: true}
	response, err := json.Marshal(pong)
	if err != nil {
		http.Error(writer, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		return
	}
	writer.Write(response)
}

func dumpMap(space string, m map[string]interface{}) {
	for k, v := range m {
		if mv, ok := v.(map[string]interface{}); ok {
			fmt.Printf("{ \"%v\": \n", k)
			dumpMap(space+"\t", mv)
			fmt.Printf("}\n")
		} else {
			fmt.Printf("%v %v : %v\n", space, k, v)
		}
	}
}

// publishHandler reads the request body with a limit of 8192 bytes and then publishes
// the received message.
func (server *BroadcastServer) PublishHandler(writer http.ResponseWriter, req *http.Request) {
	if req.Method != "POST" {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	reqSnsArn := req.Header.Get("x-amz-sns-topic-arn")
	if reqSnsArn != server.snsArn {
		fmt.Fprintf(os.Stderr, "[error] invalid topic arn %s", reqSnsArn)
		http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}

	bodyReader := http.MaxBytesReader(writer, req.Body, 8192)
	rawBody, err := io.ReadAll(bodyReader)
	if err != nil {
		http.Error(writer, http.StatusText(http.StatusRequestEntityTooLarge), http.StatusRequestEntityTooLarge)
		return
	}

	campaignId, donorId, emailId, status, err := events.ParseSnsEvent(rawBody)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[error] failed to parse sns event: %s", err)
		fmt.Fprintf(os.Stderr, "[error] rawBody: %s", string(rawBody))
		http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}

	fmt.Printf("[debug] event received: campaignId: %s, donorId: %s, status: %s, emailId: %s \n", campaignId, donorId, status, emailId)

	event := SubscriberGroupEvent{donorId: donorId, status: status, createdAt: time.Now()}

	server.subscriberGroupLock.Lock()
	subGroup, ok := server.subscriberGroupMap[campaignId]
	if !ok {
		subGroup = newSubscriberGroup(server.maxEventAge)
		server.subscriberGroupMap[campaignId] = subGroup
	}
	server.subscriberGroupLock.Unlock()

	subGroup.addEvent(event)
	server.WriteEventToDb(donorId, campaignId, status, emailId)

	writer.WriteHeader(http.StatusAccepted)
}

func (server *BroadcastServer) WriteEventToDb(donorId, campaignId, status, emailId string) error {
	const sqlStatement = `
UPDATE receipts
		SET email_status = $emailStatus,
			email_id = $emailId
		WHERE campaign_id = $campaignId AND donor_id = $donorId;
`

	res, err := server.db.Exec(sqlStatement, sql.Named("emailStatus", status), sql.Named("emailId", emailId), sql.Named("campaignId", campaignId), sql.Named("donorId", donorId))
	if err != nil {
		fmt.Fprintf(
			os.Stderr,
			"[error] an error occured writing to the db:\n%s\nemailStatus: %s\nemailId: %s\n campaignId: %s\ndonorId: %s",
			err,
			status,
			emailId,
			campaignId,
			donorId,
		)
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		fmt.Fprintf(os.Stderr, "[error] an error occured unwrapping the rows affected %s", err)
		return err
	}
	if affected == 0 {
		fmt.Printf("[error] donorId: %s, campaignId: %s, emailStatus: %s \n", donorId, campaignId, status)
		fmt.Fprintln(os.Stderr, "[error] no rows affected by update query")
		return errors.New("no rows affected")
	}
	return nil
}

// subscribeHandler accepts the WebSocket connection and then subscribes
// it to all future messages.
func (server *BroadcastServer) SubscribeHandler(writer http.ResponseWriter, req *http.Request) {
	err := server.Subscribe(req.Context(), writer, req)
	if errors.Is(err, context.Canceled) {
		return
	}
	if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
		websocket.CloseStatus(err) == websocket.StatusGoingAway {
		return
	}
	if err != nil {
		server.logf("%v", err)
		return
	}
}

func getId(writer http.ResponseWriter, req *http.Request) (string, error) {
	id := strings.TrimPrefix(req.URL.Path, "/subscribe/")
	if id == "" {
		http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return "", errors.New("no campaign id in request")
	}

	return id, nil
}

// subscribe subscribes the given WebSocket to all broadcast messages.
// It creates a subscriber with a buffered msgs chan to give some room to slower
// connections and then registers the subscriber. It then listens for all messages
// and writes them to the WebSocket. If the context is cancelled or
// an error occurs, it returns and deletes the subscription.
//
// It uses CloseRead to keep reading from the connection to process control
// messages and cancel the context if the connection drops.
func (server *BroadcastServer) Subscribe(ctx context.Context, writer http.ResponseWriter, req *http.Request) error {
	var mu sync.Mutex
	var wsConn *websocket.Conn
	var closed bool
	sub := &subscriber{
		events: make(chan SubscriberEvent, 10),
		closeSlow: func() {
			mu.Lock()
			defer mu.Unlock()
			closed = true
			if wsConn != nil {
				wsConn.Close(websocket.StatusPolicyViolation, "connection too slow to keep up with messages")
			}
		},
	}
	id, err := getId(writer, req)
	if err != nil {
		return err
	}

	wsConn2, err := websocket.Accept(writer, req, &websocket.AcceptOptions{
		OriginPatterns: []string{"*.donationreceipt.online", "donationreceipt.online", "*babyccino.vercel.app"},
	})
	if err != nil {
		return err
	}
	mu.Lock()
	if closed {
		mu.Unlock()
		return net.ErrClosed
	}
	wsConn = wsConn2
	mu.Unlock()
	defer wsConn.CloseNow()

	ctx = wsConn.CloseRead(ctx)

	fmt.Printf("[debug] client subscribed to events from campaign %s\n", id)

	server.AddSubscriber(ctx, sub, id, wsConn)
	defer server.DeleteSubscriber(sub)

	for {
		select {
		case event := <-sub.events:
			resp, err := json.Marshal(event)
			if err != nil {
				return err
			}

			err2 := writeTimeout(ctx, time.Second*5, wsConn, resp)
			if err2 != nil {
				return err2
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// addSubscriber registers a subscriber.
func (server *BroadcastServer) AddSubscriber(ctx context.Context, sub *subscriber, campaignId string, wsConn *websocket.Conn) {
	server.subscriberGroupLock.Lock()
	subGroup, found := server.subscriberGroupMap[campaignId]
	if !found {
		subGroup = newSubscriberGroup(server.maxEventAge)
		server.subscriberGroupMap[campaignId] = subGroup
	}
	defer server.subscriberGroupLock.Unlock()

	// lock events until the subscriber is added
	// and send all events from the past minute to the subscriber
	// to make sure they are up to date
	subGroup.eventsLock.Lock()
	var eventsToSend = make([]SubscriberGroupEvent, len(subGroup.events))
	copy(eventsToSend, subGroup.events)
	go func() {
		for _, event := range eventsToSend {
			jsonEvent := SubscriberEvent{DonorId: event.donorId, Status: event.status}
			resp, err := json.Marshal(jsonEvent)
			if err != nil {
				return
			}

			err2 := writeTimeout(ctx, time.Second*5, wsConn, resp)
			if err2 != nil {
				return
			}
		}
	}()
	subGroup.subscribers[sub] = struct{}{}
	subGroup.eventsLock.Unlock()
}

// deleteSubscriber deletes the given subscriber.
func (server *BroadcastServer) DeleteSubscriber(sub *subscriber) {
	id := sub.campaignId
	server.subscriberGroupLock.Lock()
	subGroup, found := server.subscriberGroupMap[id]
	server.subscriberGroupLock.Unlock()
	if !found {
		return
	}

	subGroup.subscribersLock.Lock()
	delete(subGroup.subscribers, sub)
	subGroup.subscribersLock.Unlock()
}

func writeTimeout(ctx context.Context, timeout time.Duration, wsConn *websocket.Conn, msg []byte) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return wsConn.Write(ctx, websocket.MessageText, msg)
}

func (server *BroadcastServer) OnShutdown() {
	server.db.Close()
}
