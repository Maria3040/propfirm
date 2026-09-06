package domain

import "github.com/Maria3040/propfirm/backend-go/internal/sharedkernel"

type Wallet struct {
	TraderID         string
	AvailableBalance float64
}

func (w *Wallet) Credit(amount float64) error {
	if amount <= 0 {
		return sharedkernel.NewDomainError("credit must be positive")
	}
	w.AvailableBalance += amount
	return nil
}

func (w *Wallet) Debit(amount float64) error {
	if amount <= 0 {
		return sharedkernel.NewDomainError("debit must be positive")
	}
	if amount > w.AvailableBalance {
		return sharedkernel.NewDomainError("insufficient balance")
	}
	w.AvailableBalance -= amount
	return nil
}

const (
	PayoutPending  = "Pending"
	PayoutApproved = "Approved"
	PayoutRejected = "Rejected"
)
