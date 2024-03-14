package events

import (
	"strings"
	"testing"
)

func TestTruncate(t *testing.T) {
	t.Parallel()

	rawBody := []byte(`"{\"hi\": \"hi\"}\n"`)
	expected := []byte(`{"hi": "hi"}`)
	actual := Truncate(rawBody)
	if string(actual) != string(expected) {
		t.Errorf("expected %s, got %s", expected, actual)
	}

	rawBody2 := []byte(`=\\\"a`)
	expected2 := []byte(`=\"a`)
	actual2 := Truncate(rawBody2)
	if string(actual2) != string(expected2) {
		t.Errorf("expected %s, got %s", expected2, actual2)
	}

	rawBody3 := []byte(`a=\\\"123\\\"\"}`)
	expecte3 := []byte(`a=\"123\""}`)
	actual3 := Truncate(rawBody3)
	if string(actual3) != string(expecte3) {
		t.Errorf("expected %s, got %s", expecte3, actual3)
	}
}

func TestParseSnsEvent(t *testing.T) {
	t.Parallel()

	testCampaignId := "test-campaign-id-1"
	testDonorId := "test-donor-id-1"
	testEmailId := "test-email-id-1"
	replacer := strings.NewReplacer(
		"test-campaign-id", testCampaignId,
		"test-donor-id", testDonorId,
		"test-message-id", testEmailId,
	)
	rawString := `{
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
	rawBody := []byte(replacer.Replace(rawString))
	campaignId, donorId, emailId, status, err := ParseSnsEvent(rawBody)
	if err != nil {
		t.Errorf("ParseSnsEvent unexpectedly produced an error: %v", err)
	}
	if campaignId != testCampaignId {
		t.Errorf("expected %v, got %v", testCampaignId, campaignId)
	}
	if donorId != testDonorId {
		t.Errorf("expected %v, got %v", testDonorId, donorId)
	}
	if emailId != testEmailId {
		t.Errorf("expected %v, got %v", testEmailId, emailId)
	}
	if status != "sent" {
		t.Errorf("expected sent, got %v", status)
	}

	testCampaignId2 := "test-campaign-id-2"
	testDonorId2 := "test-donor-id-2"
	testEmailId2 := "test-email-id-2"
	replacer2 := strings.NewReplacer(
		"test-campaign-id", testCampaignId2,
		"test-donor-id", testDonorId2,
		"test-message-id", testEmailId2,
	)
	rawString2 := `{
  "Type" : "Notification",
  "MessageId" : "test-sns-message-id",
  "TopicArn" : "arn:aws:sns:test-region:test-iam-id:ses-events",
  "Subject" : "Amazon SES Email Event Notification",
  "Message" : "{\"eventType\":\"Delivery\",\"mail\":{\"timestamp\":\"2024-03-13T11:43:00.921Z\",\"source\":\"noreply@test.online\",\"sourceArn\":\"arn:aws:ses:test-region:test-iam-id:identity/test.online\",\"sendingAccountId\":\"test-iam-id\",\"messageId\":\"test-message-id\",\"destination\":[\"test-recipient@test.com\"],\"headersTruncated\":false,\"headers\":[{\"name\":\"Content-Type\",\"value\":\"multipart/mixed; boundary=\\\"--_NmP-0b57f7edc3548775-Part_1\\\"\"},{\"name\":\"X-Ses-Configuration-Set\",\"value\":\"test-sns-config-set\"},{\"name\":\"X-Data-Campaign-ID\",\"value\":\"test-campaign-id\"},{\"name\":\"X-Data-Donor-ID\",\"value\":\"test-donor-id\"},{\"name\":\"From\",\"value\":\"Test-Company <noreply@test.online>\"},{\"name\":\"To\",\"value\":\"test-recipient@test.com\"},{\"name\":\"Subject\",\"value\":\"Your 2024 Test-Company Donation Receipt\"},{\"name\":\"Message-ID\",\"value\":\"<test-message-id@test.online>\"},{\"name\":\"Date\",\"value\":\"Wed, 13 Mar 2024 11:43:00 +0000\"},{\"name\":\"MIME-Version\",\"value\":\"1.0\"}],\"commonHeaders\":{\"from\":[\"Test-Company <noreply@test.online>\"],\"date\":\"Wed, 13 Mar 2024 11:43:00 +0000\",\"to\":[\"test-recipient@test.com\"],\"messageId\":\"test-message-id\",\"subject\":\"Your 2024 Test-Company Donation Receipt\"},\"tags\":{\"ses:source-tls-version\":[\"TLSv1.3\"],\"ses:operation\":[\"SendRawEmail\"],\"ses:configuration-set\":[\"test-sns-config-set\"],\"ses:source-ip\":[\"test.ip\"],\"ses:from-domain\":[\"test.online\"],\"ses:caller-identity\":[\"test-role\"],\"ses:outgoing-ip\":[\"test.outgoing.ip\"]}},\"delivery\":{\"timestamp\":\"2024-03-13T11:43:02.183Z\",\"processingTimeMillis\":1261,\"recipients\":[\"test-recipient@test.com\"],\"smtpResponse\":\"250 2.0.0 OK  1710330182 y13-20020a05622a164d00b0042f08d92d89si9642658qtj.476 - gsmtp\",\"reportingMTA\":\"test.smtp-out.test-region.amazonses.com\"}}\n",
  "Timestamp" : "2024-03-13T11:43:02.262Z",
  "SignatureVersion" : "1",
  "Signature" : "test-signature-data-url",
  "SigningCertURL" : "https://sns.test-region.amazonaws.com",
  "UnsubscribeURL" : "https://sns.test-region.amazonaws.com"
}`
	rawBody2 := []byte(replacer2.Replace(rawString2))
	campaignId2, donorId2, emailId2, status2, err2 := ParseSnsEvent(rawBody2)
	if err2 != nil {
		t.Errorf("ParseSnsEvent unexpectedly produced an error: %v", err)
	}
	if campaignId2 != testCampaignId2 {
		t.Errorf("expected %v, got %v", testCampaignId2, campaignId)
	}
	if donorId2 != testDonorId2 {
		t.Errorf("expected %v, got %v", testDonorId2, donorId)
	}
	if emailId2 != testEmailId2 {
		t.Errorf("expected %v, got %v", testEmailId2, emailId2)
	}
	if status2 != "delivered" {
		t.Errorf("expected delivered, got %v", status)
	}
}
