package events

import "testing"

func TestTruncate(t *testing.T) {
	rawBody := []byte(`"{\"hi\": \"hi\"}\n"`)
	expected := []byte(`{"hi": "hi"}`)
	actual := Truncate(rawBody)
	if string(actual) != string(expected) {
		t.Errorf("expected %s, got %s", expected, actual)
	}
}

func TestParseSnsEvent(t *testing.T) {
	rawBody := []byte(`{
"Type" : "Notification",
"MessageId" : "test-message-id",
"TopicArn" : "arn:aws:sns:us-east-2:test-profile-id:ses-events",
"Subject" : "Amazon SES Email Event Notification",
"Message" : "{\"eventType\":\"Send\",\"mail\":{\"timestamp\":\"2024-03-11T14:47:59.955Z\",\"source\":\"email@donationreceipt.online\",\"sourceArn\":\"arn:aws:ses:us-east-2:test:identity/donationreceipt.online\",\"sendingAccountId\":\"test\",\"messageId\":\"test-message-id\",\"destination\":[\"email@simulator.amazonses.com\"],\"headersTruncated\":false,\"headers\":[{\"name\":\"Content-Type\",\"value\":\"text/plain; charset=utf-8\"},{\"name\":\"X-Ses-Configuration-Set\",\"value\":\"event-listener\"},{\"name\":\"X-Data-Campaign-ID\",\"value\":\"test-campaign-id\"},{\"name\":\"X-Data-Donor-ID\",\"value\":\"test-donor-id\"},{\"name\":\"From\",\"value\":\"contact@donationreceipt.online\"},{\"name\":\"To\",\"value\":\"success@simulator.amazonses.com\"},{\"name\":\"Subject\",\"value\":\"test\"},{\"name\":\"Message-ID\",\"value\":\"<test-email-id@donationreceipt.online>\"},{\"name\":\"Content-Transfer-Encoding\",\"value\":\"7bit\"},{\"name\":\"Date\",\"value\":\"Mon, 11 Mar 2024 14:47:59 +0000\"},{\"name\":\"MIME-Version\",\"value\":\"1.0\"}],\"commonHeaders\":{\"from\":[\"contact@donationreceipt.online\"],\"date\":\"Mon, 11 Mar 2024 14:47:59 +0000\",\"to\":[\"success@simulator.amazonses.com\"],\"messageId\":\"test-message-id\",\"subject\":\"test\"},\"tags\":{\"ses:source-tls-version\":[\"TLSv1.3\"],\"ses:operation\":[\"SendRawEmail\"],\"ses:configuration-set\":[\"event-listener\"],\"ses:source-ip\":[\"92.22.4.86\"],\"ses:from-domain\":[\"donationreceipt.online\"],\"ses:caller-identity\":[\"root\"]}},\"send\":{}}\n",
"Timestamp" : "2024-03-11T14:48:00.136Z",
"SignatureVersion" : "1",
"Signature" : "test.signature.png",
"SigningCertURL" : "https://sns.us-east-2.amazonaws.com/",
"UnsubscribeURL" : "https://sns.us-east-2.amazonaws.com/"
}`)
	campaignId, donorId, emailId, status, err := ParseSnsEvent(rawBody)
	if err != nil {
		t.Errorf("truncate unexpectedly produced an error: %v", err)
	}
	if campaignId != "test-campaign-id" {
		t.Errorf("expected test-campaign-id, got %v", campaignId)
	}
	if donorId != "test-donor-id" {
		t.Errorf("expected test-donor-id, got %v", donorId)
	}
	if emailId != "test-message-id" {
		t.Errorf("expected test-message-id, got %v", emailId)
	}
	if status != "sent" {
		t.Errorf("expected Send, got %v", status)
	}
}
