export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export abstract class DomainEvent {
  readonly occurredAt = new Date();
}

export abstract class Entity {
  private readonly _events: DomainEvent[] = [];
  protected addDomainEvent(e: DomainEvent) {
    this._events.push(e);
  }
  domainEvents() {
    return [...this._events];
  }
  clearDomainEvents() {
    this._events.length = 0;
  }
}

export type DomainHandler = (event: any) => void | Promise<void>;

export class EventMediator {
  private readonly handlers = new Map<Function, DomainHandler[]>();
  register(eventType: Function, handler: DomainHandler) {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }
  async dispatch(events: DomainEvent[]) {
    for (const event of events) {
      for (const h of this.handlers.get(event.constructor) || []) {
        await h(event);
      }
    }
  }
}
