package broadcastserver

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
	"webhook/events"

	"github.com/google/uuid"
	_ "github.com/tursodatabase/go-libsql"
	"nhooyr.io/websocket"
)

type StringSet map[string]struct{}
type CampaignMessages struct {
	set  StringSet
	lock *sync.Mutex
}

func messageHash(donorId, status string) string {
	return fmt.Sprintf(`{"donorId":%s,"status":%s}`, donorId, status)
}

func Test_chatServer(test *testing.T) {
	test.Parallel()

	// This is a simple echo test with a single client.
	// The client sends a message and ensures it receives
	// it on its WebSocket.
	test.Run("simple", func(test *testing.T) {
		test.Parallel()

		testBroadcastServer := setupBroadcastServerTester(test, 30*time.Second)
		defer testBroadcastServer.close()

		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()

		campaignId := "test-campaign"
		subscribeUrl := testBroadcastServer.url + "/subscribe/" + campaignId
		client, err := newClient(ctx, subscribeUrl)
		assertSuccess(test, err)
		defer client.Close()

		donorId := randAlphaNumericString(10)
		emailId := randAlphaNumericString(10)
		emailStatus := events.Send
		err = testBroadcastServer.generateDbEntriesForEvent(campaignId, donorId, emailId)
		assertSuccess(test, err)
		err = testBroadcastServer.publishEvent(ctx, campaignId, donorId, emailId, emailStatus)
		assertSuccess(test, err)

		expectedMessageJson, err := client.nextMessage(ctx)
		assertSuccess(test, err)

		mappedEvent := events.MapSnsEvent(events.EventType(emailStatus))
		if expectedMessageJson.DonorId != donorId || expectedMessageJson.Status != mappedEvent {
			test.Fatalf("expected %v but got %v", messageHash(donorId, mappedEvent), messageHash(expectedMessageJson.DonorId, expectedMessageJson.Status))
		}

		err = testBroadcastServer.testDbForReceipt(campaignId, donorId, emailId, mappedEvent)
		assertSuccess(test, err)
	})

	test.Run("flush test", func(test *testing.T) {
		test.Parallel()

		testBroadcastServer := setupBroadcastServerTester(test, 1*time.Second)
		defer testBroadcastServer.close()

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		campaignId := "test-campaign"

		donorId1 := randAlphaNumericString(10)
		emailId1 := randAlphaNumericString(10)
		emailStatus1 := events.Send
		err := testBroadcastServer.generateDbEntriesForEvent(campaignId, donorId1, emailId1)
		assertSuccess(test, err)
		err = testBroadcastServer.publishEvent(ctx, campaignId, donorId1, emailId1, emailStatus1)
		assertSuccess(test, err)

		subscribeUrl := testBroadcastServer.url + "/subscribe/" + campaignId
		client1, err := newClient(ctx, subscribeUrl)
		assertSuccess(test, err)
		defer client1.Close()

		expectedMessageJson1, err := client1.nextMessage(ctx)
		assertSuccess(test, err)

		mappedEvent1 := events.MapSnsEvent(events.EventType(emailStatus1))
		if expectedMessageJson1.DonorId != donorId1 || expectedMessageJson1.Status != mappedEvent1 {
			test.Fatalf("expected %v but got %v", messageHash(donorId1, mappedEvent1), messageHash(expectedMessageJson1.DonorId, expectedMessageJson1.Status))
		}

		time.Sleep(1*time.Second + 100*time.Millisecond)

		donorId2 := randAlphaNumericString(10)
		emailId2 := randAlphaNumericString(10)
		emailStatus2 := events.Send
		err = testBroadcastServer.generateDbEntriesForEvent(campaignId, donorId2, emailId2)
		assertSuccess(test, err)
		err = testBroadcastServer.publishEvent(ctx, campaignId, donorId2, emailId2, emailStatus2)
		assertSuccess(test, err)

		expectedMessageJson2, err := client1.nextMessage(ctx)
		assertSuccess(test, err)

		mappedEvent2 := events.MapSnsEvent(events.EventType(emailStatus2))
		if expectedMessageJson2.DonorId != donorId2 || expectedMessageJson2.Status != mappedEvent2 {
			test.Fatalf("expected %v but got %v", messageHash(donorId2, mappedEvent2), messageHash(expectedMessageJson2.DonorId, expectedMessageJson2.Status))
		}

		client2, err := newClient(ctx, subscribeUrl)
		assertSuccess(test, err)
		defer client2.Close()

		expectedMessageJson2, err = client2.nextMessage(ctx)
		assertSuccess(test, err)

		mappedEvent2 = events.MapSnsEvent(events.EventType(emailStatus2))
		if expectedMessageJson2.DonorId != donorId2 || expectedMessageJson2.Status != mappedEvent2 {
			test.Fatalf("expected %v but got %v", messageHash(donorId2, mappedEvent2), messageHash(expectedMessageJson2.DonorId, expectedMessageJson2.Status))
		}

		err = testBroadcastServer.testDbForReceipt(campaignId, donorId1, emailId1, mappedEvent1)
		assertSuccess(test, err)
	})

	// This test is a complex concurrency test.
	// 16 clients listening to 4 separate campaigns
	// and 128 messages are split between the campaigns.
	// The test verifies that every message is seen by ever client
	// and no errors occur anywhere.
	test.Run("concurrency", func(test *testing.T) {
		test.Parallel()

		const nMessages = 128
		const nClients = 16
		const nCampaigns = 4

		broadcastServerTester := setupBroadcastServerTester(test, 30*time.Second)
		defer broadcastServerTester.close()

		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()

		clients := make([]*Client, 0, nClients)

		getCampaignId := func(i int) string {
			return "test-campaign" + fmt.Sprint(i%nCampaigns)
		}

		for i := 0; i < nClients; i++ {
			campaignId := getCampaignId(i)
			subscribeUrl := broadcastServerTester.url + "/subscribe/" + campaignId
			cl, err := newClient(ctx, subscribeUrl)
			assertSuccess(test, err)
			defer cl.Close()

			clients = append(clients, cl)
		}

		// expected messages divided by campaign
		campaignMessagesLock := sync.Mutex{}
		campaignMessages := make(map[string]CampaignMessages)
		getCampaignMessages := func(campaignId string) CampaignMessages {
			campaignMessagesLock.Lock()
			defer campaignMessagesLock.Unlock()
			messageSet, ok := campaignMessages[campaignId]
			if !ok {
				newStringSet := make(StringSet)
				messageSet = CampaignMessages{set: newStringSet, lock: &sync.Mutex{}}
				campaignMessages[campaignId] = messageSet
			}
			return messageSet
		}

		var wg sync.WaitGroup
		testDb := func(campaignId, donorId, emailId, emailStatus string) {
			defer wg.Done()
			mappedEvent := events.MapSnsEvent(events.EventType(emailStatus))
			err := broadcastServerTester.testDbForReceipt(campaignId, donorId, emailId, mappedEvent)
			assertSuccess(test, err)
		}

		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < nMessages; i++ {
				campaignId := "test-campaign" + fmt.Sprint(i%nCampaigns)
				messageSet := getCampaignMessages(campaignId)

				donorId := randAlphaNumericString(10)
				emailId := randAlphaNumericString(10)
				emailStatus := events.Send
				mappedStatus := events.MapSnsEvent(events.EventType(emailStatus))
				messageSet.lock.Lock()
				messageSet.set[fmt.Sprintf(`{"donorId":%s,"status":%s}`, donorId, mappedStatus)] = struct{}{}
				messageSet.lock.Unlock()
				err := broadcastServerTester.generateDbEntriesForEvent(campaignId, donorId, emailId)
				assertSuccess(test, err)
				err = broadcastServerTester.publishEvent(ctx, campaignId, donorId, emailId, emailStatus)
				assertSuccess(test, err)

				wg.Add(1)
				go testDb(campaignId, donorId, emailId, emailStatus)
			}
		}()

		for i, client := range clients {
			campaignId := getCampaignId(i)
			messages := getCampaignMessages(campaignId)
			wg.Add(1)
			go func(messages CampaignMessages) {
				defer wg.Done()
				err := client.testAllMessagesReceived(test, ctx, i, getMessageCount(nMessages, nCampaigns, i), messages)
				if err != nil {
					test.Errorf("client %d failed to receive all messages: %v", i, err)
				}
			}(messages)
		}

		wg.Wait()

		// new subscribers are supposed to be sent all messages
		i := 1
		campaignId := getCampaignId(i)
		subscribeUrl := broadcastServerTester.url + "/subscribe/" + campaignId
		client, err := newClient(ctx, subscribeUrl)
		messages := getCampaignMessages(campaignId)
		err = client.testAllMessagesReceived(test, ctx, i, getMessageCount(nMessages, nCampaigns, i), messages)
		if err != nil {
			test.Errorf("client %d failed to receive all messages: %v", i, err)
		}
	})
}

