import { BehaviorSubject, combineLatest } from "rxjs";
import { distinctUntilChanged, map } from "rxjs/operators";

type TransferQueuePolicyControllerOptions = {
  setProcessingEnabled: (enabled: boolean) => void;
};

export class TransferQueuePolicyController {
  private readonly backgroundTransfersEnabled$ = new BehaviorSubject<boolean>(true);

  private readonly sidepanelSessionCount$ = new BehaviorSubject<number>(0);

  private readonly subscriptions = [
    combineLatest([
      this.backgroundTransfersEnabled$,
      this.sidepanelSessionCount$,
    ])
      .pipe(
        map(([backgroundEnabled, sessionCount]) => backgroundEnabled || sessionCount > 0),
        distinctUntilChanged(),
      )
      .subscribe((enabled) => {
        this.options.setProcessingEnabled(enabled);
      }),
  ];

  public constructor(private readonly options: TransferQueuePolicyControllerOptions) {}

  public setBackgroundTransfersEnabled(enabled: boolean): void {
    this.backgroundTransfersEnabled$.next(enabled);
  }

  public openSidepanelSession(): () => void {
    this.sidepanelSessionCount$.next(this.sidepanelSessionCount$.value + 1);

    let released = false;
    return () => {
      if (released) {
        return;
      }

      released = true;
      this.sidepanelSessionCount$.next(
        Math.max(0, this.sidepanelSessionCount$.value - 1),
      );
    };
  }

  public dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.backgroundTransfersEnabled$.complete();
    this.sidepanelSessionCount$.complete();
  }
}
