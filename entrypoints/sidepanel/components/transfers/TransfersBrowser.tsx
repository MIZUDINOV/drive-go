import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Button } from "@kobalte/core/button";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Select } from "@kobalte/core/select";
import { TextField } from "@kobalte/core/text-field";
import { Tooltip } from "@kobalte/core/tooltip";
import { ToggleGroup } from "@kobalte/core/toggle-group";
import {
  cancelTransferQueueItem,
  clearTransferHistory,
  listTransferQueueSnapshot,
  removeTransferQueueItem,
  retryTransferQueueItem,
  subscribeTransferQueueSnapshots,
} from "../../services/transferQueueClient";
import type {
  TransferHistoryItem,
  TransferQueueItem,
} from "../../../shared/transferQueueTypes";
import { type Locale, useI18n } from "../../../shared/i18n";
import "./Transfers.css";

type TransferFilter = "all" | "uploaded" | "downloaded";
type TransferSort = "newest" | "oldest" | "name-asc" | "size-desc";

const SORT_OPTIONS: TransferSort[] = [
  "newest",
  "oldest",
  "name-asc",
  "size-desc",
];

function isTransferFilter(value: string): value is TransferFilter {
  return value === "all" || value === "uploaded" || value === "downloaded";
}

type TransferListItem =
  | {
      id: string;
      kind: "queue";
      direction: TransferQueueItem["direction"];
      name: string;
      sizeBytes: number;
      parentName: string;
      statusText: string;
      isActive: boolean;
      hasError: boolean;
      createdAt: number;
      action: "cancel" | "retry" | "remove" | null;
      subtitle: string;
    }
  | {
      id: string;
      kind: "history";
      direction: TransferHistoryItem["direction"];
      name: string;
      sizeBytes: number;
      parentName: string;
      statusText: string;
      isActive: boolean;
      hasError: boolean;
      createdAt: number;
      action: "remove";
      subtitle: string;
    };

