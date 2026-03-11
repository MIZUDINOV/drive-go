type DisposeCallback = () => void;

export class BackgroundLifecycle {
  private readonly disposers = new Set<DisposeCallback>();

  public add(dispose: DisposeCallback): void {
    this.disposers.add(dispose);
  }

  public disposeAll(): void {
    for (const dispose of this.disposers) {
      try {
        dispose();
      } catch {
        // noop
      }
    }

    this.disposers.clear();
  }
}
