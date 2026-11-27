export async function fetchCards(
  keyword = "",
  booster = "",
  rarity = "",
  variant = "",
  page = 1,
  signal,
) {
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

  if (variant) {
    params.set("variant", variant);
  }

  params.set("page", String(page));

  const query = params.toString();
  const url = query ? `/cards?${query}` : "/cards";

  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}

export async function fetchCardVariants(number, version = "", signal) {
  const params = new URLSearchParams({ number });

  if (version) {
    params.set("version", version);
  }

  const res = await fetch(`/cards/variants?${params.toString()}`, { signal });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}
