import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Badge } from "@kobalte/core/badge";
import { Tabs } from "@kobalte/core/tabs";
import { Button } from "@kobalte/core/button";
import { Tooltip } from "@kobalte/core/tooltip";
import { TabIcon, type TabIconName } from "./tabIcons";
import { DriveBrowser } from "./components/drive/DriveBrowser";
import { ActivityBrowser } from "./components/activity/ActivityBrowser";
import { DriveSearchBar } from "./components/search/DriveSearchBar";
import { UploadPopover } from "./components/upload/UploadPopover";
import { DragDropOverlay } from "./components/upload/DragDropOverlay";
import { TransfersBrowser } from "./components/transfers/TransfersBrowser";
import { enqueueFilesForUpload } from "./services/transferQueueClient";
import { openOrFocusOptionsPage } from "@/entrypoints/sidepanel/services/openOptionsPage";
import { subscribeActivityNotificationSound } from "./services/activitySoundStream";
import {
  activityUnreadCount$,
  disposeActivityStreams,
  startActivityStreams,
} from "./services/activityManager";
import {
  DEFAULT_DRIVE_SEARCH_FILTERS,
  type DriveSearchFilters,
} from "./services/driveApi";
import {
  OAUTH_SCOPE_DRIVE_METADATA_READONLY,
  isAuthFlowCancelledError,
  startInteractiveSignIn,
  tryGetAuthTokenSilently,
} from "./services/authService";
import {
  ActivityNotificationSound,
  type ActivitySettings,
} from "./services/activityTypes";
import { PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION } from "../shared/transferQueueMessages";
import { useI18n } from "../shared/i18n";
import "material-symbols/rounded.css";
import "./App.css";

type TabItem = {
  id: string;
  title: string;
  icon: TabIconName;
};

const REQUIRED_SIGN_IN_SCOPES = [OAUTH_SCOPE_DRIVE_METADATA_READONLY];
const DEFAULT_TAB_ID = "my-drive";

function playNotificationSound(
  sound: ActivitySettings["notificationSound"],
): void {
  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  const context = new AudioContextCtor();
  const now = context.currentTime;

  const playTone = (freq: number, startOffset: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + startOffset + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + startOffset + duration,
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now + startOffset);
    oscillator.stop(now + startOffset + duration + 0.03);
  };

  if (sound === ActivityNotificationSound.Bell) {
    playTone(880, 0, 0.22);
    playTone(1320, 0.12, 0.28);
  } else if (sound === ActivityNotificationSound.Digital) {
    playTone(720, 0, 0.08);
    playTone(960, 0.1, 0.08);
    playTone(1240, 0.2, 0.1);
  } else {
    playTone(660, 0, 0.16);
    playTone(990, 0.18, 0.2);
  }

  setTimeout(() => {
    void context.close();
  }, 900);
}

type SidepanelAuthState =
  | "checking"
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "cancelled"
  | "error";

