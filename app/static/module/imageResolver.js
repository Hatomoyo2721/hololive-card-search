export function resolveImage(card) {
    const booster = card.card_number.match(/^hBP\d{2}/)?.[0];

    const boosterFolders = {
        hBP01: "hBP01-BloomingRadiance",
        hBP02: "hBP02-QuintetSpectrum",
        hBP03: "hBP03-EliteSpark",
        hBP04: "hBP04-CuriousUniverse",
        hBP05: "hBP05-EnchantLegalia",
        hBP06: "hBP06-AyakashiVermillion",
        hBP07: "hBP07-DivaFever",
        hBP08: "hBP08-BouncerBound",
    };

    const folder = boosterFolders[booster];

    if (!folder) {
        return "/static/assets/placeholder.webp";
    }

    const rarity = (card.rarity || "").trim();

    const safeRarity = rarity.replace(/[^A-Za-z0-9_-]/g, "");
    const safeCardNumber = card.card_number.replace(/[^A-Za-z0-9_-]/g, "");

    return `/static/assets/${folder}/${safeCardNumber}-${safeRarity}.png`;
}