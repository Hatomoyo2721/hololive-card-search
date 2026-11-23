export async function fetchCards(keyword = "", booster = "", rarity = "", signal) {
  const params = new URLSearchParams();

  if (keyword) {
    params.set("q", keyword);
  }

  if (booster) {
    params.set("booster", booster);
  }

  if (rarity) {
    params.set("rarity", rarity);
  }

  const query = params.toString();
  const url = query ? `/cards?${query}` : "/cards";

  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}
