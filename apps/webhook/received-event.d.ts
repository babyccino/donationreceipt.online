export type SNSMessage = {
  Type: string
  MessageId: string
  TopicArn: string
  Subject: string
  Message: string // JSON string of export type SESMessage
  Timestamp: string // ISO 8601
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  UnsubscribeURL: string
}

export type SESMessage = {
  eventType:
    | "Bounce"
    | "Complaint"
    | "Delivery"
    | "Send"
    | "Reject"
    | "Open"
    | "Click"
    | "Rendering Failure"
    | "DeliveryDelay"
    | "Subscription"
  mail: Mail
  bounce?: Bounce
  complaint?: Complaint
  delivery?: Delivery
  send?: {} // always empty
  reject?: Reject
  open?: Open
  click?: Click
  renderingFailure?: RenderingFailure
  deliveryDelay?: DeliveryDelay
  subscription?: Subscription
}

export type Mail = {
  timestamp: string
  source: string
  sourceArn: string
  sendingAccountId: string
  messageId: string
  destination: string[]
  headersTruncated: false
  headers: { name: string; value: string }[]
  commonHeaders: {
    from: string[]
    date: string
    to: string[]
    messageId: string
    subject: string
  }
  tags: {
    "ses:source-tls-version": string[]
    "ses:operation": string[]
    "ses:configuration-set": string[]
    "ses:source-ip": string[]
    "ses:from-domain": string[]
    "ses:caller-identity": string[]
    "ses:outgoing-ip": string[]
  }
}

export type Bounce = {
  feedbackId: string
  bounceType: string
  bounceSubType: string
  bouncedRecipients: {
    emailAddress: string
    action: string
    status: string
    diagnosticCode: string
  }[]
  timestamp: string
  reportingMTA: string
}

export type Complaint = {
  feedbackId: string
  complaintSubType: null | string
  complainedRecipients: { emailAddress: string }[]
  timestamp: string
  userAgent?: string
  complaintFeedbackType?: string
  arrivalDate?: string
}

export type Delivery = {
  timestamp: string
  processingTimeMillis: number
  recipients: string[]
  smtpResponse: string
  reportingMTA: string
}

export type Reject = { reason: string }

export type Open = {
  ipAddress: string
  timestamp: string // ISO 8601
  userAgent: string
}

export type Click = {
  ipAddress: string
  timestamp: string // ISO 8601
  userAgent: string
  link: string
  linkTags: {
    "ses:source-tls-version": string[]
    "ses:operation": string[]
    "ses:configuration-set": string[]
    "ses:source-ip": string[]
    "ses:from-domain": string[]
    "ses:caller-identity": string[]
    "ses:outgoing-ip": string[]
  }
}

export type RenderingFailure = {
  templateName: string
  errorMessage: string
}

export type DeliveryDelay = {
  delayType:
    | "InternalFailure"
    | "General"
    | "MailboxFull"
    | "SpamDetected"
    | "RecipientServerError"
    | "IPFailure"
    | "TransientCommunicationFailure"
    | "BYOIPHostNameLookupUnavailable"
    | "Undetermined"
    | "SendingDeferral"
  delayedRecipients: {
    emailAddress: string
    status: number
    diagnosticCode: string
  }
  expirationTime: string // ISO 8601
  reportingMTA: string
  timestamp: string // ISO 8601
}

export type Subscription = {
  contactList: string
  timestamp: string // ISO 8601
  source: string
  newTopicPreferences: Record<string, TopicPreferences>
  oldTopicPreferences: Record<string, TopicPreferences>
}

export type TopicPreferences = {
  unsubscribeAll?: boolean
  topicSubscriptionStatus?: "OptIn" | "OptOut"
  topicDefaultSubscriptionStatus?: "OptIn" | "OptOut"
}