function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(timestamp: number, locale: Locale): string {
  const localeTag = locale === "ru" ? "ru-RU" : "en-US";

  return new Date(timestamp).toLocaleString(localeTag, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function queueStatusText(
  item: TransferQueueItem,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (item.status === "pending") return t("transfers.status.pending");
  if (item.status === "uploading") {
    const percent =
      item.sizeBytes > 0
        ? Math.round((item.progressBytes / item.sizeBytes) * 100)
        : 0;
    return t("transfers.status.uploading", {
      percent: String(Math.min(100, Math.max(0, percent))),
    });
  }
  if (item.status === "downloading") return t("transfers.status.downloading");
  if (item.status === "cancelled") return t("transfers.status.cancelled");
  return t("transfers.status.error");
}

function mapQueueItem(
  item: TransferQueueItem,
  t: ReturnType<typeof useI18n>["t"],
  locale: Locale,
): TransferListItem {
  const action =
    item.status === "uploading" || item.status === "pending"
      ? "cancel"
      : item.status === "error" || item.status === "cancelled"
        ? "retry"
        : null;

  const subtitle = item.errorMessage ?? formatDateTime(item.updatedAt, locale);

  return {
    id: item.id,
    kind: "queue",
    direction: item.direction,
    name: item.name,
    sizeBytes: item.sizeBytes,
    parentName: item.parentName || item.parentId || t("transfers.parent.root"),
    statusText: queueStatusText(item, t),
    isActive:
      item.status === "uploading" ||
      item.status === "pending" ||
      item.status === "downloading",
    hasError: item.status === "error",
    createdAt: item.createdAt,
    action,
    subtitle,
  };
}

function mapHistoryItem(
  item: TransferHistoryItem,
  t: ReturnType<typeof useI18n>["t"],
  locale: Locale,
): TransferListItem {
  return {
    id: item.id,
    kind: "history",
    direction: item.direction,
    name: item.name,
    sizeBytes: item.sizeBytes,
    parentName: item.parentName || item.parentId || t("transfers.parent.root"),
    statusText: t("transfers.status.completed"),
    isActive: false,
    hasError: false,
    createdAt: item.completedAt,
    action: "remove",
    subtitle: formatDateTime(item.completedAt, locale),
  };
}

export function TransfersBrowser() {
  const { locale, t } = useI18n();
  const sortLabels = createMemo<Record<TransferSort, string>>(() => ({
    newest: t("transfers.sort.newest"),
    oldest: t("transfers.sort.oldest"),
    "name-asc": t("transfers.sort.nameAsc"),
    "size-desc": t("transfers.sort.sizeDesc"),
  }));
  const filterOptions = createMemo<
    Array<{ value: TransferFilter; label: string }>
  >(() => [
    { value: "all", label: t("transfers.filter.all") },
    { value: "uploaded", label: t("transfers.filter.uploaded") },
    { value: "downloaded", label: t("transfers.filter.downloaded") },
  ]);
  const [queue, setQueue] = createSignal<TransferQueueItem[]>([]);
  const [history, setHistory] = createSignal<TransferHistoryItem[]>([]);
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [filter, setFilter] = createSignal<TransferFilter>("all");
  const [sort, setSort] = createSignal<TransferSort>("newest");
  const [search, setSearch] = createSignal("");

  const loadSnapshot = async () => {
    try {
      const snapshot = await listTransferQueueSnapshot();
      setQueue(snapshot.queue);
      setHistory(snapshot.history);
      setError(null);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : t("transfers.error.load"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  onMount(() => {
    void loadSnapshot();
    const unsubscribe = subscribeTransferQueueSnapshots((snapshot) => {
      setQueue(snapshot.queue);
      setHistory(snapshot.history);
      setError(null);
      setIsLoading(false);
    });

    onCleanup(() => {
      unsubscribe();
    });
  });

  const items = createMemo<TransferListItem[]>(() => {
    const raw = [
      ...queue().map((item) => mapQueueItem(item, t, locale())),
      ...history().map((item) => mapHistoryItem(item, t, locale())),
    ];

    const currentFilter = filter();
    const searchValue = search().trim().toLowerCase();

    return raw
      .filter((item) => {
        if (currentFilter === "uploaded") {
          return item.direction === "upload";
        }

        if (currentFilter === "downloaded") {
          return item.direction === "download";
        }

        return true;
      })
      .filter((item) =>
        searchValue.length === 0
          ? true
          : item.name.toLowerCase().includes(searchValue),
      )
      .sort((left, right) => {
        const currentSort = sort();

        if (currentSort === "oldest") {
          return left.createdAt - right.createdAt;
        }

        if (currentSort === "name-asc") {
          return left.name.localeCompare(right.name, locale());
        }

        if (currentSort === "size-desc") {
          return right.sizeBytes - left.sizeBytes;
        }

        return right.createdAt - left.createdAt;
      });
  });

  const handleClear = async (scope: "all" | "uploaded" | "downloaded") => {
    if (scope === "all") {
      await clearTransferHistory();
    } else if (scope === "uploaded") {
      await clearTransferHistory("upload");
    } else {
      await clearTransferHistory("download");
    }

    await loadSnapshot();
  };

  const handleAction = async (item: TransferListItem): Promise<void> => {
    if (item.action === "cancel") {
      await cancelTransferQueueItem(item.id);
      await loadSnapshot();
      return;
    }

    if (item.action === "retry") {
      await retryTransferQueueItem(item.id);
      await loadSnapshot();
      return;
    }

    await removeTransferQueueItem(item.id);
    await loadSnapshot();
  };

  const getTransferActionLabel = (
    action: "cancel" | "retry" | "remove",
  ): string => {
    if (action === "cancel") {
      return t("transfers.action.cancel");
    }

    if (action === "retry") {
      return t("transfers.action.retry");
    }

    return t("transfers.action.remove");
  };

  return (
    <div class="transfers-browser">
      <div class="transfers-header">
        <h2>{t("transfers.title")}</h2>
        <ToggleGroup
          class="transfers-filters"
          value={filter()}
          onChange={(value) => {
            if (typeof value === "string" && isTransferFilter(value)) {
              setFilter(value);
            }
          }}
          aria-label={t("transfers.filter.aria")}
        >
          <For each={filterOptions()}>
            {(option) => (
              <ToggleGroup.Item
                class="transfers-filter-btn"
                value={option.value}
              >
                {option.label}
              </ToggleGroup.Item>
            )}
          </For>
        </ToggleGroup>
      </div>

      <TextField class="transfers-search" value={search()} onChange={setSearch}>
        <TextField.Input
          class="transfers-search-input"
          placeholder={t("transfers.search.placeholder")}
        />
      </TextField>

      <div class="transfers-toolbar">
        <Select<TransferSort>
          options={SORT_OPTIONS}
          value={sort()}
          gutter={6}
          optionValue={(option) => option}
          optionTextValue={(option) => sortLabels()[option]}
          onChange={(next) => {
            if (next) {
              setSort(next);
            }
          }}
          itemComponent={(itemProps) => (
            <Select.Item item={itemProps.item} class="transfers-sort-item">
              <Select.ItemLabel>
                {sortLabels()[itemProps.item.rawValue as TransferSort]}
              </Select.ItemLabel>
              <Select.ItemIndicator class="transfers-sort-item-indicator">
                <span class="material-symbols-rounded">done</span>
              </Select.ItemIndicator>
            </Select.Item>
          )}
        >
          <Select.Trigger
            class="transfers-sort-trigger"
            aria-label={t("transfers.sort.aria")}
          >
            <Select.Value class="transfers-sort-value">
              {(state) =>
                state.selectedOption()
                  ? sortLabels()[state.selectedOption() as TransferSort]
                  : sortLabels().newest
              }
            </Select.Value>
            <Select.Icon class="transfers-sort-icon">
              <span class="material-symbols-rounded">expand_more</span>
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content class="transfers-sort-content">
              <Select.Listbox class="transfers-sort-listbox" />
            </Select.Content>
          </Select.Portal>
        </Select>

        <DropdownMenu gutter={6}>
          <DropdownMenu.Trigger
            class="transfers-clear-trigger"
            aria-label={t("transfers.clear.aria")}
          >
            <span>{t("transfers.clear.label")}</span>
            <DropdownMenu.Icon class="transfers-clear-trigger-icon">
              <span class="material-symbols-rounded">expand_more</span>
            </DropdownMenu.Icon>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content class="transfers-clear-content">
              <div
                class="transfers-clear-listbox"
                role="group"
                aria-label={t("transfers.clear.actionsAria")}
              >
                <DropdownMenu.Item
                  class="transfers-clear-item"
                  onSelect={() => void handleClear("all")}
                >
                  {t("transfers.clear.all")}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  class="transfers-clear-item"
                  onSelect={() => void handleClear("uploaded")}
                >
                  {t("transfers.clear.uploaded")}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  class="transfers-clear-item"
                  onSelect={() => void handleClear("downloaded")}
                >
                  {t("transfers.clear.downloaded")}
                </DropdownMenu.Item>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>

      <Show when={error()}>
        <div class="transfers-error">{error()}</div>
      </Show>

      <Show
        when={!isLoading() && items().length > 0}
        fallback={<div class="transfers-empty">{t("transfers.empty")}</div>}
      >
        <div class="transfers-list">
          <For each={items()}>
            {(item) => (
              <div class={`transfer-item ${item.isActive ? "is-active" : ""}`}>
                <div class="transfer-item-icon" data-direction={item.direction}>
                  <span class="material-symbols-rounded">
                    {item.direction === "upload"
                      ? "arrow_upward"
                      : "arrow_downward"}
                  </span>
                </div>

                <div class="transfer-item-main">
                  <div class="transfer-item-name">{item.name}</div>
                  <div class="transfer-item-meta">
                    <span>{item.statusText}</span>
                    <span>{formatBytes(item.sizeBytes)}</span>
                    <span>
                      {t("transfers.meta.folder", { name: item.parentName })}
                    </span>
                    <span>{item.subtitle}</span>
                  </div>
                </div>

                <Show when={item.action !== null}>
                  <Tooltip placement="left" gutter={6}>
                    <Tooltip.Trigger
                      as={Button}
                      class="transfer-item-action"
                      aria-label={getTransferActionLabel(item.action!)}
                      onClick={() => {
                        void handleAction(item);
                      }}
                    >
                      <span class="material-symbols-rounded">
                        {item.action === "cancel"
                          ? "pause"
                          : item.action === "retry"
                            ? "refresh"
                            : "close"}
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content class="tab-tooltip">
                        <Tooltip.Arrow class="tab-tooltip-arrow" />
                        <span>{getTransferActionLabel(item.action!)}</span>
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
