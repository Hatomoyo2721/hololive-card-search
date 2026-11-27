import { fetchCards, fetchCardVariants } from "./apiClient.js";
import { getImageCandidates } from "./imageResolver.js";

const container = document.getElementById("card-container");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");
const boosterFilter = document.getElementById("booster-filter");
const rarityFilter = document.getElementById("rarity-filter");
const variantFilter = document.getElementById("variant-filter");
const filterSelects = [boosterFilter, rarityFilter, variantFilter];
const filterStatus = document.getElementById("filter-status");
const filterStatusText = document.getElementById("filter-status-text");
const filterClear = document.getElementById("filter-clear");
const filterRow = document.querySelector(".filter-row");
const toastRegion = document.getElementById("toast-region");
const pagination = document.getElementById("pagination");
const pagePrev = document.getElementById("page-prev");
const pageNext = document.getElementById("page-next");
const pageNumbers = document.getElementById("page-numbers");
const pageSummary = document.getElementById("page-summary");

const cardModal = document.getElementById("card-modal");
const cardModalClose = document.getElementById("card-modal-close");
const cardModalArt = cardModal.querySelector(".card-modal__art");
const cardModalImage = document.getElementById("card-modal-image");
const cardModalTitle = document.getElementById("card-modal-title");
const cardModalOriginal = document.getElementById("card-modal-original");
const cardModalRarity = document.getElementById("card-modal-rarity");
const cardModalSpec = document.getElementById("card-modal-spec");
const cardModalNumber = document.getElementById("card-modal-number");
const cardModalBooster = document.getElementById("card-modal-booster");
const cardModalOriginalVersion = document.getElementById("card-modal-original-version");
const cardModalGame = document.getElementById("card-modal-game");
const cardModalVariants = document.getElementById("card-modal-variants");
const cardModalVariantCount = document.getElementById("card-modal-variant-count");
const cardModalVariantList = document.getElementById("card-modal-variant-list");

const TOAST_DURATION = 2500;
const TOAST_EXIT_MS = 220;
const CARD_MODAL_CLOSE_MS = 760;
const CARD_FLIP_HALF_MS = 170;
const CARD_FLIP_PRELOAD_MS = 180;

const FILTER_OSCILLATION_LIMIT = 5;
const FILTER_OSCILLATION_WINDOW = 5000;
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
let currentPage = 1;
let renderedCards = [];
let modalLastFocused = null;
let modalOpenedAt = 0;
let modalCloseTimer = null;
let modalVariants = [];
let activeVariantId = null;
let modalIsFlipping = false;
let modalFlipTimer = null;
let variantAbortController = null;
let variantRequestToken = 0;

const variantCache = new Map();

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