func getMessageCount(nMessages, nCampaigns, i int) int {
	ret := nMessages / nCampaigns
	if nMessages%nCampaigns > i {
		ret++
	}
	return ret
}

func Test_getMessageCount(test *testing.T) {
	test.Parallel()
	count := getMessageCount(10, 4, 0)
	if count != 3 {
		test.Errorf("expected 3 but got %d", count)
	}
	count = getMessageCount(10, 4, 1)
	if count != 3 {
		test.Errorf("expected 3 but got %d", count)
	}
	count = getMessageCount(10, 4, 2)
	if count != 2 {
		test.Errorf("expected 2 but got %d", count)
	}
	count = getMessageCount(10, 4, 3)
	if count != 2 {
		test.Errorf("expected 2 but got %d", count)
	}
}

const (
	snsArn = "arn:aws:sns:us-west-2:123456789012:MyTopic"
)

type BroadcastServerTester struct {
	db              *sql.DB
	dbPath          string
	url             string
	broadcastServer *BroadcastServer
	httpServer      *httptest.Server
}

// Defer closeFn to ensure everything is cleaned up at
// the end of the test.
func setupBroadcastServerTester(test *testing.T, maxEventAge time.Duration) *BroadcastServerTester {
	test.Helper()
	newUuid := uuid.New().String()
	dbPath := fmt.Sprintf("./%s.db", newUuid)
	os.Remove(dbPath)

	dbUrl := fmt.Sprintf("file:%s", dbPath)
	db, err := sql.Open("libsql", dbUrl)
	if err != nil {
		os.Remove(dbPath)
		test.Fatalf("[error] failed to open db %s: %s", dbUrl, err)
	}

	// 	_, err = db.Exec(`CREATE TABLE campaigns (
	// 	id text(191) PRIMARY KEY NOT NULL,
	// 	account_id text(191) NOT NULL,
	// 	start_date integer NOT NULL,
	// 	end_date integer NOT NULL,
	// 	created_at integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
	// );`)
	if err != nil {
		os.Remove(dbPath)
		test.Fatalf("[error] failed to create table campaigns: %s", err)
	}
	_, err = db.Exec(`CREATE TABLE receipts (
	id text(191) PRIMARY KEY NOT NULL,
	email_id text(191),
	campaign_id text(191) NOT NULL,
	email_status text NOT NULL,
	donor_id text(191) NOT NULL,
	total integer NOT NULL,
	name text NOT NULL,
	email text NOT NULL,
	created_at integer DEFAULT (cast(strftime('%s', 'now') as int) * 1000) NOT NULL
);`)
	if err != nil {
		os.Remove(dbPath)
		test.Fatalf("[error] failed to create table receipts: %s", err)
	}

	// CREATE INDEX IF NOT EXISTS campaigns__account_id__idx ON campaigns (account_id);--> statement-breakpoint
	_, err = db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS receipts__email_id__idx ON receipts (email_id);--> statement-breakpoint
	CREATE INDEX IF NOT EXISTS receipts__campaign_id__idx ON receipts (campaign_id);--> statement-breakpoint
	CREATE UNIQUE INDEX IF NOT EXISTS receipts__campaign_id__donor_id__idx ON receipts (campaign_id,donor_id);--> statement-breakpoint`)
	if err != nil {
		os.Remove(dbPath)
		test.Fatalf("[error] failed to create indices: %s", err)
	}

	broadcastServer, err := NewBroadcastServer(snsArn, db, maxEventAge)
	if err != nil {
		os.Remove(dbPath)
		test.Fatalf("[error] failed to open db %s: %s", dbUrl, err)
	}

	broadcastServer.logf = test.Logf

	// To ensure tests run quickly under even -race.
	httpServer := httptest.NewServer(broadcastServer)
	return &BroadcastServerTester{
		db:              db,
		dbPath:          dbPath,
		url:             httpServer.URL,
		broadcastServer: broadcastServer,
		httpServer:      httpServer,
	}
}

func (server *BroadcastServerTester) generateDbEntriesForEvent(campaignId, donorId, emailId string) error {
	// I don't think we need to insert into campaigns, as we're not using it in the code
	// 	_, err := server.db.Exec(`INTO campaigns VALUES (
	// 	$id,
	// 	"test_account_id",
	// 	0,
	// 	0
	// );`, sql.Named("campaignId", campaignId))
	// 	if err != nil {
	// 		fmt.Fprintf(os.Stderr, "[error] an error occured writing to campaigns %s", err)
	// 		return err
	// 	}

	_, err := server.db.Exec(`INSERT INTO receipts VALUES (
	$id,
	$emailId,
	$campaignId,
	$emailStatus,
	$donorId,
	100,
	'John Doe',
	'test@test.com',
	0
);`,
		sql.Named("id", randAlphaNumericString(10)),
		sql.Named("emailId", emailId),
		sql.Named("campaignId", campaignId),
		sql.Named("emailStatus", "not_sent"),
		sql.Named("donorId", donorId),
	)
	if err != nil {
		return err
	}
	return nil
}

func (server *BroadcastServerTester) testDbForReceipt(expectedCampaignId, expectedDonorId, expectedEmailId, expectedEmailStatus string) error {
	rows, err := server.db.Query(`SELECT
			campaign_id, donor_id, email_id, email_status
			FROM receipts
			WHERE email_id=$emailId;`, sql.Named("emailId", expectedEmailId))
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			dbCampaignId  string
			dbDonorId     string
			dbEmailId     string
			dbEmailStatus string
		)
		if err := rows.Scan(&dbCampaignId, &dbDonorId, &dbEmailId, &dbEmailStatus); err != nil {
			return err
		}

		if dbCampaignId != expectedCampaignId || dbDonorId != expectedDonorId || dbEmailId != expectedEmailId || dbEmailStatus != expectedEmailStatus {
			return fmt.Errorf(
				"expected row: %s, %s, %s, %s\nrow found in db %s, %s, %s, %s",
				expectedCampaignId,
				expectedDonorId,
				expectedEmailId,
				expectedEmailStatus,
				dbCampaignId,
				dbDonorId,
				dbEmailId,
				dbEmailStatus,
			)
		}
	}

	return nil
}

