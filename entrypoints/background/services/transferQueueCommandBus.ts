import { EMPTY, Subject, from } from "rxjs";
import { catchError, concatMap, groupBy, mergeMap, tap } from "rxjs/operators";

type TransferQueueCommandPriority = "high" | "normal";

type TransferQueueCommandRequest<T> = {
  key: string;
  priority: TransferQueueCommandPriority;
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class TransferQueueCommandBus {
  private readonly highPriorityCommands$ =
    new Subject<TransferQueueCommandRequest<unknown>>();

  private readonly normalPriorityCommands$ =
    new Subject<TransferQueueCommandRequest<unknown>>();

  private readonly highPrioritySubscription = this.createLaneSubscription(
    this.highPriorityCommands$,
  );

  private readonly normalPrioritySubscription = this.createLaneSubscription(
    this.normalPriorityCommands$,
  );

  public enqueue<T>(
    key: string,
    run: () => Promise<T>,
    priority: TransferQueueCommandPriority = "normal",
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: TransferQueueCommandRequest<unknown> = {
        key,
        priority,
        run: async () => run(),
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
      };

      if (priority === "high") {
        this.highPriorityCommands$.next(request);
      } else {
        this.normalPriorityCommands$.next(request);
      }
    });
  }

  public dispose(): void {
    this.highPrioritySubscription.unsubscribe();
    this.normalPrioritySubscription.unsubscribe();
    this.highPriorityCommands$.complete();
    this.normalPriorityCommands$.complete();
  }

  private createLaneSubscription(
    lane: Subject<TransferQueueCommandRequest<unknown>>,
  ) {
    return lane
      .pipe(
        groupBy((request) => request.key),
        mergeMap((group$) =>
          group$.pipe(
            concatMap((request) =>
              from(request.run()).pipe(
                tap((result) => {
                  request.resolve(result);
                }),
                catchError((error) => {
                  request.reject(error);
                  return EMPTY;
                }),
              ),
            ),
          ),
        ),
      )
      .subscribe();
  }
}
