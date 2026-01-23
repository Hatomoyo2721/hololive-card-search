export function resolveImage(cardNumber) {
  if (!cardNumber) {
    return "/static/assets/placeholder.webp";
  }

  // hBP04-066 -> hBP04
  const version = cardNumber.split("-")[0];

  return `/static/assets/${version}/${cardNumber}.png`;
}