// Make sure to run generateDbEntriesForEvent before calling this function
// for the first time for a given campaignId and donorId
func (server *BroadcastServerTester) publishEvent(ctx context.Context, campaignId, donorId, emailId, emailStatus string) error {
	msg := generateResponseBody(campaignId, donorId, emailId, emailStatus, snsArn)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.url+"/publish", strings.NewReader(msg))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("x-amz-sns-topic-arn", snsArn)

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("publish request failed: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusAccepted {
		return fmt.Errorf("publish request failed: %v", res.StatusCode)
	}
	return nil
}

func (server *BroadcastServerTester) close() {
	server.httpServer.Close()
	server.db.Close()
	os.Remove(server.dbPath)
}

func randMessages(n, maxMessageLength int) StringSet {
	msgs := make(StringSet)
	for i := 0; i < n; i++ {
		m := randAlphaNumericString(randInt(maxMessageLength))
		if _, ok := msgs[m]; ok {
			i--
			continue
		}
		msgs[m] = struct{}{}
	}
	return msgs
}

func assertSuccess(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

type Client struct {
	connection *websocket.Conn
}

func newClient(ctx context.Context, url string) (*Client, error) {
	connection, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		return nil, err
	}

	client := &Client{
		connection: connection,
	}

	return client, nil
}

