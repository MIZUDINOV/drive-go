import { Subject, Subscription } from "rxjs";
import { auditTime } from "rxjs/operators";

export class TransferQueueEventBus {
  private readonly snapshotChanged$ = new Subject<void>();

  public emitSnapshotChanged(): void {
    this.snapshotChanged$.next();
  }

  public subscribeSnapshotChanged(
    listener: () => Promise<void> | void,
    throttleMs: number = 120,
  ): Subscription {
    return this.snapshotChanged$
      .pipe(auditTime(throttleMs))
      .subscribe(() => {
        void listener();
      });
  }

  public dispose(): void {
    this.snapshotChanged$.complete();
  }
}