function getEmptyState({ keyword, booster, rarity, variant }) {
  const hasFilter = Boolean(booster || rarity || variant);

  if (keyword && hasFilter) {
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

  if (variant && !booster && !rarity) {
    return {
      emoji: "🔁",
      title: "No twin printings...",
      message: "No card in the database is printed in more than one booster.",
    };
  }

  if (booster && rarity) {
    return {
      emoji: "🙀",
      title: "Bruh that combo doesn't exist!",
      message: `${booster} has no ${rarity} cards. Try another rarity.`,
    };
  }

  if (hasFilter) {
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
  renderedCards = cards;

  const fragment = document.createDocumentFragment();

  cards.forEach((card, index) => {
    const div = document.createElement("div");
    div.className = "card";
    div.dataset.cardIndex = String(index);
    div.tabIndex = 0;
    div.setAttribute("role", "button");
    div.setAttribute("aria-haspopup", "dialog");
    div.setAttribute(
      "aria-label",
      `View details for ${card.name} (${card.card_number})`,
    );

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
    // The multi-version filter lists several printings of one card number, so
    // show the booster to make the otherwise identical tiles distinguishable.
    const edition = variantFilter.value === "multi" ? shortVersion(card.version) : "";
    code.textContent =
      card.card_number +
      (card.rarity ? ` - ${card.rarity}` : "") +
      (edition ? ` · ${edition}` : "");

    div.appendChild(img);
    div.appendChild(title);
    div.appendChild(code);

    fragment.appendChild(div);
  });

  container.innerHTML = "";
  container.appendChild(fragment);
}

function applyCardDetails(card) {
  const displayName = card.name || card.original_name || "Unknown card";
  const secondaryNames = [...new Set([card.original_title, card.original_name])]
    .filter((value) => value && value !== displayName);

  cardModalTitle.textContent = displayName;
  cardModalOriginal.textContent = secondaryNames.join(" · ");

  cardModalRarity.textContent = card.rarity || "";
  cardModalRarity.hidden = !card.rarity;

  cardModalSpec.textContent = card.spec || "";
  cardModalSpec.hidden = !card.spec;

  cardModalNumber.textContent = card.card_number || "—";
  cardModalBooster.textContent = card.version || "—";
  cardModalOriginalVersion.textContent = card.original_version || "";
  cardModalOriginalVersion.hidden = !card.original_version;
  cardModalGame.textContent = card.card_game || "";

  const candidates = getImageCandidates(card);
  let candidateIndex = 0;

  cardModalImage.alt = `${displayName} card`;
  cardModalImage.onerror = () => {
    if (candidateIndex >= candidates.length - 1) {
      cardModalImage.onerror = null;
      return;
    }

    candidateIndex += 1;
    cardModalImage.src = candidates[candidateIndex];
  };
  cardModalImage.src = candidates[candidateIndex];
}

function resetVariantRail() {
  cardModalVariants.hidden = true;
  cardModalVariantCount.textContent = "";
  cardModalVariantList.replaceChildren();
}

function variantLabel(variant) {
  return [variant.rarity, variant.spec].filter(Boolean).join(" · ") || "Variant";
}

// "[hBP06] Ayakashi Vermillion" -> "hBP06"; keeps the full string as fallback
// for any future version format without a booster code.
function shortVersion(version) {
  return (version || "").match(/\[(h[A-Za-z]{2}\d{2})\]/)?.[1] || version || "";
}

function markActiveVariant(id) {
  cardModalVariantList.querySelectorAll(".card-modal__variant").forEach((button) => {
    const isActive = Number(button.dataset.variantId) === id;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

// The active printing can sit past the first screen of the rail (mobile,
// narrow desktop column), so bring it into view when the rail is rendered.
function revealActiveVariant() {
  const active = cardModalVariantList.querySelector(".card-modal__variant.is-active");

  if (!active) return;

  const railRect = cardModalVariantList.getBoundingClientRect();
  const chipRect = active.getBoundingClientRect();

  if (chipRect.left < railRect.left || chipRect.right > railRect.right) {
    cardModalVariantList.scrollLeft += chipRect.left - railRect.left;
  }
}

function renderVariantRail() {
  if (modalVariants.length <= 1) {
    resetVariantRail();
    return;
  }

  if (!modalVariants.some((variant) => variant.id === activeVariantId)) {
    activeVariantId = modalVariants[0].id;
    applyCardDetails(modalVariants[0]);
  }

  const fragment = document.createDocumentFragment();
  // A card number can be reprinted in another booster with the same rarity, so
  // the booster code is the only reliable way to tell those chips apart.
  const editionCount = new Set(modalVariants.map((variant) => variant.version || "")).size;
  const showEdition = editionCount > 1;
  let previousVersion = null;

  cardModalVariantList.replaceChildren();
  cardModalVariantCount.textContent = `(${modalVariants.length})`;

  modalVariants.forEach((variant) => {
    const label = variantLabel(variant);
    const edition = shortVersion(variant.version);
    const button = document.createElement("button");

    button.type = "button";
    button.className = "card-modal__variant";
    button.dataset.variantId = String(variant.id);
    button.title = showEdition && edition ? `${variant.version} — ${label}` : label;
    button.setAttribute(
      "aria-label",
      showEdition && edition
        ? `Show ${label} variant from ${variant.version || edition}`
        : `Show ${label} variant`,
    );
    button.setAttribute("aria-pressed", String(variant.id === activeVariantId));
    button.classList.toggle("is-active", variant.id === activeVariantId);

    if (showEdition && previousVersion !== null && (variant.version || "") !== previousVersion) {
      button.classList.add("is-edition-start");
    }

    previousVersion = variant.version || "";
    button.addEventListener("click", () => selectVariant(variant));

    const img = document.createElement("img");
    const candidates = getImageCandidates(variant);
    let candidateIndex = 0;

    img.src = candidates[candidateIndex];
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => {
      if (candidateIndex >= candidates.length - 1) {
        img.onerror = null;
        return;
      }

      candidateIndex += 1;
      img.src = candidates[candidateIndex];
    };

    const caption = document.createElement("span");
    caption.className = "card-modal__variant-caption";
    caption.textContent = variant.rarity || "?";

    button.appendChild(img);
    button.appendChild(caption);

    if (showEdition) {
      const editionLabel = document.createElement("span");
      editionLabel.className = "card-modal__variant-edition";
      editionLabel.textContent = edition;
      button.appendChild(editionLabel);
    }

    if ((variant.spec || "").toLowerCase().includes("signed")) {
      const signature = document.createElement("span");
      const icon = document.createElement("i");

      signature.className = "card-modal__variant-signed";
      icon.className = "fa-solid fa-signature";
      icon.setAttribute("aria-hidden", "true");
      signature.appendChild(icon);
      button.appendChild(signature);
    }

    fragment.appendChild(button);
  });

  cardModalVariantList.appendChild(fragment);
  cardModalVariants.hidden = false;
  revealActiveVariant();
}

function loadCardVariants(card) {
  const number = card.card_number || "";

  if (!number) {
    resetVariantRail();
    return;
  }

  const cacheKey = number;

  variantAbortController?.abort();
  variantAbortController = null;
  const token = ++variantRequestToken;

  if (variantCache.has(cacheKey)) {
    modalVariants = variantCache.get(cacheKey);
    renderVariantRail();
    return;
  }

  const controller = new AbortController();

  variantAbortController = controller;

  fetchCardVariants(number, "", controller.signal)
    .then((data) => {
      if (token !== variantRequestToken || cardModal.hidden) return;

      const items = (Array.isArray(data.items) ? data.items : []).filter(
        (item) => item.card_number === number,
      );

      variantCache.set(cacheKey, items);
      modalVariants = items;
      renderVariantRail();
    })
    .catch((err) => {
      // The strip is optional; the current card still opens fine without it.
      if (err.name === "AbortError") return;
      if (token !== variantRequestToken || cardModal.hidden) return;

      resetVariantRail();
    });
}

function preloadVariantImage(card) {
  const [src] = getImageCandidates(card);

  if (!src) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;

      settled = true;
      resolve();
    };

    const image = new Image();

    image.onload = done;
    image.onerror = done;
    image.src = src;

    if (image.complete) {
      done();
    }

    window.setTimeout(done, CARD_FLIP_PRELOAD_MS);
  });
}

function selectVariant(variant) {
  if (
    modalIsFlipping ||
    !variant ||
    variant.id === activeVariantId ||
    cardModal.classList.contains("is-closing")
  ) {
    return;
  }

  if (!modalVariants.some((item) => item.id === variant.id)) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    activeVariantId = variant.id;
    applyCardDetails(variant);
    markActiveVariant(variant.id);
    return;
  }

  const token = variantRequestToken;

  modalIsFlipping = true;

  preloadVariantImage(variant).then(() => {
    if (
      token !== variantRequestToken ||
      cardModal.hidden ||
      cardModal.classList.contains("is-closing")
    ) {
      modalIsFlipping = false;
      return;
    }

    cardModalArt.classList.add("is-flipping");

    modalFlipTimer = window.setTimeout(() => {
      activeVariantId = variant.id;
      applyCardDetails(variant);
      markActiveVariant(variant.id);

      requestAnimationFrame(() => {
        cardModalArt.classList.remove("is-flipping");
        modalIsFlipping = false;
      });
    }, CARD_FLIP_HALF_MS);
  });
}

function fillCardModal(card) {
  activeVariantId = card.id;
  modalVariants = [];
  resetVariantRail();
  applyCardDetails(card);
}

function lockPageScroll() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

  document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : "";
  document.body.classList.add("card-modal-open");
}

