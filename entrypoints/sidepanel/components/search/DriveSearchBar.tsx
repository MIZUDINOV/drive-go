import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type { Subscription } from "rxjs";
import { Search } from "@kobalte/core/search";
import { Select } from "@kobalte/core/select";
import { Button } from "@kobalte/core/button";
import { FileTypeIcon } from "../../fileTypes";
import type { DriveApiFile } from "../drive/driveTypes";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
  openDriveItemInNewTab,
} from "../../services/driveApi";
import { createDriveSearchStream } from "../../services/driveSearchStream";
import { useI18n } from "../../../shared/i18n";

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
  "forms",
  "archives",
  "audio",
  "videos",
  "vids",
];

const TYPE_MIME: Partial<Record<DriveSearchFilters["type"], string>> = {
  folders: "application/vnd.google-apps.folder",
  documents: "application/vnd.google-apps.document",
  spreadsheets: "application/vnd.google-apps.spreadsheet",
  presentations: "application/vnd.google-apps.presentation",
  pdf: "application/pdf",
  images: "image/png",
  forms: "application/vnd.google-apps.form",
  archives: "application/zip",
  audio: "audio/mpeg",
  videos: "video/mp4",
  vids: "application/vnd.google-apps.vid",
};

const OWNER_OPTIONS: DriveSearchFilters["owner"][] = ["all", "me"];

const MODIFIED_OPTIONS: DriveSearchFilters["modified"][] = [
  "any",
  "7d",
  "30d",
  "365d",
];

const FILTER_MENU_CONTENT_CLASS = "drive-search-filter-menu-content";
const FILTER_MENU_CONTENT_SELECTOR = `.${FILTER_MENU_CONTENT_CLASS}`;

function isDefaultSearchFilters(filters: DriveSearchFilters): boolean {
  return (
    filters.type === DEFAULT_DRIVE_SEARCH_FILTERS.type &&
    filters.owner === DEFAULT_DRIVE_SEARCH_FILTERS.owner &&
    filters.modified === DEFAULT_DRIVE_SEARCH_FILTERS.modified
  );
}

type FilterSelectProps<T extends string> = {
  label: string;
  ariaLabel: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  iconMimeTypes?: Partial<Record<T, string>>;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
  onCloseAutoFocus: (event: Event) => void;
};

function FilterSelect<T extends string>(props: FilterSelectProps<T>) {
  return (
    <label class="drive-search-filter">
      <span>{props.label}</span>
      <Select<T>
        value={props.value}
        options={props.options}
        optionValue={(option) => option}
        optionTextValue={(option) => props.labels[option]}
        onOpenChange={props.onOpenChange}
        onChange={(next) => {
          if (next) {
            props.onChange(next);
          }
        }}
        itemComponent={(itemProps) => {
          const option = itemProps.item.rawValue as T;
          const iconMimeType = props.iconMimeTypes?.[option];

          return (
            <Select.Item
              item={itemProps.item}
              class="drive-search-filter-type-item"
            >
              <Show when={iconMimeType !== undefined}>
                <span
                  class="drive-search-filter-type-item-icon"
                  aria-hidden="true"
                >
                  <FileTypeIcon
                    mimeType={iconMimeType ?? "application/octet-stream"}
                  />
                </span>
              </Show>

              <Select.ItemLabel class="drive-search-filter-type-item-label">
                {props.labels[option]}
              </Select.ItemLabel>

              <Select.ItemIndicator class="drive-search-filter-type-item-indicator">
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
              </Select.ItemIndicator>
            </Select.Item>
          );
        }}
      >
        <Select.Trigger
          class="drive-search-filter-type-trigger"
          aria-label={props.ariaLabel}
        >
          <Select.Value class="drive-search-filter-type-value">
            {(state) =>
              state.selectedOption()
                ? props.labels[state.selectedOption() as T]
                : ""
            }
          </Select.Value>
          <Select.Icon>
            <span class="material-symbols-rounded">expand_more</span>
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            class={`drive-search-filter-type-content ${FILTER_MENU_CONTENT_CLASS}`}
            onCloseAutoFocus={props.onCloseAutoFocus}
          >
            <Select.Listbox class="drive-search-filter-type-listbox" />
          </Select.Content>
        </Select.Portal>
      </Select>
    </label>
  );
}

