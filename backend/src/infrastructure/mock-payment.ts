import { v4 as uuidv4 } from 'uuid';

export class MockPaymentGateway {
  private readonly intents = new Map<string, { id: string; amount: number; status: string }>();

  create(amount: number) {
    const id = `pi_${uuidv4()}`;
    const intent = { id, amount, status: 'requires_confirmation' };
    this.intents.set(id, intent);
    return intent;
  }

  confirm(id: string) {
    const intent = this.intents.get(id);
    if (!intent) return { ok: false, error: 'intent not found' };
    intent.status = 'succeeded';
    return { ok: true, error: '' };
  }
}