function unlockPageScroll() {
  document.body.classList.remove("card-modal-open");
  document.body.style.paddingRight = "";
}

function openCardModal(card) {
  if (!cardModal || !cardModal.hidden) return;

  modalLastFocused = document.activeElement;
  modalIsFlipping = false;
  window.clearTimeout(modalFlipTimer);
  modalFlipTimer = null;
  cardModalArt.classList.remove("is-flipping");
  fillCardModal(card);

  cardModal.hidden = false;
  modalOpenedAt = performance.now();
  lockPageScroll();

  // Force a frame at width 0 so every open replays the unroll animation.
  void cardModal.offsetWidth;
  cardModal.classList.add("is-open");

  cardModalClose.focus({ preventScroll: true });
  loadCardVariants(card);
}

function finishCardModalClose() {
  window.clearTimeout(modalCloseTimer);
  modalCloseTimer = null;

  cardModal.hidden = true;
  cardModal.classList.remove("is-closing");
  modalVariants = [];
  activeVariantId = null;
  resetVariantRail();
  unlockPageScroll();

  const target = modalLastFocused;
  modalLastFocused = null;

  if (target instanceof HTMLElement && document.contains(target)) {
    target.focus({ preventScroll: true });
  }
}

function closeCardModal() {
  if (!cardModal || cardModal.hidden || cardModal.classList.contains("is-closing")) {
    return;
  }

  variantRequestToken += 1;
  variantAbortController?.abort();
  variantAbortController = null;
  window.clearTimeout(modalFlipTimer);
  modalFlipTimer = null;
  modalIsFlipping = false;
  cardModalArt.classList.remove("is-flipping");

  cardModal.classList.remove("is-open");
  cardModal.classList.add("is-closing");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  modalCloseTimer = window.setTimeout(
    finishCardModalClose,
    reduceMotion ? 0 : CARD_MODAL_CLOSE_MS,
  );
}

