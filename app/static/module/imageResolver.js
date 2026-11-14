const PLACEHOLDER = "/static/assets/placeholder.webp";

const boosterFolders = {
    hBP01: "hBP01-BloomingRadiance",
    hBP02: "hBP02-QuintetSpectrum",
    hBP03: "hBP03-EliteSpark",
    hBP04: "hBP04-CuriousUniverse",
    hBP05: "hBP05-EnchantRegalia",
    hBP06: "hBP06-AyakashiVermillion",
    hBP07: "hBP07-DivaFever",
    hBP08: "hBP08-BouncerBound",
};

// Start decks are sold inside a booster, so their images live in that folder.
const startDeckFolders = {
    hSD02: "hBP02-QuintetSpectrum",
    hSD03: "hBP02-QuintetSpectrum",
    hSD04: "hBP02-QuintetSpectrum",
    hSD05: "hBP03-EliteSpark",
    hSD06: "hBP03-EliteSpark",
    hSD07: "hBP03-EliteSpark",
};

function safe(value) {
    return (value || "").replace(/[^A-Za-z0-9_-]/g, "");
}

function prefixOf(cardNumber) {
    return (cardNumber || "").match(/^(h[A-Za-z]{2}\d{2})/)?.[1];
}

// Reprints keep their old card number but are sold in the new booster, so the
// image lives under the booster named in `version` ([hBP04] ...). Fall back to
// the card number prefix for rows without a usable version.
function folderOf(card) {
    const fromVersion = (card.version || "").match(/\[(h[A-Za-z]{2}\d{2})\]/)?.[1];

    if (fromVersion) {
        const folder = boosterFolders[fromVersion];

        if (folder) {
            return folder;
        }
    }

    const prefix = prefixOf(card.card_number);

    return boosterFolders[prefix] || startDeckFolders[prefix] || null;
}

// Some images are stored as "<number>-<rarity>.png", others as "<number>.png".
export function getImageCandidates(card) {
    const folder = folderOf(card);

    if (!folder) {
        return [PLACEHOLDER];
    }

    const base = `/static/assets/${folder}/${safe(card.card_number)}`;
    const rarity = safe(card.rarity);

    if (rarity) {
        return [`${base}-${rarity}.png`, `${base}.png`, PLACEHOLDER];
    }

    return [`${base}.png`, PLACEHOLDER];
}