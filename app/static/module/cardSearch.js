import { fetchCards } from "./apiClient.js";
import { getImageCandidates } from "./imageResolver.js";

const container = document.getElementById("card-container");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");
const boosterFilter = document.getElementById("booster-filter");

let activeRequest = null;

function renderLoading() {
  container.innerHTML = `
    <div class="state-message">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p>Loading cards...</p>
    </div>
  `;
}

function renderEmpty() {
  container.innerHTML = `
    <div class="state-message">
      <i class="fa-solid fa-magnifying-glass"></i>
      <p>No cards found</p>
      <span>Try another card name, card number, or booster pack.</span>
    </div>
  `;
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
  if (!cards || cards.length === 0) {
    renderEmpty();
    return;
  }

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

async function searchCards() {
  const keyword = searchInput.value.trim();
  const booster = boosterFilter.value;

  if (activeRequest) {
    activeRequest.abort();
  }

  activeRequest = new AbortController();
  const { signal } = activeRequest;

  renderLoading();

  try {
    const cards = await fetchCards(keyword, booster, signal);

    if (signal.aborted) return;

    render(cards);
  } catch (err) {
    if (err.name === "AbortError") return;

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

function initEvents() {
  searchBtn.addEventListener("click", searchCards);

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      searchCards();
    }
  });

  boosterFilter.addEventListener("change", searchCards);
}

(async function init() {
  initTheme();
  initEvents();
  initSearchGuide();

  await searchCards();
})();