function activeFilterLabels() {
  const labels = [];

  if (boosterFilter.value) {
    labels.push(boosterFilter.selectedOptions[0].textContent);
  }

  if (rarityFilter.value) {
    labels.push(`Rarity ${rarityFilter.value}`);
  }

  if (variantFilter.value) {
    labels.push("Multiple versions");
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

function hidePagination() {
  if (!pagination) return;

  pagination.hidden = true;
  pageNumbers.replaceChildren();
  pageSummary.textContent = "";
}

function buildPageItems(page, pages) {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }

  const visible = new Set([1, pages, page - 1, page, page + 1]);

  if (page <= 3) {
    [2, 3, 4].forEach((value) => visible.add(value));
  }

  if (page >= pages - 2) {
    [pages - 3, pages - 2, pages - 1].forEach((value) => visible.add(value));
  }

  const sorted = [...visible]
    .filter((value) => value >= 1 && value <= pages)
    .sort((a, b) => a - b);

  const items = [];
  let previous = 0;

  sorted.forEach((value) => {
    if (previous && value - previous > 1) {
      items.push(null);
    }

    items.push(value);
    previous = value;
  });

  return items;
}

function renderPagination(page, pages) {
  if (!pagination || pages <= 1) {
    hidePagination();
    return;
  }

  pagination.hidden = false;
  pagePrev.disabled = page <= 1;
  pageNext.disabled = page >= pages;
  pagePrev.dataset.page = String(Math.max(1, page - 1));
  pageNext.dataset.page = String(Math.min(pages, page + 1));
  pageSummary.textContent = `Page ${page} / ${pages}`;

  const fragment = document.createDocumentFragment();

  buildPageItems(page, pages).forEach((item) => {
    if (item === null) {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-ellipsis";
      ellipsis.setAttribute("aria-hidden", "true");
      ellipsis.textContent = "…";
      fragment.appendChild(ellipsis);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-number";
    button.dataset.page = String(item);
    button.textContent = String(item);
    button.setAttribute("aria-label", `Page ${item}`);

    if (item === page) {
      button.setAttribute("aria-current", "page");
    }

    fragment.appendChild(button);
  });

  pageNumbers.replaceChildren(fragment);
}

function scrollToCards() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  container.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
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
  const { keyword, booster, rarity, variant } = context;

  let messages = TOAST_MESSAGES.filters;

  if (keyword && (booster || rarity || variant)) {
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
  // Keep a 5s sliding window so taps about 1s apart still accumulate.
  // Same-direction presses do not erase earlier reversals, so paired taps
  // like Right, Right, Left, Left still count.
  const reversals = previous.reversals.filter(
    (time) => now - time <= FILTER_OSCILLATION_WINDOW,
  );

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

  filterSelects.forEach((select) => {
    filterChaos.delete(select);
    filterNavigation.delete(select);
    resetFilterHold(select);
    select.disabled = true;
  });

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
    filterClear.disabled = false;

    filterSelects.forEach((select) => {
      select.disabled = false;
      filterChaos.delete(select);
      filterNavigation.delete(select);
      resetFilterHold(select);
    });

    showToast({
      type: "success",
      message: pickRandom(TOAST_MESSAGES.unlock),
    });
  }, FILTER_LOCK_MS);
}

