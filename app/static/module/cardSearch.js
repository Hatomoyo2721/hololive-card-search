import { resolveImage } from "./imageResolver.js";

const container = document.getElementById("card-container");
const searchInput = document.getElementById("search");
const searchBtn = document.getElementById("search-btn");

// Render cards
function render(cards) {
  const fragment = document.createDocumentFragment();

  if (!cards || cards.length === 0) {
    container.innerHTML = "<p>No results found</p>";
    return;
  }

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

// Fetch from backend
async function fetchCards(keyword = "") {
  try {
    const res = await fetch(`/cards?q=${encodeURIComponent(keyword)}`);
    const data = await res.json();
    render(data);
  } catch (err) {
    console.error("Fetch error:", err);
    container.innerHTML = "<p>Error loading cards</p>";
  }
}

// Theme
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

// Events
function initEvents() {
  searchBtn.addEventListener("click", () => {
    const keyword = searchInput.value.trim();
    fetchCards(keyword);
  });

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchBtn.click();
    }
  });
}

// Init
(async function init() {
  initTheme();
  initEvents();

  await fetchCards();
})();