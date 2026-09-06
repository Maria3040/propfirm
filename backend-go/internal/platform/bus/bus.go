package bus

import "sync"

// In-process sync event bus (modular monolith integration events).
type Bus struct {
	mu       sync.RWMutex
	handlers map[string][]func(any) error
}

func New() *Bus {
	return &Bus{handlers: map[string][]func(any) error{}}
}

func (b *Bus) Subscribe(eventType string, h func(any) error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[eventType] = append(b.handlers[eventType], h)
}

func (b *Bus) Publish(eventType string, event any) error {
	b.mu.RLock()
	hs := append([]func(any) error{}, b.handlers[eventType]...)
	b.mu.RUnlock()
	for _, h := range hs {
		if err := h(event); err != nil {
			return err
		}
	}
	return nil
}