function App() {
  const { locale, t } = useI18n();
  const tabs = createMemo<TabItem[]>(() => [
    { id: "my-drive", title: t("app.tab.myDrive"), icon: "drive" },
    { id: "recent", title: t("app.tab.recent"), icon: "clock" },
    { id: "shared", title: t("app.tab.shared"), icon: "shared" },
    { id: "starred", title: t("app.tab.starred"), icon: "star" },
    { id: "activity", title: t("app.tab.activity"), icon: "pulse" },
    { id: "transfers", title: t("app.tab.transfers"), icon: "transfers" },
    { id: "trash", title: t("app.tab.trash"), icon: "trash" },
  ]);
  const [isMenuCollapsed, setIsMenuCollapsed] = createSignal(true);
  const [activeTabId, setActiveTabId] = createSignal(DEFAULT_TAB_ID);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchFilters, setSearchFilters] = createSignal<DriveSearchFilters>(
    DEFAULT_DRIVE_SEARCH_FILTERS,
  );
  const [activityUnreadCount, setActivityUnreadCount] = createSignal(0);
  const [currentFolderId, setCurrentFolderId] = createSignal<string | null>(
    null,
  );
  const [authState, setAuthState] =
    createSignal<SidepanelAuthState>("checking");
  const [authErrorMessage, setAuthErrorMessage] = createSignal<string | null>(
    null,
  );

  let sidepanelSessionPort: ReturnType<typeof browser.runtime.connect> | null =
    null;
  let soundSubscription: { unsubscribe: () => void } | null = null;
  let unreadSubscription: { unsubscribe: () => void } | null = null;
  let authAttemptId = 0;

  const formatDate = (dateIso: string): string => {
    if (!dateIso) {
      return "-";
    }

    const date = new Date(dateIso);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString(locale() === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatSize = (size?: string): string => {
    if (!size) {
      return "-";
    }

    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "-";
    }

    const units = [
      t("app.size.byte"),
      t("app.size.kb"),
      t("app.size.mb"),
      t("app.size.gb"),
      t("app.size.tb"),
    ];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    const fixed = unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
    return `${fixed} ${units[unitIndex]}`;
  };

  const getAuthErrorMessage = (state: SidepanelAuthState): string => {
    if (state === "cancelled") {
      return t("app.auth.error.cancelled");
    }

    return t("app.auth.error.default");
  };

  const getDetailedAuthErrorMessage = (error: unknown): string => {
    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "unknown auth error";
    const message = rawMessage.toLowerCase();

    if (
      message.includes("network") ||
      message.includes("internet") ||
      message.includes("failed to fetch")
    ) {
      return t("app.auth.error.network");
    }

    if (
      message.includes("invalid_client") ||
      message.includes("unauthorized_client") ||
      message.includes("not allowed for this client") ||
      message.includes("oauth2 request failed")
    ) {
      return t("app.auth.error.oauthClient");
    }

    if (
      message.includes("not granted") ||
      message.includes("consent") ||
      message.includes("permission")
    ) {
      return t("app.auth.error.permission");
    }

    return t("app.auth.error.generic");
  };

  const handleFilesDrop = (files: File[]) => {
    void enqueueFilesForUpload(files, currentFolderId());
  };

  const disposeSidepanelSession = (): void => {
    soundSubscription?.unsubscribe();
    unreadSubscription?.unsubscribe();
    soundSubscription = null;
    unreadSubscription = null;

    if (sidepanelSessionPort) {
      sidepanelSessionPort.disconnect();
      sidepanelSessionPort = null;
    }

    disposeActivityStreams();
  };

  const initializeSidepanelSession = (): void => {
    if (sidepanelSessionPort) {
      return;
    }

    startActivityStreams();

    sidepanelSessionPort = browser.runtime.connect({
      name: PORT_TRANSFER_QUEUE_SIDEPANEL_SESSION,
    });

    soundSubscription = subscribeActivityNotificationSound((sound) => {
      playNotificationSound(sound);
    });

    unreadSubscription = activityUnreadCount$.subscribe((count) => {
      setActivityUnreadCount(count);
    });
  };

  const handleSignIn = async (): Promise<void> => {
    if (authState() === "authenticating") {
      return;
    }

    setAuthErrorMessage(null);
    setAuthState("authenticating");

    const currentAttemptId = ++authAttemptId;
    const isCurrentAttempt = (): boolean => {
      return (
        authState() === "authenticating" && authAttemptId === currentAttemptId
      );
    };

    const completeAuthSuccess = (): void => {
      if (!isCurrentAttempt()) {
        return;
      }

      initializeSidepanelSession();
      setAuthState("authenticated");
      setAuthErrorMessage(null);
      authAttemptId += 1;
    };

    const handleWindowFocus = (): void => {
      if (!isCurrentAttempt()) {
        return;
      }

      void tryGetAuthTokenSilently(REQUIRED_SIGN_IN_SCOPES).then(
        (silentToken) => {
          if (silentToken) {
            completeAuthSuccess();
          }
        },
      );
    };

    window.addEventListener("focus", handleWindowFocus);

    try {
      await startInteractiveSignIn(REQUIRED_SIGN_IN_SCOPES);
      completeAuthSuccess();
    } catch (error) {
      if (!isCurrentAttempt()) {
        return;
      }

      console.error("[Auth] Interactive sign-in failed", error);
      const nextState: SidepanelAuthState = isAuthFlowCancelledError(error)
        ? "cancelled"
        : "error";
      setAuthState(nextState);
      setAuthErrorMessage(
        nextState === "error"
          ? getDetailedAuthErrorMessage(error)
          : getAuthErrorMessage(nextState),
      );
      authAttemptId += 1;
    } finally {
      window.removeEventListener("focus", handleWindowFocus);
    }
  };

  const handleCancelSignIn = (): void => {
    if (authState() !== "authenticating") {
      return;
    }

    authAttemptId += 1;
    setAuthState("unauthenticated");
    setAuthErrorMessage(null);
  };

  onMount(() => {
    void (async () => {
      const silentToken = await tryGetAuthTokenSilently(
        REQUIRED_SIGN_IN_SCOPES,
      );
      if (silentToken) {
        initializeSidepanelSession();
        setAuthState("authenticated");
        return;
      }

      setAuthState("unauthenticated");
    })();

    onCleanup(() => {
      disposeSidepanelSession();
    });
  });

  const isAuthBusy = () =>
    authState() === "checking" || authState() === "authenticating";
  return (
    <Show
      when={authState() === "authenticated"}
      fallback={
        <section class="auth-gate">
          <div class="auth-gate-card">
            <h1>{t("app.auth.title")}</h1>
            <p>{t("app.auth.description")}</p>

            <Button
              class="auth-signin-btn"
              onClick={() => {
                void handleSignIn();
              }}
              disabled={isAuthBusy()}
            >
              <Show when={isAuthBusy()}>
                <span class="auth-loader" aria-hidden="true" />
              </Show>
              <span>
                {authState() === "checking"
                  ? t("app.auth.checking")
                  : authState() === "authenticating"
                    ? t("app.auth.signingIn")
                    : authState() === "cancelled" || authState() === "error"
                      ? t("app.auth.retry")
                      : t("app.auth.signIn")}
              </span>
            </Button>

            <Show when={authState() === "authenticating"}>
              <Button class="auth-cancel-btn" onClick={handleCancelSignIn}>
                {t("app.auth.cancel")}
              </Button>
            </Show>

            <Show when={authErrorMessage()}>
              {(message) => <p class="auth-error">{message()}</p>}
            </Show>
          </div>
        </section>
      }
    >
      <Tabs
        class={`panel-layout ${isMenuCollapsed() ? "collapsed" : ""}`}
        orientation="vertical"
        value={activeTabId()}
        onChange={setActiveTabId}
      >
        <aside class="sidebar">
          <div class="sidebar-top">
            <Button
              class="menu-btn"
              type="button"
              aria-label={
                isMenuCollapsed()
                  ? t("app.menu.expand")
                  : t("app.menu.collapse")
              }
              data-expanded={!isMenuCollapsed() || undefined}
              onClick={() => setIsMenuCollapsed((prev) => !prev)}
            >
              <span class="material-symbols-rounded menu-btn-icon">
                menu_open
              </span>
            </Button>

            <Show when={!isMenuCollapsed()}>
              <span class="sidebar-brand" aria-label="Drive GO">
                <span class="brand-google" aria-hidden="true">
                  <span class="brand-google-letter brand-google-blue">D</span>
                  <span class="brand-google-letter brand-google-red">r</span>
                  <span class="brand-google-letter brand-google-yellow">i</span>
                  <span class="brand-google-letter brand-google-blue">v</span>
                  <span class="brand-google-letter brand-google-green">e</span>
                  <span class="brand-google-gap"> </span>
                  <span class="brand-google-letter brand-google-blue">G</span>
                  <span class="brand-google-letter brand-google-red">o</span>
                </span>
              </span>
            </Show>
          </div>

          <Tabs.List class="tab-list" aria-label={t("app.sidebar.aria")}>
            <For each={tabs()}>
              {(tab) => (
                <Tooltip
                  placement="right"
                  gutter={8}
                  disabled={!isMenuCollapsed()}
                >
                  <Tooltip.Trigger
                    as={Tabs.Trigger}
                    class="tab-item"
                    value={tab.id}
                  >
                    <span class="tab-icon">
                      <TabIcon
                        name={tab.icon}
                        isSelected={activeTabId() === tab.id}
                      />
                    </span>
                    <span class="tab-label">{tab.title}</span>
                    <Show
                      when={tab.id === "activity" && activityUnreadCount() > 0}
                    >
                      <Badge
                        class="tab-activity-badge"
                        textValue={t("app.activityUnread", {
                          count: String(activityUnreadCount()),
                        })}
                      >
                        {activityUnreadCount() > 99
                          ? "99+"
                          : activityUnreadCount()}
                      </Badge>
                    </Show>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content class="tab-tooltip">
                      <Tooltip.Arrow class="tab-tooltip-arrow" />
                      <span>{tab.title}</span>
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip>
              )}
            </For>
          </Tabs.List>

          <div class="sidebar-bottom">
            <Tooltip placement="right" gutter={8} disabled={!isMenuCollapsed()}>
              <Tooltip.Trigger
                as={Button}
                class="settings-btn"
                onClick={() => {
                  void openOrFocusOptionsPage();
                }}
                aria-label={t("app.settings")}
              >
                <span class="material-symbols-rounded">settings</span>
                <span class="tab-label">{t("app.settings")}</span>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class="tab-tooltip">
                  <Tooltip.Arrow class="tab-tooltip-arrow" />
                  <span>{t("app.settings")}</span>
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>
          </div>
        </aside>

        <section class="content-area">
          <header class="topbar">
            <h1 class="brand" aria-label="Drive GO">
              <span class="brand-google" aria-hidden="true">
                <span class="brand-google-letter brand-google-blue">D</span>
                <span class="brand-google-letter brand-google-red">r</span>
                <span class="brand-google-letter brand-google-yellow">i</span>
                <span class="brand-google-letter brand-google-blue">v</span>
                <span class="brand-google-letter brand-google-green">e</span>
                <span class="brand-google-gap"> </span>
                <span class="brand-google-letter brand-google-blue">G</span>
                <span class="brand-google-letter brand-google-red">O</span>
              </span>
            </h1>

            <div class="search-block">
              <DriveSearchBar
                value={searchQuery()}
                filters={searchFilters()}
                active={activeTabId() === "my-drive"}
                onChange={setSearchQuery}
                onFiltersChange={setSearchFilters}
              />

              <UploadPopover />
            </div>
          </header>

          <div class="content-panels">
            <For each={tabs()}>
              {(tab) => (
                <Tabs.Content class="content-card" value={tab.id}>
                  <Show when={tab.id === "my-drive"}>
                    <DriveBrowser
                      formatDate={formatDate}
                      formatSize={formatSize}
                      onFolderChange={setCurrentFolderId}
                    />
                  </Show>

                  <Show when={tab.id === "shared"}>
                    <DriveBrowser
                      scope="shared"
                      formatDate={formatDate}
                      formatSize={formatSize}
                    />
                  </Show>

                  <Show when={tab.id === "recent"}>
                    <DriveBrowser
                      scope="recent"
                      formatDate={formatDate}
                      formatSize={formatSize}
                    />
                  </Show>

                  <Show when={tab.id === "starred"}>
                    <DriveBrowser
                      scope="starred"
                      formatDate={formatDate}
                      formatSize={formatSize}
                    />
                  </Show>

                  <Show when={tab.id === "trash"}>
                    <DriveBrowser
                      scope="trash"
                      formatDate={formatDate}
                      formatSize={formatSize}
                    />
                  </Show>

                  <Show when={tab.id === "transfers"}>
                    <TransfersBrowser />
                  </Show>

                  <Show when={tab.id === "activity"}>
                    <ActivityBrowser isActive={activeTabId() === "activity"} />
                  </Show>

                  <Show
                    when={
                      tab.id !== "my-drive" &&
                      tab.id !== "recent" &&
                      tab.id !== "starred" &&
                      tab.id !== "transfers" &&
                      tab.id !== "trash" &&
                      tab.id !== "activity" &&
                      tab.id !== "shared"
                    }
                  >
                    <p>{t("app.placeholder")}</p>
                  </Show>
                </Tabs.Content>
              )}
            </For>
          </div>
        </section>

        <DragDropOverlay onDrop={handleFilesDrop} />
      </Tabs>
    </Show>
  );
}

export default App;
