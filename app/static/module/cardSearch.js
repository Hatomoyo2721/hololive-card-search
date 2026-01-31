import { fetchAllCards } from "./apiClient.js";
import { resolveImage } from "./imageResolver.js";

let allCards = [];

const container = document.getElementById("card-container");
const searchInput = document.getElementById("search");
const themeBtn = document.getElementById("theme-btn");


// Normalize text for case-insensitive comparison
function normalize(text) {
  return text ? text.toLowerCase() : "";
}


// Debounce function to limit the rate of function calls
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Render cards to the container
function render(cards) {
  const fragment = document.createDocumentFragment();

  cards.forEach(card => {
    const div = document.createElement("div");
    div.className = "card";

    const img = document.createElement("img");
    img.src = resolveImage(card);
    img.loading = "lazy";
    img.onerror = () => { img.src = "/static/assets/placeholder.webp"; };

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

function filterCards(keyword) {
  const key = normalize(keyword);
  return allCards.filter(card =>
    normalize(card.name).includes(key) ||
    normalize(card.card_number).includes(key)
  );
}

// Theme Logic
function initTheme() {
  const root = document.documentElement;
  const saved = localStorage.getItem("theme") || "light";
  root.className = saved;

  themeBtn.addEventListener("click", () => {
    const isDark = root.classList.contains("dark");
    const newTheme = isDark ? "light" : "dark";
    
    root.className = newTheme;
    localStorage.setItem("theme", newTheme);
  });
}

// Main init 
(async function init() {
  initTheme();

  allCards = await fetchAllCards();
  render(allCards);

  searchInput.addEventListener("input", debounce((e) => {
    const value = e.target.value.trim();
    if (!value) {
      render(allCards);
    } else {
      render(filterCards(value));
    }
  }, 267)); // 267ms debounce for input
})();