export function DriveSearchBar(props: DriveSearchBarProps) {
  const { locale, t } = useI18n();
  const searchStream = createDriveSearchStream();
  const subscriptions: Subscription[] = [];
  const [results, setResults] = createSignal<DriveApiFile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = createSignal(false);
  const [isOwnerMenuOpen, setIsOwnerMenuOpen] = createSignal(false);
  const [isModifiedMenuOpen, setIsModifiedMenuOpen] = createSignal(false);
  let searchControlRef: HTMLDivElement | undefined;
  let filtersRef: HTMLDivElement | undefined;
  let suppressAutoClose = false;
  let shouldResetFiltersOnClose = false;

  const typeLabels = createMemo<Record<DriveSearchFilters["type"], string>>(
    () => ({
      all: t("drive.filter.type.all"),
      folders: t("drive.filter.type.folders"),
      documents: t("drive.filter.type.documents"),
      spreadsheets: t("drive.filter.type.spreadsheets"),
      presentations: t("drive.filter.type.presentations"),
      pdf: t("drive.filter.type.pdf"),
      images: t("drive.filter.type.images"),
      forms: t("drive.filter.type.forms"),
      archives: t("drive.filter.type.archives"),
      audio: t("drive.filter.type.audio"),
      videos: t("drive.filter.type.videos"),
      vids: t("drive.filter.type.vids"),
    }),
  );

  const ownerLabels = createMemo<Record<DriveSearchFilters["owner"], string>>(
    () => ({
      all: t("drive.filter.owner.all"),
      me: t("drive.filter.owner.me"),
    }),
  );

  const modifiedLabels = createMemo<
    Record<DriveSearchFilters["modified"], string>
  >(() => ({
    any: t("drive.filter.modified.any"),
    "7d": t("drive.filter.modified.7d"),
    "30d": t("drive.filter.modified.30d"),
    "365d": t("drive.filter.modified.365d"),
  }));

  const formatDate = (dateIso?: string): string => {
    if (!dateIso) {
      return "";
    }

    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString(locale() === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

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

  const resetFiltersOnCloseAfterClear = () => {
    if (!isDefaultSearchFilters(props.filters)) {
      props.onFiltersChange(DEFAULT_DRIVE_SEARCH_FILTERS);
    }
  };

  const shouldKeepPanelOpen = (target: EventTarget | null): boolean =>
    target instanceof Element
      ? Boolean(
          searchControlRef?.contains(target) ||
          filtersRef?.contains(target) ||
          target.closest(FILTER_MENU_CONTENT_SELECTOR),
        )
      : false;

  const requestFiltersResetOnClose = () => {
    shouldResetFiltersOnClose = true;
  };

  const clearPendingFiltersReset = () => {
    shouldResetFiltersOnClose = false;
  };

  const tryResetFiltersOnClose = () => {
    if (!shouldResetFiltersOnClose || queryText().length > 0) {
      return;
    }

    resetFiltersOnCloseAfterClear();
    clearPendingFiltersReset();
  };

  const queryText = createMemo(() => props.value.trim());

  const hasQuery = createMemo(() => queryText().length > 0);

  const isAnyMenuOpen = createMemo(
    () => isTypeMenuOpen() || isOwnerMenuOpen() || isModifiedMenuOpen(),
  );

  const handleSelectOpenChange = (
    setter: (value: boolean) => void,
    nextOpen: boolean,
  ) => {
    setter(nextOpen);

    if (!nextOpen && props.active && hasQuery()) {
      keepPanelOpenDuringMenuTransition();
    }
  };

  const handleSearchOpenChange = (open: boolean) => {
    if (!open && (suppressAutoClose || isAnyMenuOpen())) {
      return;
    }

    setIsOpen(open);

    if (!open) {
      tryResetFiltersOnClose();
      return;
    }

    clearPendingFiltersReset();
  };

  const returnFocusToInput = (event: Event) => {
    event.preventDefault();
    keepPanelOpenDuringMenuTransition();
  };

  const handleInputChange = (value: string) => {
    props.onChange(value);
    if (props.active) {
      setIsOpen(value.trim().length > 0 || isAnyMenuOpen());
    }
  };

  const handleResultSelect = (value: DriveApiFile | DriveApiFile[] | null) => {
    const selected = Array.isArray(value) ? value[0] : value;
    if (!selected) {
      return;
    }

    setIsOpen(false);
    void openDriveItemInNewTab({
      id: selected.id,
      mimeType: selected.mimeType,
      webViewLink: selected.webViewLink,
    });
  };

  const getSingleOption = (option: DriveApiFile | DriveApiFile[]) =>
    Array.isArray(option) ? option[0] : option;

  onMount(() => {
    const searchSubscription = searchStream.subscribe((state) => {
      setResults(state.results);
      setLoading(state.loading);
      setIsOpen((queryText().length > 0 || isAnyMenuOpen()) && props.active);
    });

    subscriptions.push(searchSubscription);

    onCleanup(() => {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }

      subscriptions.length = 0;
      searchStream.dispose();
      setLoading(false);
    });
  });

  createEffect(() => {
    searchStream.setActive(props.active);
  });

  createEffect(() => {
    searchStream.setQuery(queryText());
  });

  createEffect(() => {
    searchStream.setFilters(props.filters);
  });

  createEffect(() => {
    if (
      props.active &&
      !isOpen() &&
      !isAnyMenuOpen() &&
      queryText().length === 0
    ) {
      tryResetFiltersOnClose();
    }
  });

  return (
    <Search
      class="drive-search"
      options={results()}
      open={props.active && (isOpen() || isAnyMenuOpen())}
      allowsEmptyCollection
      triggerMode="focus"
      optionValue={(option) => getSingleOption(option)?.id ?? ""}
      optionLabel={(option) => getSingleOption(option)?.name ?? ""}
      optionTextValue={(option) => getSingleOption(option)?.name ?? ""}
      onOpenChange={handleSearchOpenChange}
      onInputChange={handleInputChange}
      onChange={handleResultSelect}
      itemComponent={(itemProps) => {
        const result = itemProps.item.rawValue as DriveApiFile;
        return (
          <Search.Item item={itemProps.item} class="drive-search-result-item">
            <span class="drive-search-result-icon" aria-hidden="true">
              <FileTypeIcon mimeType={result.mimeType} />
            </span>
            <span class="drive-search-result-main">
              <Search.ItemLabel
                class="drive-search-result-name"
                title={result.name}
              >
                {result.name}
              </Search.ItemLabel>
              <Search.ItemDescription class="drive-search-result-meta">
                {(result.owners?.[0]?.displayName ?? "") +
                  (result.modifiedTime
                    ? ` • ${formatDate(result.modifiedTime)}`
                    : "")}
              </Search.ItemDescription>
            </span>
          </Search.Item>
        );
      }}
    >
      <Search.Control
        class="drive-search-input-wrap"
        aria-label={t("search.input.aria")}
        ref={searchControlRef}
      >
        <Search.Indicator
          loadingComponent={
            <Search.Icon
              class="drive-search-icon drive-search-icon-loading"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-dasharray="40"
                  stroke-dashoffset="24"
                />
              </svg>
            </Search.Icon>
          }
        >
          <Search.Icon class="drive-search-icon" aria-hidden="true">
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
          </Search.Icon>
        </Search.Indicator>

        <Search.Input
          class="drive-search-input"
          placeholder={t("search.input.placeholder")}
          value={props.value}
          disabled={!props.active}
          onBlur={(event) => {
            if (
              queryText().length > 0 ||
              shouldKeepPanelOpen(event.relatedTarget)
            ) {
              return;
            }

            requestFiltersResetOnClose();
          }}
        />

        <Show when={props.value.length > 0}>
          <Button
            type="button"
            class="drive-search-clear-btn"
            aria-label={t("search.clear.aria")}
            onClick={() => {
              requestFiltersResetOnClose();
              props.onChange("");
              setResults([]);
              if (!isAnyMenuOpen()) {
                setIsOpen(false);
              }
            }}
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
          </Button>
        </Show>
      </Search.Control>

      <Search.Content
        class="drive-search-panel"
        onCloseAutoFocus={returnFocusToInput}
      >
        <div
          class="drive-search-filters"
          ref={filtersRef}
          tabIndex={-1}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              event.currentTarget.focus();
            }
          }}
          onFocusOut={(event) => {
            if (suppressAutoClose) {
              return;
            }

            if (shouldKeepPanelOpen(event.relatedTarget)) {
              return;
            }

            if (queryText().length === 0) {
              requestFiltersResetOnClose();
            }

            setIsOpen(false);
          }}
        >
          <FilterSelect
            label={t("drive.filter.type.label")}
            ariaLabel={t("drive.filter.type.aria")}
            value={props.filters.type}
            options={TYPE_OPTIONS}
            labels={typeLabels()}
            iconMimeTypes={TYPE_MIME}
            onOpenChange={(open) =>
              handleSelectOpenChange(setIsTypeMenuOpen, open)
            }
            onChange={(type) => updateFilters({ ...props.filters, type })}
            onCloseAutoFocus={returnFocusToInput}
          />

          <FilterSelect
            label={t("drive.filter.owner.label")}
            ariaLabel={t("drive.filter.owner.aria")}
            value={props.filters.owner}
            options={OWNER_OPTIONS}
            labels={ownerLabels()}
            onOpenChange={(open) =>
              handleSelectOpenChange(setIsOwnerMenuOpen, open)
            }
            onChange={(owner) => updateFilters({ ...props.filters, owner })}
            onCloseAutoFocus={returnFocusToInput}
          />

          <FilterSelect
            label={t("drive.filter.modified.label")}
            ariaLabel={t("drive.filter.modified.aria")}
            value={props.filters.modified}
            options={MODIFIED_OPTIONS}
            labels={modifiedLabels()}
            onOpenChange={(open) =>
              handleSelectOpenChange(setIsModifiedMenuOpen, open)
            }
            onChange={(modified) =>
              updateFilters({ ...props.filters, modified })
            }
            onCloseAutoFocus={returnFocusToInput}
          />
        </div>

        <div class="drive-search-results">
          <Show
            when={hasQuery()}
            fallback={
              <p class="drive-search-empty">{t("search.empty.idle")}</p>
            }
          >
            <Show
              when={!loading()}
              fallback={
                <p class="drive-search-empty">{t("search.empty.loading")}</p>
              }
            >
              <Search.Listbox class="drive-search-listbox" />
              <Search.NoResult class="drive-search-empty">
                {t("search.empty.noResults")}
              </Search.NoResult>
            </Show>
          </Show>
        </div>
      </Search.Content>
    </Search>
  );
}