// testAllMessagesReceived ensures that after n reads, all msgs in msgs
// have been read.
func (client *Client) testAllMessagesReceived(test *testing.T, ctx context.Context, clientId, n int, msgs CampaignMessages) error {
	test.Helper()
	for i := 0; i < n; i++ {
		receivedJson, err := client.nextMessage(ctx)
		if err != nil {
			return err
		}
		hash := messageHash(receivedJson.DonorId, receivedJson.Status)
		if clientId == 0 {
			test.Logf("received %d message %s", clientId, hash)
		}

		msgs.lock.Lock()
		if _, ok := msgs.set[hash]; !ok {
			msgs.lock.Unlock()
			if clientId == 0 {
				test.Errorf("unexpected message: %s", hash)
				test.Logf("message set %s", msgs.set)
			}
			return fmt.Errorf("unexpected message: %s", hash)
		}
		msgs.lock.Unlock()
	}

	return nil
}

func (client *Client) nextMessage(ctx context.Context) (SubscriberEvent, error) {
	msgType, msg, err := client.connection.Read(ctx)
	if err != nil {
		return SubscriberEvent{}, err
	}

	if msgType != websocket.MessageText {
		client.connection.Close(websocket.StatusUnsupportedData, "expected text message")
		return SubscriberEvent{}, fmt.Errorf("expected text message but got %v", msgType)
	}

	var parsedJson SubscriberEvent
	err = json.Unmarshal(msg, &parsedJson)
	if err != nil {
		return SubscriberEvent{}, err
	}
	return parsedJson, nil
}

