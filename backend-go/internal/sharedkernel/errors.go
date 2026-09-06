package sharedkernel

import "fmt"

type DomainError struct {
	Message string
}

func (e DomainError) Error() string { return e.Message }

func NewDomainError(msg string) error {
	return DomainError{Message: msg}
}

func Errf(format string, args ...any) error {
	return DomainError{Message: fmt.Sprintf(format, args...)}
}
