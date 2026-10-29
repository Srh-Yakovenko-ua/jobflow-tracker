async function grantAfter<T>(previous: Promise<unknown>, grant: () => T): Promise<Awaited<T>> {
  await previous;
  return await grant();
}

export class FakeLockManager {
  private readonly queues = new Map<string, Promise<unknown>>();

  request<T>(name: string, callback: LockGrantedCallback<T>): Promise<Awaited<T>> {
    const lock: Lock = { name, mode: 'exclusive' };
    const granted = grantAfter(this.queues.get(name) ?? Promise.resolve(), () => callback(lock));
    this.queues.set(
      name,
      granted.catch(() => undefined),
    );
    return granted;
  }
}

export function installFakeLockManager(): void {
  Object.defineProperty(navigator, 'locks', { value: new FakeLockManager(), configurable: true });
}