func (client *Client) Close() error {
	return client.connection.Close(websocket.StatusNormalClosure, "")
}

// randString generates a random string with length n.
func randString(n int) string {
	b := make([]byte, n)
	_, err := rand.Reader.Read(b)
	if err != nil {
		panic(fmt.Sprintf("failed to generate rand bytes: %v", err))
	}

	s := strings.ToValidUTF8(string(b), "_")
	s = strings.ReplaceAll(s, "\x00", "_")
	if len(s) > n {
		return s[:n]
	}
	if len(s) < n {
		// Pad with =
		extra := n - len(s)
		return s + strings.Repeat("=", extra)
	}
	return s
}

func randAlphaNumericString(n int) string {
	str := ""
	for i := 0; i < n; i++ {
		b := '!' + randInt('~'-'!'+1)
		if b == '\\' {
			str += "_"
		} else if b == '"' {
			str += "'"
		} else {
			str += string(byte(b))
		}
	}
	return str
}

// randInt returns a randomly generated integer between [0, max).
func randInt(max int) int {
	x, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		panic(fmt.Sprintf("failed to get random int: %v", err))
	}
	return int(x.Int64())
}

const baseResponseMessage = `{
"Type" : "Notification",
"MessageId" : "test-message-id",
"TopicArn" : "test-topic-arn",
"Subject" : "Amazon SES Email Event Notification",
"Message" : "{\"eventType\":\"Send\",\"mail\":{\"timestamp\":\"2024-03-11T14:47:59.955Z\",\"source\":\"email@test.online\",\"sourceArn\":\"arn:aws:ses:test-region:test:identity/test.online\",\"sendingAccountId\":\"test\",\"messageId\":\"test-message-id\",\"destination\":[\"email@simulator.amazonses.com\"],\"headersTruncated\":false,\"headers\":[{\"name\":\"Content-Type\",\"value\":\"text/plain; charset=utf-8\"},{\"name\":\"X-Ses-Configuration-Set\",\"value\":\"test-sns-config-set\"},{\"name\":\"X-Data-Campaign-ID\",\"value\":\"test-campaign-id\"},{\"name\":\"X-Data-Donor-ID\",\"value\":\"test-donor-id\"},{\"name\":\"From\",\"value\":\"contact@test.online\"},{\"name\":\"To\",\"value\":\"success@simulator.amazonses.com\"},{\"name\":\"Subject\",\"value\":\"test\"},{\"name\":\"Message-ID\",\"value\":\"<test-email-id@test.online>\"},{\"name\":\"Content-Transfer-Encoding\",\"value\":\"7bit\"},{\"name\":\"Date\",\"value\":\"Mon, 11 Mar 2024 14:47:59 +0000\"},{\"name\":\"MIME-Version\",\"value\":\"1.0\"}],\"commonHeaders\":{\"from\":[\"contact@test.online\"],\"date\":\"Mon, 11 Mar 2024 14:47:59 +0000\",\"to\":[\"success@simulator.amazonses.com\"],\"messageId\":\"test-message-id\",\"subject\":\"test\"},\"tags\":{\"ses:source-tls-version\":[\"TLSv1.3\"],\"ses:operation\":[\"SendRawEmail\"],\"ses:configuration-set\":[\"test-sns-config-set\"],\"ses:source-ip\":[\"92.22.4.86\"],\"ses:from-domain\":[\"test.online\"],\"ses:caller-identity\":[\"root\"]}},\"send\":{}}\n",
"Timestamp" : "2024-03-11T14:48:00.136Z",
"SignatureVersion" : "1",
"Signature" : "test.signature.png",
"SigningCertURL" : "https://sns.test-region.amazonaws.com",
"UnsubscribeURL" : "https://sns.test-region.amazonaws.com"
}`

func generateResponseBody(campaignId, donorId, emailId, emailStatus, arn string) string {
	replacer := strings.NewReplacer(
		"test-campaign-id", campaignId,
		"test-donor-id", donorId,
		"test-message-id", emailId,
		"test-email-status", emailStatus,
		"test-topic-arn", arn,
	)
	return replacer.Replace(baseResponseMessage)
}
