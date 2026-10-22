export async function fetchCards(keyword = "", booster = "") {
  const params = new URLSearchParams();

  if (keyword) {
    params.set("q", keyword);
  }

  if (booster) {
    params.set("booster", booster);
  }

  const query = params.toString();
  const url = query ? `/cards?${query}` : "/cards";

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}