async function searchCards({ notify = false, suppressToast = false, scrollToResults = false } = {}) {
  const keyword = searchInput.value.trim();
  const booster = boosterFilter.value;
  const rarity = rarityFilter.value;
  const variant = variantFilter.value;
  const requestedPage = currentPage;

  if (activeRequest) {
    activeRequest.abort();
  }

  activeRequest = new AbortController();
  const { signal } = activeRequest;
  const quiet = suppressToast || filtersLocked;

  if (!quiet) {
    hideToast();
  }

  hidePagination();
  renderLoading();

  try {
    const data = await fetchCards(
      keyword,
      booster,
      rarity,
      variant,
      requestedPage,
      signal,
    );

    if (signal.aborted) return;

    const cards = data.items;

    currentPage = data.page;

    if (cards.length === 0) {
      hidePagination();
      renderEmpty({ keyword, booster, rarity, variant });

      // Only a booster/rarity/version change should trigger the playful toast.
      if (notify && !quiet && !filtersLocked && (booster || rarity || variant)) {
        pendingSuccessToast = true;
        showEmptyToast({ keyword, booster, rarity, variant });
      } else {
        pendingSuccessToast = false;
      }
    } else {
      render(cards);
      renderPagination(data.page, data.pages);

      // Celebrate only when the user just recovered from an empty filter result.
      if (notify && !quiet && !filtersLocked && pendingSuccessToast) {
        showSuccessToast(data.total);
      }

      pendingSuccessToast = false;
    }

    updateFilterStatus(data.total);

    if (scrollToResults) {
      scrollToCards();
    }
  } catch (err) {
    if (err.name === "AbortError") return;

    pendingSuccessToast = false;
    hidePagination();
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

  currentPage = 1;
  searchCards({ notify: true, suppressToast: locked });
}

function initEvents() {
  searchBtn.addEventListener("click", () => {
    currentPage = 1;
    searchCards();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      currentPage = 1;
      searchCards();
    }
  });

  filterSelects.forEach((select) => {
    select.addEventListener("change", () => handleFilterChange(select));
    select.addEventListener("focus", () => resetFilterChaos(select));
    select.addEventListener("keydown", (event) => handleFilterKeydown(select, event));
    select.addEventListener("keyup", () => resetFilterHold(select));
    select.addEventListener("blur", () => resetFilterHold(select));
  });

  filterClear.addEventListener("click", () => {
    filterSelects.forEach((select) => {
      select.value = "";
      resetFilterChaos(select);
      resetFilterHold(select);
    });

    currentPage = 1;
    searchCards();
  });

  container.addEventListener("click", (event) => {
    const cardElement = event.target.closest(".card");

    if (!cardElement) return;

    const card = renderedCards[Number(cardElement.dataset.cardIndex)];

    if (card) {
      openCardModal(card);
    }
  });

  container.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const cardElement = event.target.closest(".card");

    if (!cardElement) return;

    event.preventDefault();

    const card = renderedCards[Number(cardElement.dataset.cardIndex)];

    if (card) {
      openCardModal(card);
    }
  });

  cardModalClose.addEventListener("click", closeCardModal);

  cardModal.addEventListener("click", (event) => {
    // Ignore the second click of a double click on a card while unrolling.
    if (performance.now() - modalOpenedAt < 350) return;

    if (event.target === cardModal || event.target.closest("[data-card-modal-close]")) {
      closeCardModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !cardModal.hidden) {
      event.preventDefault();
      closeCardModal();
    }
  });

  // Keep keyboard focus inside the dialog while it is open.
  cardModal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;

    const focusable = cardModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (pagination) {
    pagination.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-page]");

      if (!button || button.disabled) return;

      const page = Number(button.dataset.page);

      if (!Number.isInteger(page) || page === currentPage) return;

      currentPage = page;
      searchCards({ scrollToResults: true });
    });
  }
}

(async function init() {
  initTheme();
  initEvents();
  initSearchGuide();

  await searchCards();
})();