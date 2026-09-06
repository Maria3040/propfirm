type Handler = (event: unknown) => void | Promise<void>;

export class InProcessBus {
  private readonly handlers = new Map<Function, Handler[]>();
  subscribe(eventType: Function, handler: Handler) {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }
  async publish(event: object) {
    for (const h of this.handlers.get(event.constructor) || []) {
      await h(event);
    }
  }
}
