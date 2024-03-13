package events

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
)

// Removes the first and last quotation marks if they exist.
// Also removes te escape characters for newlines and quotations.
// Works in place and returns the new slice
func Truncate(rawBody []byte) []byte {
	start := 0
	if rawBody[0] == '"' {
		start = 1
	}
	end := len(rawBody)
	if rawBody[end-1] == '"' {
		end -= 1
	}

	mv := 0
	for i := start; i < end; i++ {
		if rawBody[i] == '\\' {
			mv += 1
			if i+1 < len(rawBody) && rawBody[i+1] == 'n' {
				i += 1
				mv += 1
			}
			if i+1 < len(rawBody) && rawBody[i+1] == '\\' {
				i += 1
				rawBody[i-mv] = rawBody[i]
			}
		} else {
			rawBody[i-mv] = rawBody[i]
		}
	}
	return rawBody[start : end-mv]
}

func ParseSnsEvent(rawBody []byte) (campaignId string, donorId string, emailId string, status string, err error) {
	var parsedBody SnsEventStruct
	err2 := json.Unmarshal(rawBody, &parsedBody)
	if err2 != nil {
		fmt.Fprintln(os.Stderr, "[debug][error] error parsing body\n[debug][error] raw body:", string(rawBody))
		return "", "", "", "", err2
	}
	if parsedBody.Type != "Notification" {
		fmt.Fprintln(os.Stderr, "[debug][error] invalid type\n[debug][error] raw body:", string(rawBody))
		return "", "", "", "", errors.New("invalid type")
	}

	rawMessage := parsedBody.Message
	if len(rawMessage) == 0 {
		fmt.Fprintln(os.Stderr, "[debug][error] empty message\n[debug][error] raw body:", string(rawBody))
		return "", "", "", "", errors.New("empty message")
	}

	var parsedMessage EmailSendingEvent
	// removes newlines, etc.
	rawMessage = Truncate(rawMessage)
	err3 := json.Unmarshal(rawMessage, &parsedMessage)
	if err3 != nil {
		fmt.Fprintln(os.Stderr, "[debug][error] error parsing message\n[debug][error] raw message string:", string(rawMessage))
		return "", "", "", "", err3
	}

	rawStatus := parsedMessage.EventType
	emailId = parsedMessage.Mail.MessageID
	if rawStatus == "" || emailId == "" {
		fmt.Fprintln(os.Stderr, "[debug][error] invalid message\n[debug][error] raw message string:", string(rawMessage))
		return "", "", "", "", errors.New("invalid message")
	}

	campaignIdIdx := -1
	donorIdIdx := -1
	for i, header := range parsedMessage.Mail.Headers {
		if header.Name == "X-Data-Campaign-ID" {
			campaignIdIdx = i
		}
		if header.Name == "X-Data-Donor-ID" {
			donorIdIdx = i
		}
	}

	if campaignIdIdx == -1 || donorIdIdx == -1 {
		fmt.Fprintln(os.Stderr, "[debug][error] missing data header\n[debug][error] headers:", parsedMessage.Mail.Headers)
		return "", "", "", "", errors.New("missing data header")
	}

	campaignId = parsedMessage.Mail.Headers[campaignIdIdx].Value
	donorId = parsedMessage.Mail.Headers[donorIdIdx].Value

	status = MapSnsEvent(rawStatus)
	return
}

type SnsEventStruct struct {
	Type             string          `json:"Type"`
	MessageId        string          `json:"MessageId"`
	Token            string          `json:"Token"`
	TopicArn         string          `json:"TopicArn"`
	Message          json.RawMessage `json:"Message"` // JSON string of EmailSendingEvent
	SubscribeURL     string          `json:"SubscribeURL"`
	Timestamp        string          `json:"Timestamp"`
	SignatureVersion string          `json:"SignatureVersion"`
	Signature        string          `json:"Signature"`
	SigningCertURL   string          `json:"SigningCertURL"`
	UnsubscribeURL   string          `json:"UnsubscribeURL"`
}

// EventType represents the type of email sending event
type EventType string

// js equivalents
// "not_sent" | "sent" | "delivered" | "delivery_delayed" | "complained" | "bounced" | "opened" | "clicked"
const (
	Bounce           EventType = "Bounce"
	Complaint                  = "Complaint"
	Delivery                   = "Delivery"
	Send                       = "Send"
	Reject                     = "Reject"
	Open                       = "Open"
	Click                      = "Click"
	RenderingFailure           = "Rendering Failure"
	DeliveryDelay              = "DeliveryDelay"
	Subscription               = "Subscription"
)

func MapSnsEvent(eventType EventType) string {
	switch eventType {
	case Bounce:
		return "bounced"
	case Reject:
		return "complained"
	case Complaint:
		return "complained"
	case RenderingFailure:
		return "complained"
	case Delivery:
		return "delivered"
	case Send:
		return "sent"
	case Open:
		return "opened"
	case Click:
		return "clicked"
	case DeliveryDelay:
		return "delivery_delayed"
	case Subscription:
		return "subscribed"
	default:
		return "not_sent"
	}
}

