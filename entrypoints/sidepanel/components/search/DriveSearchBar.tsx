import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { FileTypeIcon } from "../../fileTypes";
import type { DriveApiFile } from "../drive/driveTypes";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
  openDriveItemInNewTab,
  searchDriveItems,
} from "../../services/driveApi";

type DriveSearchBarProps = {
  value: string;
  filters: DriveSearchFilters;
  active: boolean;
  onChange: (value: string) => void;
  onFiltersChange: (filters: DriveSearchFilters) => void;
};

const TYPE_OPTIONS: DriveSearchFilters["type"][] = [
  "all",
  "folders",
  "documents",
  "spreadsheets",
  "presentations",
  "pdf",
  "images",
];

const TYPE_LABEL: Record<DriveSearchFilters["type"], string> = {
  all: "Все",
  folders: "Папки",
  documents: "Документы",
  spreadsheets: "Таблицы",
  presentations: "Презентации",
  pdf: "PDF",
  images: "Изображения",
};

const TYPE_MIME: Partial<Record<DriveSearchFilters["type"], string>> = {
  folders: "application/vnd.google-apps.folder",
  documents: "application/vnd.google-apps.document",
  spreadsheets: "application/vnd.google-apps.spreadsheet",
  presentations: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  images: "image/png",
};

const OWNER_OPTIONS: DriveSearchFilters["owner"][] = ["all", "me"];

const OWNER_LABEL: Record<DriveSearchFilters["owner"], string> = {
  all: "Все",
  me: "Я",
};

const MODIFIED_OPTIONS: DriveSearchFilters["modified"][] = [
  "any",
  "7d",
  "30d",
  "365d",
];

const MODIFIED_LABEL: Record<DriveSearchFilters["modified"], string> = {
  any: "Любое время",
  "7d": "7 дней",
  "30d": "30 дней",
  "365d": "1 год",
};

