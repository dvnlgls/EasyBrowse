// Ask the background for the platform: the user agent loses "Android" in
// "Desktop site" mode, which would hide the orb.
browser.runtime.sendMessage({ action: "platform" })
  .then((os) => {
    if (os === "android") initializeHandyTabs();
  })
  .catch(() => {});

function initializeHandyTabs() {
  const host = document.createElement("div");
  host.setAttribute("aria-label", "EasyBrowse");
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none"
  });

  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .orb, .control, .tab {
      font: 16px/1.2 system-ui, sans-serif;
      border: 0;
      color: #fff;
      background: rgba(30, 30, 30, .94);
      box-shadow: 0 2px 10px rgba(0, 0, 0, .35);
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    .orb, .control { display: grid; place-items: center; }
    .orb svg, .control svg { width: 22px; height: 22px; }
    .orb {
      position: fixed;
      width: 44px;
      height: 44px;
      padding: 0;
      border-radius: 50%;
      background: rgb(63, 63, 65);
      opacity: .3;
      touch-action: none;
      cursor: grab;
    }
    .orb:active, .orb:focus-visible { opacity: .82; }
    .menu {
      position: fixed;
      display: none;
      flex-direction: column;
      gap: 7px;
      width: 130px;
      max-height: min(80vh, 480px);
      overflow: auto;
      padding: 8px;
      border-radius: 14px;
      background: rgba(20, 20, 20, .92);
      pointer-events: auto;
      overscroll-behavior: contain;
    }
    .menu.open { display: flex; }
    .button-row { display: flex; justify-content: center; gap: 8px; }
    .control {
      min-height: 42px;
      width: 42px;
      height: 42px;
      padding: 0;
      border-radius: 9px;
      cursor: pointer;
    }
    .control.close svg { color: #ff4545; }
    .control:active, .tab:active { background: rgba(90, 90, 90, .98); }
    .tab {
      min-height: 42px;
      width: 100%;
      padding: 9px 12px;
      border-radius: 9px;
      text-align: left;
      cursor: pointer;
    }
    .tab { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tab.active { outline: 1px solid rgba(255, 255, 255, .6); }
    .tab-list {
      display: none;
      flex-direction: column;
      gap: 5px;
      max-height: min(45vh, 300px);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .tab-list.open { display: flex; }
    .divider {
      display: block;
      width: 100%;
      height: 1px;
      border: 0;
      margin: 1px 0;
      background: rgba(255, 255, 255, .22);
    }
    .recent-list { display: flex; flex-direction: column; gap: 2px; }
    .recent-tab {
      width: 100%;
      min-height: 25px;
      padding: 4px 8px;
      overflow: hidden;
      border: 0;
      border-radius: 6px;
      color: rgba(255, 255, 255, .68);
      background: transparent;
      font: 12px/1.3 system-ui, sans-serif;
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }
    .recent-tab:active { background: rgba(90, 90, 90, .98); }
    .status { padding: 6px 8px; color: white; font: 13px/1.3 system-ui, sans-serif; }
  `;

  const orb = document.createElement("button");
  orb.className = "orb";
  orb.type = "button";
  orb.setAttribute("aria-label", "Open tab controls");
  orb.setAttribute("aria-expanded", "false");
  orb.append(createIcon("menu"));

  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "menu");
  const status = document.createElement("div");
  status.className = "status";
  status.setAttribute("role", "status");
  const tabList = document.createElement("div");
  tabList.className = "tab-list";
  tabList.setAttribute("role", "group");
  tabList.setAttribute("aria-label", "Open tabs");
  const divider = document.createElement("hr");
  divider.className = "divider";
  const recentList = document.createElement("div");
  recentList.className = "recent-list";
  recentList.setAttribute("role", "group");
  recentList.setAttribute("aria-label", "Recently used tabs");

  const rows = [
    [["Close current tab", "close"], ["Scroll to top", "top"]],
    [["Previous tab", "previous"], ["Next tab", "next"]],
    [["Reload current tab", "reload"], ["New tab", "new"]],
    [["Share current page", "share"], ["Show all tabs", "list"]]
  ];

  for (const row of rows) {
    const rowElement = document.createElement("div");
    rowElement.className = "button-row";
    for (const [label, action] of row) {
      const button = document.createElement("button");
      button.className = `control${action === "close" ? " close" : ""}`;
      button.type = "button";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.setAttribute("role", "menuitem");
      button.append(createIcon(action));
      button.addEventListener("click", () => runAction(action));
      rowElement.append(button);
    }
    menu.append(rowElement);
  }
  menu.append(tabList, divider, recentList, status);
  shadow.append(style, orb, menu);
  (document.documentElement || document.body).append(host);

  const defaultPosition = { x: 0.025, y: 0.5 };
  let position = defaultPosition;
  let dragged = false;
  let startPoint;

  orb.style.visibility = "hidden"; // reveal once the saved position is known
  browser.storage.local.get("handyPosition").then((stored) => {
    if (stored.handyPosition) position = stored.handyPosition;
  }).catch(showError).finally(() => {
    placeOrb();
    orb.style.visibility = "visible";
  });
  placeOrb();

  function placeOrb() {
    const maxX = Math.max(0, innerWidth - 44);
    const maxY = Math.max(0, innerHeight - 44);
    const left = Math.min(maxX, Math.max(0, position.x * maxX));
    const top = Math.min(maxY, Math.max(0, position.y * maxY));
    orb.style.left = `${left}px`;
    orb.style.top = `${top}px`;
    if (menu.classList.contains("open")) placeMenu(left, top);
  }

  function placeMenu(left, top) {
    const menuWidth = menu.getBoundingClientRect().width;
    menu.style.maxHeight = `${Math.max(120, innerHeight - 16)}px`;
    menu.style.left = `${left > innerWidth / 2
      ? Math.max(8, left - menuWidth - 8)
      : Math.min(innerWidth - menuWidth - 8, left + 52)}px`;
    menu.style.top = `${Math.max(8, top - 8)}px`;
    const menuHeight = menu.getBoundingClientRect().height;
    menu.style.top = `${Math.max(8, Math.min(innerHeight - menuHeight - 8, top - 8))}px`;
  }

  orb.addEventListener("pointerdown", (event) => {
    dragged = false;
    startPoint = { x: event.clientX, y: event.clientY, left: orb.offsetLeft, top: orb.offsetTop };
    orb.setPointerCapture(event.pointerId);
  });

  orb.addEventListener("pointermove", (event) => {
    if (!startPoint || !(event.buttons || event.pressure)) return;
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
    if (!dragged) return;
    const left = Math.max(0, Math.min(innerWidth - 44, startPoint.left + dx));
    const top = Math.max(0, Math.min(innerHeight - 44, startPoint.top + dy));
    position = {
      x: left / Math.max(1, innerWidth - 44),
      y: top / Math.max(1, innerHeight - 44)
    };
    placeOrb();
  });

  const finishDrag = () => {
    if (dragged) browser.storage.local.set({ handyPosition: position }).catch(showError);
    startPoint = undefined;
  };
  orb.addEventListener("pointerup", finishDrag);
  orb.addEventListener("pointercancel", finishDrag);

  orb.addEventListener("click", async () => {
    if (dragged) {
      dragged = false;
      return;
    }
    const opening = !menu.classList.contains("open");
    menu.classList.toggle("open", opening);
    orb.setAttribute("aria-expanded", String(opening));
    if (opening) {
      status.textContent = "";
      clearTabList();
      placeMenu(orb.offsetLeft, orb.offsetTop);
      refreshRecentTabs();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (menu.classList.contains("open") && !event.composedPath().includes(host)) {
      menu.classList.remove("open");
      orb.setAttribute("aria-expanded", "false");
    }
  }, true);

  addEventListener("resize", placeOrb);
  addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menu.classList.remove("open");
      orb.setAttribute("aria-expanded", "false");
    }
  });

  async function runAction(action) {
    status.textContent = "";
    try {
      if (action === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        menu.classList.remove("open");
        orb.setAttribute("aria-expanded", "false");
        return;
      }
      if (action === "share") {
        if (!/^https?:$/.test(location.protocol)) {
          status.textContent = "Nothing to share on this page.";
          return;
        }
        const data = { title: document.title, url: location.href };

        if (typeof navigator.share === "function") {
          try {
            await navigator.share(data);
            menu.classList.remove("open");
            orb.setAttribute("aria-expanded", "false");
          } catch (err) {
            if (err.name === "AbortError") return; // user closed the sheet
            console.error(err);
            await copyToClipboard(data.url);
            status.textContent = "Link copied to clipboard.";
          }
        } else {
          await copyToClipboard(data.url);
          status.textContent = "Link copied to clipboard.";
        }
        return;
      }
      if (action === "list") {
        const tabs = await browser.runtime.sendMessage({ action });
        clearTabList();
        tabList.classList.add("open");
        for (const tab of tabs) {
          const button = document.createElement("button");
          button.className = `tab${tab.active ? " active" : ""}`;
          button.type = "button";
          button.textContent = tab.title;
          button.title = tab.title;
          button.setAttribute("role", "menuitem");
          button.addEventListener("click", async () => {
            clearTabList();
            try {
              await browser.runtime.sendMessage({ action: "activate", tabId: tab.id });
              menu.classList.remove("open");
              orb.setAttribute("aria-expanded", "false");
            } catch (error) {
              showError(error);
            }
          });
          tabList.append(button);
        }
        status.textContent = `${tabs.length} tab${tabs.length === 1 ? "" : "s"}`;
        placeMenu(orb.offsetLeft, orb.offsetTop);
        return;
      }
      await browser.runtime.sendMessage({ action });
      menu.classList.remove("open");
      orb.setAttribute("aria-expanded", "false");
    } catch (error) {
      showError(error);
    }
  }

  function showError(error) {
    status.textContent = error.message || "Could not complete that action.";
  }

  function clearTabList() {
    tabList.replaceChildren();
    tabList.classList.remove("open");
    status.textContent = "";
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall back for pages where the clipboard API is present but unavailable.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    Object.assign(textarea.style, {
      position: "fixed",
      left: "-9999px",
      top: "0"
    });
    document.documentElement.append(textarea);
    textarea.select();
    let copied;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    if (!copied) throw new Error("Could not copy the link to the clipboard.");
  }

  async function refreshRecentTabs() {
    try {
      const tabs = await browser.runtime.sendMessage({ action: "recent" });
      recentList.replaceChildren();
      for (const tab of tabs) {
        const button = document.createElement("button");
        button.className = "recent-tab";
        button.type = "button";
        button.textContent = tab.title;
        button.title = tab.title;
        button.setAttribute("aria-label", `Switch to ${tab.title}`);
        button.addEventListener("click", async () => {
          try {
            await browser.runtime.sendMessage({ action: "activate", tabId: tab.id });
            menu.classList.remove("open");
            orb.setAttribute("aria-expanded", "false");
          } catch (error) {
            showError(error);
          }
        });
        recentList.append(button);
      }
      placeMenu(orb.offsetLeft, orb.offsetTop);
    } catch (error) {
      showError(error);
    }
  }

  function createIcon(name) {
    const icons = {
      menu: "M4 6h16M4 12h16M4 18h16",
      close: "M18 6 6 18M6 6l12 12",
      top: "M12 19V5m-7 7 7-7 7 7",
      previous: "m15 18-6-6 6-6",
      next: "m9 18 6-6-6-6",
      reload: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4m-4 5a8 8 0 0 0 14.9 3M20 20v-4h-4",
      new: "M12 5v14M5 12h14",
      list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
      share: "M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5"
    };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", name === "top" ? "3.5" : "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", icons[name]);
    svg.append(path);
    return svg;
  }
}
