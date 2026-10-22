export const FAKE_TRANSACTION = { name: 'fake transaction' };

export class FakePrisma {
  $transaction<T>(work: (client: typeof FAKE_TRANSACTION) => Promise<T>): Promise<T> {
    return work(FAKE_TRANSACTION);
  }
}
