import { fetchCards } from "./apiClient.js";
import { resolveImage } from "./imageResolver.js";

const container = document.getElementById("card-container");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");
const boosterFilter = document.getElementById("booster-filter");

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
    img.src = resolveImage(card);
    img.loading = "lazy";
    img.onerror = () => {
      img.src = "/static/assets/placeholder.webp";
    };

    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = card.name;

    const code = document.createElement("div");
    code.className = "card-code";
    code.textContent = card.card_number;

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

  renderLoading();

  try {
    const cards = await fetchCards(keyword, booster);
    render(cards);
  } catch (err) {
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

function initEvents() {
  searchBtn.addEventListener("click", searchCards);

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchCards();
    }
  });

  boosterFilter.addEventListener("change", searchCards);
}

(async function init() {
  initTheme();
  initEvents();

  await searchCards();
})();