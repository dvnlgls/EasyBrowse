const TAB_ORDER_KEY = "handyTabOpenOrder";
const RECENT_TABS_KEY = "handyRecentTabs";
let tabOpenOrder = [];
let recentTabIds = [];

const tabOrderReady = browser.storage.local.get([TAB_ORDER_KEY, RECENT_TABS_KEY]).then(async (stored) => {
  const tabs = await browser.tabs.query({});
  const liveIds = new Set(tabs.map((tab) => tab.id));
  tabOpenOrder = Array.isArray(stored[TAB_ORDER_KEY])
    ? stored[TAB_ORDER_KEY].filter((id) => liveIds.has(id))
    : [];
  const knownIds = new Set(tabOpenOrder);
  const untrackedTabs = tabs
    .filter((tab) => !knownIds.has(tab.id))
    .sort((a, b) => a.windowId - b.windowId || a.index - b.index);
  tabOpenOrder.push(...untrackedTabs.map((tab) => tab.id));
  recentTabIds = Array.isArray(stored[RECENT_TABS_KEY])
    ? stored[RECENT_TABS_KEY].filter((id) => liveIds.has(id)).slice(0, 5)
    : [];
  for (const tab of tabs.filter((candidate) => candidate.active)) {
    if (!recentTabIds.includes(tab.id)) recentTabIds.unshift(tab.id);
  }
  recentTabIds = recentTabIds.slice(0, 5);
  await persistTabState();
}).catch(console.error); // on failure, start with empty state instead of failing every action

let tabOrderUpdate = tabOrderReady;

function updateTabOpenOrder(update) {
  tabOrderUpdate = tabOrderUpdate
    .catch(() => {}) // an earlier failure must not block later updates
    .then(async () => {
      await tabOrderReady;
      await update();
      await persistTabState();
    });
  tabOrderUpdate.catch(console.error);
  return tabOrderUpdate;
}

function persistTabState() {
  return browser.storage.local.set({
    [TAB_ORDER_KEY]: tabOpenOrder,
    [RECENT_TABS_KEY]: recentTabIds
  });
}

browser.tabs.onCreated.addListener((tab) => {
  void updateTabOpenOrder(async () => {
    tabOpenOrder = tabOpenOrder.filter((id) => id !== tab.id);
    tabOpenOrder.push(tab.id);
    recentTabIds = [tab.id, ...recentTabIds.filter((id) => id !== tab.id)].slice(0, 5);
  });
});

browser.tabs.onRemoved.addListener((tabId) => {
  void updateTabOpenOrder(async () => {
    tabOpenOrder = tabOpenOrder.filter((id) => id !== tabId);
    recentTabIds = recentTabIds.filter((id) => id !== tabId);
  });
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  void updateTabOpenOrder(async () => {
    recentTabIds = [tabId, ...recentTabIds.filter((id) => id !== tabId)].slice(0, 5);
  });
});

async function handleMessage(message, sender) {
  if (message && message.action === "platform") {
    return (await browser.runtime.getPlatformInfo()).os;
  }

  const currentTabId = sender.tab && sender.tab.id;
  const windowId = sender.tab && sender.tab.windowId;

  if (!Number.isInteger(currentTabId)) {
    throw new Error("This action requires an open browser tab.");
  }
  await tabOrderReady;

  switch (message && message.action) {
    case "close":
      await browser.tabs.remove(currentTabId);
      return;
    case "new":
      await browser.tabs.create({
        url: browser.runtime.getURL("newtab.html"),
        active: true,
      });
      return;
    case "reload":
      await browser.tabs.reload(currentTabId);
      return;
    case "previous":
    case "next": {
      const allTabs = await browser.tabs.query({});
      const order = new Map(tabOpenOrder.map((id, index) => [id, index]));
      const orderedTabs = allTabs.sort((a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.windowId - b.windowId ||
        a.index - b.index
      );
      const windowTabs = orderedTabs.filter((tab) => tab.windowId === windowId);
      const tabs = windowTabs.length > 1 ? windowTabs : orderedTabs;
      if (tabs.length < 2) return;
      const index = tabs.findIndex((tab) => tab.id === currentTabId);
      if (index < 0) return;
      const offset = message.action === "next" ? 1 : -1;
      const target = tabs[(index + offset + tabs.length) % tabs.length];
      await browser.tabs.update(target.id, { active: true });
      return;
    }
    case "list": {
      const tabs = await browser.tabs.query({});
      const order = new Map(tabOpenOrder.map((id, index) => [id, index]));
      return tabs.sort((a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER) ||
        a.windowId - b.windowId ||
        a.index - b.index
      ).map(({ id, title, active }) => ({
        id,
        title: title || "Untitled tab",
        active
      }));
    }
    case "recent": {
      const tabs = await browser.tabs.query({});
      const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
      return recentTabIds
        .map((id) => tabsById.get(id))
        .filter(Boolean)
        .filter((tab) => tab.id !== currentTabId)
        .map(({ id, title, active }) => ({
          id,
          title: title || "Untitled tab",
          active
        }));
    }
    case "activate":
      if (!Number.isInteger(message.tabId)) {
        throw new Error("Invalid tab.");
      }
      await browser.tabs.update(message.tabId, { active: true });
      return;
    default:
      throw new Error("Unknown tab action.");
  }
}

browser.runtime.onMessage.addListener((message, sender) =>
  handleMessage(message, sender)
);
