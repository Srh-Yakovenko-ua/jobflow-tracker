export class FakeDependency {
  up = true;
  closed = false;

  isUp(): Promise<boolean> {
    return Promise.resolve(this.up);
  }

  onModuleDestroy(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}
