package mail

import (
	"fmt"
	"net/smtp"
)

type Sender struct {
	Host string
	Port int
	From string
}

func (s Sender) Send(to, subject, body string) error {
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		s.From, to, subject, body))
	return smtp.SendMail(addr, nil, s.From, []string{to}, msg)
}
