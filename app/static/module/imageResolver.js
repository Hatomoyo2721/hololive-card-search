export function resolveImage(card) {
  if (!card || !card.card_number) {
    return "/static/assets/placeholder.webp";
  }
  // card.version: "[hBP01] Blooming Radiance"
  // card.card_number: "hBP01-007"

  const versionCode = card.card_number.slice(0, 5); // e.g. "hBP01-001" -> "hBP01"

  const versionMap = {
    hBP01: "hBP01-BloomingRadiance",
    hBP02: "hBP02-QuintetSpectrum",
    hBP03: "hBP03-EliteSpark",
    hBP04: "hBP04-CuriousUniverse",
    hBP05: "hBP05-EnchantLegalia",
    hBP06: "hBP06-AyakashiVermillion",
    hBP07: "hBP07-DivaFever",
    hBP08: "hBP08-BouncerBound"
  };

  const folder = versionMap[versionCode];
  
  if (!folder) {
    return "/static/assets/placeholder.webp";
  }

  return `/static/assets/${folder}/${card.card_number}.png`;
}
