import { BehaviorSubject, EMPTY, Subject, from } from "rxjs";
import {
  auditTime,
  catchError,
  concatMap,
  distinctUntilChanged,
  filter,
  withLatestFrom,
} from "rxjs/operators";

type TransferQueueRxOrchestratorOptions = {
  runPump: () => Promise<void>;
  onDisabled: () => void;
  onError?: (error: unknown) => void;
};

export class TransferQueueRxOrchestrator {
  private readonly enabled$ = new BehaviorSubject<boolean>(true);

  private readonly pumpRequests$ = new Subject<void>();

  private readonly subscriptions = [
    this.enabled$.pipe(distinctUntilChanged()).subscribe((enabled) => {
      if (!enabled) {
        this.options.onDisabled();
      }
    }),
    this.pumpRequests$
      .pipe(
        auditTime(12),
        withLatestFrom(this.enabled$),
        filter(([, enabled]) => enabled),
        concatMap(() =>
          from(this.options.runPump()).pipe(
            catchError((error) => {
              this.options.onError?.(error);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe(),
  ];

  public constructor(
    private readonly options: TransferQueueRxOrchestratorOptions,
  ) {}

  public setProcessingEnabled(enabled: boolean): void {
    this.enabled$.next(enabled);

    if (enabled) {
      this.requestPump();
    }
  }

  public requestPump(): void {
    this.pumpRequests$.next();
  }

  public dispose(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.enabled$.complete();
    this.pumpRequests$.complete();
  }
}