function formatDate(dateIso?: string): string {
  if (!dateIso) {
    return "";
  }

  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isDefaultFilters(filters: DriveSearchFilters): boolean {
  return (
    filters.type === DEFAULT_DRIVE_SEARCH_FILTERS.type &&
    filters.owner === DEFAULT_DRIVE_SEARCH_FILTERS.owner &&
    filters.modified === DEFAULT_DRIVE_SEARCH_FILTERS.modified
  );
}

export function DriveSearchBar(props: DriveSearchBarProps) {
  const [results, setResults] = createSignal<DriveApiFile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = createSignal(false);
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = createSignal(false);
  const [isModifiedMenuOpen, setIsModifiedMenuOpen] = createSignal(false);
  let rootRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;
  let filtersRef: HTMLDivElement | undefined;
  let suppressAutoClose = false;

  const keepPanelOpenDuringMenuTransition = () => {
    suppressAutoClose = true;
    setIsOpen(true);
    window.setTimeout(() => {
      suppressAutoClose = false;
    }, 0);
  };

  const updateFilters = (nextFilters: DriveSearchFilters) => {
    keepPanelOpenDuringMenuTransition();
    props.onFiltersChange(nextFilters);
  };

  const shouldKeepPanelOpen = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) {
      return false;
    }

    if (rootRef?.contains(target)) {
      return true;
    }

    if (inputRef === target) {
      return true;
    }

    if (filtersRef?.contains(target)) {
      return true;
    }

    return Boolean(target.closest(".drive-search-filter-menu-content"));
  };

  const queryText = createMemo(() => props.value.trim());

  const hasQuery = createMemo(() => queryText().length > 0);

  const isAnyMenuOpen = createMemo(
    () => isTypeMenuOpen() || isOwnerMenuOpen() || isModifiedMenuOpen(),
  );

  const handleMenuOpenChange = (
    setter: (value: boolean) => void,
    nextOpen: boolean,
  ) => {
    setter(nextOpen);
  };

  const returnFocusToInput = (event: Event) => {
    event.preventDefault();
    keepPanelOpenDuringMenuTransition();
    inputRef?.focus();
  };

  createEffect(() => {
    const query = queryText();
    const filters = props.filters;

    if (!props.active) {
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      return;
    }

    if (query.length === 0) {
      setResults([]);
      setLoading(false);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    const timeoutId = window.setTimeout(async () => {
      const found = await searchDriveItems(query, filters, 8);
      setResults(found);
      setLoading(false);
      setIsOpen(true);
    }, 260);

    onCleanup(() => {
      window.clearTimeout(timeoutId);
      setLoading(false);
    });
  });

  return (
    <div class="drive-search" ref={rootRef}>
      <div class="drive-search-input-wrap">
        <span class="drive-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle
              cx="11"
              cy="11"
              r="7"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M20 20l-4.2-4.2"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="2"
            />
          </svg>
        </span>

        <input
          class="drive-search-input"
          ref={inputRef}
          type="search"
          placeholder="Поиск в Google Drive"
          value={props.value}
          onFocus={() => {
            if (props.active && hasQuery()) {
              setIsOpen(true);
            }
          }}
          onBlur={(event) => {
            if (suppressAutoClose) {
              return;
            }

            if (
              isAnyMenuOpen() &&
              event.relatedTarget instanceof Node &&
              rootRef?.contains(event.relatedTarget)
            ) {
              return;
            }

            if (shouldKeepPanelOpen(event.relatedTarget)) {
              return;
            }

            // Wait one tick because menu focus can be moved via portal after blur.
            window.setTimeout(() => {
              if (shouldKeepPanelOpen(document.activeElement)) {
                return;
              }

              setIsOpen(false);
            }, 0);
          }}
          onInput={(event) => props.onChange(event.currentTarget.value)}
          disabled={!props.active}
        />

        <Show when={props.value.length > 0}>
          <button
            type="button"
            class="drive-search-clear-btn"
            aria-label="Очистить поиск"
            onClick={() => props.onChange("")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="2"
              />
            </svg>
          </button>
        </Show>
      </div>

      <Show when={props.active && isOpen()}>
        <div class="drive-search-panel">
          <div
            class="drive-search-filters"
            ref={filtersRef}
            tabindex="-1"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                event.currentTarget.focus();
              }
            }}
            onFocusOut={(event) => {
              if (suppressAutoClose) {
                return;
              }

              if (
                isAnyMenuOpen() &&
                event.relatedTarget instanceof Node &&
                rootRef?.contains(event.relatedTarget)
              ) {
                return;
              }

              if (shouldKeepPanelOpen(event.relatedTarget)) {
                return;
              }

              setIsOpen(false);
            }}
          >
            <label class="drive-search-filter">
              <span>Тип</span>
              <DropdownMenu
                sameWidth
                gutter={4}
                onOpenChange={(open) =>
                  handleMenuOpenChange(setIsTypeMenuOpen, open)
                }
              >
                <DropdownMenu.Trigger
                  class="drive-search-filter-type-trigger"
                  aria-label="Фильтр по типу"
                >
                  <span class="drive-search-filter-type-value">
                    {TYPE_LABEL[props.filters.type]}
                  </span>
                  <DropdownMenu.Icon>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M7 10l5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </DropdownMenu.Icon>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    class="drive-search-filter-type-content drive-search-filter-menu-content"
                    onCloseAutoFocus={returnFocusToInput}
                  >
                    <DropdownMenu.RadioGroup
                      value={props.filters.type}
                      onChange={(value) =>
                        updateFilters({
                          ...props.filters,
                          type: value as DriveSearchFilters["type"],
                        })
                      }
                    >
                      <For each={TYPE_OPTIONS}>
                        {(option) => (
                          <DropdownMenu.RadioItem
                            class="drive-search-filter-type-item"
                            value={option}
                            textValue={TYPE_LABEL[option]}
                            closeOnSelect
                          >
                            <span
                              class="drive-search-filter-type-item-icon"
                              aria-hidden="true"
                            >
                              <Show
                                when={TYPE_MIME[option]}
                                fallback={
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                      d="M6 7h12M6 12h12M6 17h12"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-linecap="round"
                                      stroke-width="1.8"
                                    />
                                  </svg>
                                }
                              >
                                <FileTypeIcon
                                  mimeType={
                                    TYPE_MIME[option] ??
                                    "application/octet-stream"
                                  }
                                />
                              </Show>
                            </span>
                            <DropdownMenu.ItemLabel>
                              {TYPE_LABEL[option]}
                            </DropdownMenu.ItemLabel>
                            <DropdownMenu.ItemIndicator class="drive-search-filter-type-item-indicator">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M5 13l4 4L19 7"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                />
                              </svg>
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        )}
                      </For>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
            </label>

            <label class="drive-search-filter">
              <span>Люди</span>
              <DropdownMenu
                sameWidth
                gutter={4}
                onOpenChange={(open) =>
                  handleMenuOpenChange(setIsOwnerMenuOpen, open)
                }
              >
                <DropdownMenu.Trigger
                  class="drive-search-filter-type-trigger"
                  aria-label="Фильтр по владельцу"
                >
                  <span class="drive-search-filter-type-value">
                    {OWNER_LABEL[props.filters.owner]}
                  </span>
                  <DropdownMenu.Icon>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M7 10l5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </DropdownMenu.Icon>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    class="drive-search-filter-type-content drive-search-filter-menu-content"
                    onCloseAutoFocus={returnFocusToInput}
                  >
                    <DropdownMenu.RadioGroup
                      value={props.filters.owner}
                      onChange={(value) =>
                        updateFilters({
                          ...props.filters,
                          owner: value as DriveSearchFilters["owner"],
                        })
                      }
                    >
                      <For each={OWNER_OPTIONS}>
                        {(option) => (
                          <DropdownMenu.RadioItem
                            class="drive-search-filter-type-item"
                            value={option}
                            textValue={OWNER_LABEL[option]}
                            closeOnSelect
                          >
                            <DropdownMenu.ItemLabel>
                              {OWNER_LABEL[option]}
                            </DropdownMenu.ItemLabel>
                            <DropdownMenu.ItemIndicator class="drive-search-filter-type-item-indicator">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M5 13l4 4L19 7"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                />
                              </svg>
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        )}
                      </For>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
            </label>

            <label class="drive-search-filter">
              <span>Изменено</span>
              <DropdownMenu
                sameWidth
                gutter={4}
                onOpenChange={(open) =>
                  handleMenuOpenChange(setIsModifiedMenuOpen, open)
                }
              >
                <DropdownMenu.Trigger
                  class="drive-search-filter-type-trigger"
                  aria-label="Фильтр по дате изменения"
                >
                  <span class="drive-search-filter-type-value">
                    {MODIFIED_LABEL[props.filters.modified]}
                  </span>
                  <DropdownMenu.Icon>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M7 10l5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </DropdownMenu.Icon>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    class="drive-search-filter-type-content drive-search-filter-menu-content"
                    onCloseAutoFocus={returnFocusToInput}
                  >
                    <DropdownMenu.RadioGroup
                      value={props.filters.modified}
                      onChange={(value) =>
                        updateFilters({
                          ...props.filters,
                          modified: value as DriveSearchFilters["modified"],
                        })
                      }
                    >
                      <For each={MODIFIED_OPTIONS}>
                        {(option) => (
                          <DropdownMenu.RadioItem
                            class="drive-search-filter-type-item"
                            value={option}
                            textValue={MODIFIED_LABEL[option]}
                            closeOnSelect
                          >
                            <DropdownMenu.ItemLabel>
                              {MODIFIED_LABEL[option]}
                            </DropdownMenu.ItemLabel>
                            <DropdownMenu.ItemIndicator class="drive-search-filter-type-item-indicator">
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  d="M5 13l4 4L19 7"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                  stroke-width="2"
                                />
                              </svg>
                            </DropdownMenu.ItemIndicator>
                          </DropdownMenu.RadioItem>
                        )}
                      </For>
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu>
            </label>
          </div>

          <div class="drive-search-results">
            <Show
              when={hasQuery()}
              fallback={
                <p class="drive-search-empty">
                  Введите запрос или выберите фильтры.
                </p>
              }
            >
              <Show
                when={!loading()}
                fallback={<p class="drive-search-empty">Поиск...</p>}
              >
                <Show
                  when={results().length > 0}
                  fallback={
                    <p class="drive-search-empty">Ничего не найдено.</p>
                  }
                >
                  <For each={results()}>
                    {(result) => (
                      <button
                        type="button"
                        class="drive-search-result-item"
                        onClick={() => {
                          setIsOpen(false);
                          void openDriveItemInNewTab({
                            id: result.id,
                            mimeType: result.mimeType,
                            webViewLink: result.webViewLink,
                          });
                        }}
                      >
                        <span
                          class="drive-search-result-icon"
                          aria-hidden="true"
                        >
                          <FileTypeIcon mimeType={result.mimeType} />
                        </span>
                        <span class="drive-search-result-main">
                          <span
                            class="drive-search-result-name"
                            title={result.name}
                          >
                            {result.name}
                          </span>
                          <span class="drive-search-result-meta">
                            {(result.owners?.[0]?.displayName ?? "") +
                              (result.modifiedTime
                                ? ` • ${formatDate(result.modifiedTime)}`
                                : "")}
                          </span>
                        </span>
                      </button>
                    )}
                  </For>
                </Show>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