// EmailSendingEvent represents the top-level JSON object
type EmailSendingEvent struct {
	EventType     EventType               `json:"eventType"`
	Mail          MailObject              `json:"mail"`
	Bounce        *BounceObject           `json:"bounce,omitempty"`
	Complaint     *ComplaintObject        `json:"complaint,omitempty"`
	Delivery      *DeliveryObject         `json:"delivery,omitempty"`
	Send          *SendObject             `json:"send,omitempty"`
	Reject        *RejectObject           `json:"reject,omitempty"`
	Open          *OpenObject             `json:"open,omitempty"`
	Click         *ClickObject            `json:"click,omitempty"`
	Failure       *RenderingFailureObject `json:"failure,omitempty"`
	DeliveryDelay *DeliveryDelayObject    `json:"deliveryDelay,omitempty"`
	Subscription  *SubscriptionObject     `json:"subscription,omitempty"`
}

// MailObject represents information about the original email
type MailObject struct {
	Timestamp        string                 `json:"timestamp"`
	MessageID        string                 `json:"messageId"`
	Source           string                 `json:"source"`
	SourceArn        string                 `json:"sourceArn"`
	SendingAccountID string                 `json:"sendingAccountId"`
	Destination      []string               `json:"destination"`
	HeadersTruncated bool                   `json:"headersTruncated"`
	Headers          []Header               `json:"headers"`
	CommonHeaders    map[string]interface{} `json:"commonHeaders"` // can be a string or an array of strings
	Tags             map[string]interface{} `json:"tags"`
}

// Header represents an email header
type Header struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Tag represents a tag associated with the email
type Tag struct {
	Name  string   `json:"name"`
	Value []string `json:"value"`
}

// BounceObject represents information about a Bounce event
type BounceObject struct {
	BounceType        string             `json:"bounceType"`
	BounceSubType     string             `json:"bounceSubType"`
	BouncedRecipients []BouncedRecipient `json:"bouncedRecipients"`
	Timestamp         string             `json:"timestamp"`
	FeedbackID        string             `json:"feedbackId"`
	ReportingMTA      string             `json:"reportingMTA,omitempty"`
}

// BouncedRecipient represents information about a recipient whose email bounced
type BouncedRecipient struct {
	EmailAddress   string `json:"emailAddress"`
	Action         string `json:"action"`
	Status         string `json:"status"`
	DiagnosticCode string `json:"diagnosticCode"`
}

// ComplaintObject represents information about a Complaint event
type ComplaintObject struct {
	ComplainedRecipients  []ComplainedRecipient `json:"complainedRecipients"`
	Timestamp             string                `json:"timestamp"`
	FeedbackID            string                `json:"feedbackId"`
	ComplaintSubType      string                `json:"complaintSubType,omitempty"`
	UserAgent             string                `json:"userAgent,omitempty"`
	ComplaintFeedbackType string                `json:"complaintFeedbackType,omitempty"`
	ArrivalDate           string                `json:"arrivalDate,omitempty"`
}

// ComplainedRecipient represents information about a recipient who submitted a complaint
type ComplainedRecipient struct {
	EmailAddress string `json:"emailAddress"`
}

// DeliveryObject represents information about a Delivery event
type DeliveryObject struct {
	Timestamp            string   `json:"timestamp"`
	ProcessingTimeMillis int      `json:"processingTimeMillis"`
	Recipients           []string `json:"recipients"`
	SMTPResponse         string   `json:"smtpResponse"`
	ReportingMTA         string   `json:"reportingMTA"`
}

// SendObject represents information about a Send event
type SendObject struct{}

// RejectObject represents information about a Reject event
type RejectObject struct {
	Reason string `json:"reason"`
}

// OpenObject represents information about an Open event
type OpenObject struct {
	IPAddress string `json:"ipAddress"`
	Timestamp string `json:"timestamp"`
	UserAgent string `json:"userAgent"`
}

// ClickObject represents information about a Click event
type ClickObject struct {
	IPAddress string   `json:"ipAddress"`
	Timestamp string   `json:"timestamp"`
	UserAgent string   `json:"userAgent"`
	Link      string   `json:"link"`
	LinkTags  []string `json:"linkTags"`
}

// RenderingFailureObject represents information about a Rendering Failure event
type RenderingFailureObject struct {
	TemplateName string `json:"templateName"`
	ErrorMessage string `json:"errorMessage"`
}

// DeliveryDelayObject represents information about a DeliveryDelay event
type DeliveryDelayObject struct {
	DelayType         string             `json:"delayType"`
	DelayedRecipients []DelayedRecipient `json:"delayedRecipients"`
	ExpirationTime    string             `json:"expirationTime"`
	ReportingMTA      string             `json:"reportingMTA"`
	Timestamp         string             `json:"timestamp"`
}

// DelayedRecipient represents information about a recipient whose email delivery is delayed
type DelayedRecipient struct {
	EmailAddress   string `json:"emailAddress"`
	Status         string `json:"status"`
	DiagnosticCode string `json:"diagnosticCode"`
}

// SubscriptionObject represents information about a Subscription event
type SubscriptionObject struct {
	ContactList         string           `json:"contactList"`
	Timestamp           string           `json:"timestamp"`
	Source              string           `json:"source"`
	NewTopicPreferences TopicPreferences `json:"newTopicPreferences"`
	OldTopicPreferences TopicPreferences `json:"oldTopicPreferences"`
}

// TopicPreferences represents subscription preferences for topics
type TopicPreferences struct {
	UnsubscribeAll                 bool              `json:"unsubscribeAll"`
	TopicSubscriptionStatus        map[string]string `json:"topicSubscriptionStatus"`
	TopicDefaultSubscriptionStatus map[string]string `json:"topicDefaultSubscriptionStatus"`
}
