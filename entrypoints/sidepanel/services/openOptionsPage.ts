function isOptionsTabUrl(tabUrl: string, optionsUrl: string): boolean {
  return (
    tabUrl === optionsUrl ||
    tabUrl.startsWith(`${optionsUrl}#`) ||
    tabUrl.startsWith(`${optionsUrl}?`)
  );
}

export async function openOrFocusOptionsPage(): Promise<void> {
  const optionsUrl = browser.runtime.getURL("/options.html");

  if (!browser.tabs?.query || !browser.tabs?.create || !browser.tabs?.update) {
    window.open(optionsUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const browserTabs = await browser.tabs.query({});
  const existingOptionsTab = browserTabs.find((tab) => {
    const currentUrl = tab.pendingUrl ?? tab.url ?? "";
    return isOptionsTabUrl(currentUrl, optionsUrl);
  });

  if (!existingOptionsTab?.id) {
    await browser.tabs.create({ url: optionsUrl });
    return;
  }

  await browser.tabs.update(existingOptionsTab.id, { active: true });

  if (
    browser.windows?.update &&
    typeof existingOptionsTab.windowId === "number"
  ) {
    await browser.windows.update(existingOptionsTab.windowId, {
      focused: true,
    });
  }
}
