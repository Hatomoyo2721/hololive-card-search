import { fetchCards } from "./apiClient.js";
import { getImageCandidates } from "./imageResolver.js";

const container = document.getElementById("card-container");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");
const boosterFilter = document.getElementById("booster-filter");
const rarityFilter = document.getElementById("rarity-filter");
const filterStatus = document.getElementById("filter-status");
const filterStatusText = document.getElementById("filter-status-text");
const filterClear = document.getElementById("filter-clear");
const filterRow = document.querySelector(".filter-row");
const toastRegion = document.getElementById("toast-region");

const TOAST_DURATION = 2500;
const TOAST_EXIT_MS = 220;

const FILTER_OSCILLATION_LIMIT = 6;
const FILTER_OSCILLATION_WINDOW = 1500;
const FILTER_HOLD_MS = 1200;
const FILTER_HOLD_MIN_CHANGES = 2;
const FILTER_LOCK_MS = 5000;
const QUAKE_DURATION_MS = 650;
const FILTER_FORWARD_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const FILTER_BACKWARD_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

const TOAST_MESSAGES = {
  combo: [
    "Peko peko... even elite luck can't find that combo!",
    "Ziaaaroo cards. That combo is rarer than a signed card!",
  ],
  keyword: [
    "No oshi found. Maybe they're taking a break?",
    "Nothing here... Try another name!",
  ],
  keywordWithFilters: [
    "Dang it, nothing here. Try clearing a filter!",
    "Empty stage... clear a filter and try again!",
  ],
  filters: [
    "Empty stage... try another filter!",
    "Too many filters! Even a detective can't crack this one.",
  ],
  success: [
    "Yatta! Found {cards}.",
    "There we go! {cards} on stage.",
  ],
  lock: [
    "Stop bruh, you tryna glitch?! Frozen for 5s",
    "Nyo Nyo... too much switching! Take a 5s breather",
    "Dang it, caged for 5 seconds",
  ],
  unlock: [
    "Yaaa free to go! Filters are back.",
  ],
};

