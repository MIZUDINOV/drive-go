import {
  BehaviorSubject,
  Subject,
  Subscription,
  combineLatest,
  concat,
  from,
  of,
} from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
} from "rxjs/operators";
import type { DriveApiFile } from "../components/drive/driveTypes";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  searchDriveItems,
  type DriveSearchFilters,
} from "./driveApi";

export type DriveSearchState = {
  results: DriveApiFile[];
  loading: boolean;
};

type SearchRequest = {
  active: boolean;
  query: string;
  filters: DriveSearchFilters;
};

const SEARCH_DEBOUNCE_MS = 260;
const SEARCH_RESULT_LIMIT = 8;
const EMPTY_STATE: DriveSearchState = { results: [], loading: false };
const LOADING_STATE: DriveSearchState = { results: [], loading: true };

function normalizeRequest(request: SearchRequest): SearchRequest {
  return {
    active: request.active,
    query: request.query.trim(),
    filters: request.filters,
  };
}

function isSameRequest(left: SearchRequest, right: SearchRequest): boolean {
  return (
    left.active === right.active &&
    left.query === right.query &&
    left.filters.type === right.filters.type &&
    left.filters.owner === right.filters.owner &&
    left.filters.modified === right.filters.modified
  );
}

function hasActiveFilters(filters: DriveSearchFilters): boolean {
  return (
    filters.type !== DEFAULT_DRIVE_SEARCH_FILTERS.type ||
    filters.owner !== DEFAULT_DRIVE_SEARCH_FILTERS.owner ||
    filters.modified !== DEFAULT_DRIVE_SEARCH_FILTERS.modified
  );
}

export class DriveSearchStream {
  private readonly active$ = new BehaviorSubject<boolean>(false);

  private readonly query$ = new BehaviorSubject<string>("");

  private readonly filters$ = new BehaviorSubject<DriveSearchFilters>(
    DEFAULT_DRIVE_SEARCH_FILTERS,
  );

  private readonly refresh$ = new Subject<void>();

  public readonly state$ = combineLatest([
    this.active$,
    this.query$,
    this.filters$,
    this.refresh$.pipe(map(() => Date.now())),
  ]).pipe(
    debounceTime(SEARCH_DEBOUNCE_MS),
    map(([active, query, filters]) =>
      normalizeRequest({ active, query, filters }),
    ),
    distinctUntilChanged(isSameRequest),
    switchMap((request) => {
      const hasFilter = hasActiveFilters(request.filters);

      if (!request.active || (request.query.length === 0 && !hasFilter)) {
        return of<DriveSearchState>(EMPTY_STATE);
      }

      return concat(
        of<DriveSearchState>(LOADING_STATE),
        from(searchDriveItems(request.query, request.filters, SEARCH_RESULT_LIMIT)).pipe(
          map((results) => ({ results, loading: false })),
        ),
      );
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public constructor() {
    this.refresh$.next();
  }

  public setActive(active: boolean): void {
    this.active$.next(active);
  }

  public setQuery(query: string): void {
    this.query$.next(query);
  }

  public setFilters(filters: DriveSearchFilters): void {
    this.filters$.next(filters);
  }

  public refresh(): void {
    this.refresh$.next();
  }

  public subscribe(listener: (state: DriveSearchState) => void): Subscription {
    return this.state$.subscribe(listener);
  }

  public dispose(): void {
    this.active$.complete();
    this.query$.complete();
    this.filters$.complete();
    this.refresh$.complete();
  }
}

export function createDriveSearchStream(): DriveSearchStream {
  return new DriveSearchStream();
}
