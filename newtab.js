const DEFAULTS = [
  { name: "Showgrid", url: "https://theshowgrid.com/" },
  { name: "Weather", url: "https://www.google.com/search?client=firefox-b-m&q=montreal+weather" },
  { name: "Bookman", url: "http://bookman.home.arpa/" },
  { name: "HCycle", url: "http://homecycle.home.arpa/" },
  { name: "reddit", url: "https://old.reddit.com/rising/" },
  { name: "Pihole", url: "https://pi.home.arpa/admin/login" },
];

const grid = document.getElementById("grid");
const editToggle = document.getElementById("edit-toggle");
const resetBtn = document.getElementById("reset");
const addForm = document.getElementById("add-form");
const addName = document.getElementById("add-name");
const addUrl = document.getElementById("add-url");
const msg = document.getElementById("msg");
const q = document.getElementById("q");

let favs = [];
let editing = false;

async function load() {
  try {
    const { favs: saved } = await browser.storage.local.get("favs");
    favs = Array.isArray(saved) ? saved : DEFAULTS.slice();
  } catch (err) {
    console.error(err);
    favs = DEFAULTS.slice();
  }
}

async function save() {
  try {
    await browser.storage.local.set({ favs });
  } catch (err) {
    console.error(err);
    msg.textContent = "Could not save changes.";
  }
}

// Returns a normalized http(s) URL string, or null if invalid.
function normalizeUrl(text) {
  let t = text.trim();
  if (!t) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".") && u.hostname !== "localhost") return null;
    return u.href;
  } catch {
    return null;
  }
}

function render() {
  grid.textContent = "";
  favs.forEach((f, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";

    if (editing) {
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = f.name;
      tile.appendChild(label);

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "remove";
      rm.textContent = "\u00d7";
      rm.setAttribute("aria-label", "Remove " + f.name);
      rm.addEventListener("click", async () => {
        favs.splice(i, 1);
        await save();
        render();
      });
      tile.appendChild(rm);
    } else {
      const a = document.createElement("a");
      a.href = f.url;
      a.textContent = f.name;
      tile.appendChild(a);
    }
    grid.appendChild(tile);
  });

  editToggle.textContent = editing ? "Done" : "Edit";
  resetBtn.hidden = !editing;
  addForm.classList.toggle("show", editing);
  msg.textContent = "";
}

editToggle.addEventListener("click", () => {
  editing = !editing;
  render();
});

resetBtn.addEventListener("click", async () => {
  favs = DEFAULTS.slice();
  await save();
  render();
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = addName.value.trim();
  const url = normalizeUrl(addUrl.value);
  if (!name || !url) {
    msg.textContent = "Enter a name and a valid web address.";
    return;
  }
  favs.push({ name, url });
  await save();
  addName.value = "";
  addUrl.value = "";
  render();
});

// Search box: treat input as a URL if it looks like one, otherwise search.
q.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = q.value.trim();
  if (!text) return;
  const asUrl = /\s/.test(text) ? null : normalizeUrl(text);
  location.href = asUrl || "https://www.google.com/search?q=" + encodeURIComponent(text);
});

load().then(render);