// Crisp 2D icons keep the toast visually distinct from the emoji empty state.
const TOAST_ICONS = {
  error: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  `,
  success: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6.5"/>
    </svg>
  `,
  lock: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h12M6 21h12M8 3v3.5l4 5.5-4 5.5V21M16 3v3.5L12 12l4 5.5V21"/>
    </svg>
  `,
};

let activeRequest = null;
let toastTimer = null;
let toastElement = null;
let pendingSuccessToast = false;
let filtersLocked = false;

const filterChaos = new WeakMap();
const filterHold = new WeakMap();
const filterNavigation = new WeakMap();

function renderLoading() {
  container.innerHTML = `
    <div class="state-message">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Loading cards...</p>
    </div>
  `;
}

function getEmptyState({ keyword, booster, rarity }) {
  if (keyword && (booster || rarity)) {
    return {
      emoji: "🐾",
      title: "Nothing on this stage...",
      message: `No card matches “${keyword}” with these filters. Clear one and try again.`,
    };
  }

  if (keyword) {
    return {
      emoji: "😿",
      title: "No oshi found...",
      message: `No card matches “${keyword}”. Try another name or card ID.`,
    };
  }

  if (booster && rarity) {
    return {
      emoji: "🙀",
      title: "Bruh that combo doesn't exist!",
      message: `${booster} has no ${rarity} cards. Try another rarity.`,
    };
  }

  if (booster || rarity) {
    return {
      emoji: "😹",
      title: "Empty stage...",
      message: "No cards match these filters. Try another combination.",
    };
  }

  return {
    emoji: "😺",
    title: "No cards found",
    message: "Try another card name, card number, or clear a filter.",
  };
}

function renderEmpty(context) {
  const state = getEmptyState(context);

  const wrapper = document.createElement("div");
  wrapper.className = "state-message";

  const emoji = document.createElement("div");
  emoji.className = "state-emoji";
  emoji.setAttribute("aria-hidden", "true");
  emoji.textContent = state.emoji;

  const title = document.createElement("p");
  title.textContent = state.title;

  const message = document.createElement("span");
  message.textContent = state.message;

  wrapper.append(emoji, title, message);

  container.replaceChildren(wrapper);
}

function renderError() {
  container.innerHTML = `
    <div class="state-message">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>Unable to load cards</p>
      <span>Please try again later.</span>
    </div>
  `;
}

function render(cards) {
  const fragment = document.createDocumentFragment();

  cards.forEach(card => {
    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");
    const candidates = getImageCandidates(card);
    let candidateIndex = 0;

    img.src = candidates[candidateIndex];
    img.loading = "lazy";
    img.onerror = () => {
      if (candidateIndex >= candidates.length - 1) {
        img.onerror = null;
        return;
      }

      candidateIndex += 1;
      img.src = candidates[candidateIndex];
    };

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = card.name;

    const originalName = card.original_name || "";

    if (originalName && originalName !== card.name) {
      title.title = originalName;
    }

    img.alt = card.name;

    const code = document.createElement("div");
    code.className = "card-code";
    code.textContent = card.card_number + (card.rarity ? ` - ${card.rarity}` : "");

    div.appendChild(img);
    div.appendChild(title);
    div.appendChild(code);

    fragment.appendChild(div);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

function activeFilterLabels() {
  const labels = [];

  if (boosterFilter.value) {
    labels.push(boosterFilter.selectedOptions[0].textContent);
  }

  if (rarityFilter.value) {
    labels.push(`Rarity ${rarityFilter.value}`);
  }

  return labels;
}

function updateFilterStatus(count) {
  const labels = activeFilterLabels();

  if (labels.length === 0) {
    filterStatus.hidden = true;
    return;
  }

  const cards = count === 1 ? "1 card" : `${count} cards`;
  filterStatusText.textContent = `${labels.join(" + ")} — ${cards}`;
  filterStatus.hidden = false;
}

function pickRandom(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function clearToastTimer() {
  if (toastTimer === null) return;

  clearTimeout(toastTimer);
  toastTimer = null;
}

function hideToast() {
  if (!toastElement) return;

  clearToastTimer();

  const toast = toastElement;
  toastElement = null;

  toast.classList.add("is-leaving");

  // Fallback for reduced motion or a missed animation frame.
  setTimeout(() => toast.remove(), TOAST_EXIT_MS);
}

function showToast({ type = "error", message, duration = TOAST_DURATION }) {
  if (!toastRegion) return;

  clearToastTimer();
  toastRegion.replaceChildren();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.style.setProperty("--toast-duration", `${duration}ms`);

  const icon = document.createElement("span");
  icon.className = `toast-icon toast-icon--${type}`;
  icon.setAttribute("aria-hidden", "true");
  // TOAST_ICONS only holds static SVG strings, never user input.
  icon.innerHTML = TOAST_ICONS[type] || TOAST_ICONS.error;

  const text = document.createElement("p");
  text.className = "toast-text";
  text.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "toast-close";
  closeButton.setAttribute("aria-label", "Dismiss notification");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", hideToast);

  const progress = document.createElement("div");
  progress.className = "toast-progress";

  toast.append(icon, text, closeButton, progress);
  toastRegion.appendChild(toast);

  toastElement = toast;
  toastTimer = setTimeout(hideToast, duration);
}

function showEmptyToast(context) {
  const { keyword, booster, rarity } = context;

  let messages = TOAST_MESSAGES.filters;

  if (keyword && (booster || rarity)) {
    messages = TOAST_MESSAGES.keywordWithFilters;
  } else if (keyword) {
    messages = TOAST_MESSAGES.keyword;
  } else if (booster && rarity) {
    messages = TOAST_MESSAGES.combo;
  }

  showToast({ type: "error", message: pickRandom(messages) });
}

function showSuccessToast(count) {
  const cards = count === 1 ? "1 card" : `${count} cards`;
  const message = pickRandom(TOAST_MESSAGES.success).replace("{cards}", cards);

  showToast({ type: "success", message });
}

function resetFilterChaos(select) {
  filterChaos.set(select, {
    index: select.selectedIndex,
    direction: 0,
    reversals: [],
  });
  filterNavigation.delete(select);
}

function trackFilterChange(select) {
  if (filtersLocked) return false;

  const now = performance.now();
  const index = select.selectedIndex;
  const previous = filterChaos.get(select);
  const navigationDirection = filterNavigation.get(select);
  filterNavigation.delete(select);

  if (!previous) {
    filterChaos.set(select, {
      index,
      direction: navigationDirection ?? 0,
      reversals: [],
    });
    return false;
  }

  const delta = index - previous.index;

  if (delta === 0) return false;

  const direction = navigationDirection ?? Math.sign(delta);
  const isReversal = previous.direction !== 0 && direction !== previous.direction;
  // Keep only reversals inside the sliding window so a slow back-and-forth never locks.
  const reversals = isReversal
    ? previous.reversals.filter((time) => now - time <= FILTER_OSCILLATION_WINDOW)
    : [];

  if (isReversal) {
    reversals.push(now);
  }

  filterChaos.set(select, {
    index,
    direction,
    reversals,
  });

  if (reversals.length >= FILTER_OSCILLATION_LIMIT) {
    lockFilters();
    return true;
  }

  return false;
}

function resetFilterHold(select) {
  filterHold.delete(select);
}

function wrapFilterSelection(select, event) {
  const forward = FILTER_FORWARD_KEYS.has(event.key);
  const backward = FILTER_BACKWARD_KEYS.has(event.key);

  if (!forward && !backward) return false;

  const lastIndex = select.options.length - 1;

  if (lastIndex < 1) return false;

  let target = null;

  if (forward && select.selectedIndex >= lastIndex) {
    target = 0;
  } else if (backward && select.selectedIndex <= 0) {
    target = lastIndex;
  }

  if (target === null) return false;

  event.preventDefault();
  select.selectedIndex = target;
  // Keep the intended key direction so a wrap does not look like a reversal.
  filterNavigation.set(select, forward ? 1 : -1);
  select.dispatchEvent(new Event("change", { bubbles: true }));

  return true;
}

function handleFilterKeydown(select, event) {
  if (filtersLocked) return;

  const forward = FILTER_FORWARD_KEYS.has(event.key);
  const backward = FILTER_BACKWARD_KEYS.has(event.key);

  if (!forward && !backward) {
    return;
  }

  wrapFilterSelection(select, event);

  if (filtersLocked) return;

  const now = performance.now();
  const index = select.selectedIndex;
  const current = filterHold.get(select);

  if (!event.repeat || !current || current.key !== event.key) {
    filterHold.set(select, {
      key: event.key,
      startedAt: now,
      lastIndex: index,
      changes: 0,
    });
    return;
  }

  if (index !== current.lastIndex) {
    current.changes += 1;
    current.lastIndex = index;
  }

  if (
    now - current.startedAt >= FILTER_HOLD_MS &&
    current.changes >= FILTER_HOLD_MIN_CHANGES
  ) {
    event.preventDefault();
    resetFilterHold(select);
    lockFilters();
  }
}

function lockFilters() {
  if (filtersLocked) return;

  filtersLocked = true;
  pendingSuccessToast = false;
  filterChaos.delete(boosterFilter);
  filterChaos.delete(rarityFilter);
  filterNavigation.delete(boosterFilter);
  filterNavigation.delete(rarityFilter);
  resetFilterHold(boosterFilter);
  resetFilterHold(rarityFilter);

  boosterFilter.disabled = true;
  rarityFilter.disabled = true;
  filterClear.disabled = true;

  if (filterRow) {
    filterRow.classList.add("is-quaking");
    setTimeout(() => filterRow.classList.remove("is-quaking"), QUAKE_DURATION_MS);
  }

  showToast({
    type: "lock",
    message: pickRandom(TOAST_MESSAGES.lock),
    duration: FILTER_LOCK_MS,
  });

  setTimeout(() => {
    filtersLocked = false;
    boosterFilter.disabled = false;
    rarityFilter.disabled = false;
    filterClear.disabled = false;
    filterChaos.delete(boosterFilter);
    filterChaos.delete(rarityFilter);
    filterNavigation.delete(boosterFilter);
    filterNavigation.delete(rarityFilter);
    resetFilterHold(boosterFilter);
    resetFilterHold(rarityFilter);

    showToast({
      type: "success",
      message: pickRandom(TOAST_MESSAGES.unlock),
    });
  }, FILTER_LOCK_MS);
}

async function searchCards({ notify = false, suppressToast = false } = {}) {
  const keyword = searchInput.value.trim();
  const booster = boosterFilter.value;
  const rarity = rarityFilter.value;

  if (activeRequest) {
    activeRequest.abort();
  }

  activeRequest = new AbortController();
  const { signal } = activeRequest;
  const quiet = suppressToast || filtersLocked;

  if (!quiet) {
    hideToast();
  }

  renderLoading();

  try {
    const cards = await fetchCards(keyword, booster, rarity, signal);

    if (signal.aborted) return;

    if (cards.length === 0) {
      renderEmpty({ keyword, booster, rarity });

      // Only a booster/rarity change should trigger the playful toast.
      if (notify && !quiet && !filtersLocked && (booster || rarity)) {
        pendingSuccessToast = true;
        showEmptyToast({ keyword, booster, rarity });
      } else {
        pendingSuccessToast = false;
      }
    } else {
      render(cards);

      // Celebrate only when the user just recovered from an empty filter result.
      if (notify && !quiet && !filtersLocked && pendingSuccessToast) {
        showSuccessToast(cards.length);
      }

      pendingSuccessToast = false;
    }

    updateFilterStatus(cards.length);
  } catch (err) {
    if (err.name === "AbortError") return;

    pendingSuccessToast = false;
    console.error("Fetch error:", err);
    renderError();
  }
}

function initTheme() {
  const root = document.documentElement;
  const toggleBtn = document.getElementById("theme-toggle");

  const savedTheme = localStorage.getItem("theme") || "light";
  root.className = savedTheme;

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const isDark = root.classList.contains("dark");
      const newTheme = isDark ? "light" : "dark";

      root.className = newTheme;
      localStorage.setItem("theme", newTheme);
    });
  }
}

function initSearchGuide() {
  const searchHelp = document.querySelector(".search-help");
  const infoButton = document.querySelector(".info-btn");

  if (!searchHelp || !infoButton) return;

  infoButton.addEventListener("click", (event) => {
    event.stopPropagation();

    const isOpen = searchHelp.classList.toggle("is-open");

    infoButton.setAttribute("aria-expanded", isOpen);
  });

  document.addEventListener("click", (event) => {
    if (!searchHelp.contains(event.target)) {
      searchHelp.classList.remove("is-open");
      infoButton.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchHelp.classList.remove("is-open");
      infoButton.setAttribute("aria-expanded", "false");
    }
  });
}

function handleFilterChange(select) {
  const locked = trackFilterChange(select);

  searchCards({ notify: true, suppressToast: locked });
}

function initEvents() {
  searchBtn.addEventListener("click", () => searchCards());

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      searchCards();
    }
  });

  boosterFilter.addEventListener("change", () => handleFilterChange(boosterFilter));
  rarityFilter.addEventListener("change", () => handleFilterChange(rarityFilter));

  [boosterFilter, rarityFilter].forEach((select) => {
    select.addEventListener("focus", () => resetFilterChaos(select));
    select.addEventListener("keydown", (event) => handleFilterKeydown(select, event));
    select.addEventListener("keyup", () => resetFilterHold(select));
    select.addEventListener("blur", () => resetFilterHold(select));
  });

  filterClear.addEventListener("click", () => {
    boosterFilter.value = "";
    rarityFilter.value = "";
    resetFilterChaos(boosterFilter);
    resetFilterChaos(rarityFilter);
    resetFilterHold(boosterFilter);
    resetFilterHold(rarityFilter);
    searchCards();
  });
}

(async function init() {
  initTheme();
  initEvents();
  initSearchGuide();

  await searchCards();
})();