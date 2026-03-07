export default defineBackground(() => {
  console.log("Hello background!", { id: browser.runtime.id });

  const sidePanelApi = browser.sidePanel;

  if (sidePanelApi.setPanelBehavior) {
    void sidePanelApi.setPanelBehavior({ openPanelOnActionClick: true });
  }
});
