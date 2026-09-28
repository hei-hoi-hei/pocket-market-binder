import { readFile } from 'node:fs/promises';

const sample = JSON.parse(await readFile(new URL('./artwork-gap-sample.json', import.meta.url), 'utf8'));
const cardIds = [
  ...sample.controlCardIds,
  ...sample.knownMissingImageSample.localIds.map((localId) => `${sample.knownMissingImageSample.setId}-${localId}`),
];
const placeholderPattern = /(?:^|[\/_-])(?:placeholder|no[-_]?image|default[-_]?image)(?:[\/_.-]|$)/i;

async function fetchCard(id) {
  const response = await fetch(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(id)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`TCGdex card request failed (${response.status})`);
  const card = await response.json();
  if (!card || typeof card !== 'object' || typeof card.id !== 'string') {
    throw new Error('TCGdex returned a malformed card record');
  }
  return card;
}

function imageUrlFromBase(image) {
  if (typeof image !== 'string' || !image.trim()) return null;
  try {
    const base = new URL(image);
    if (base.protocol !== 'https:' || base.hostname !== 'assets.tcgdex.net') return null;
    return new URL(`${base.href.replace(/\/+$/, '')}/high.webp`);
  } catch {
    return null;
  }
}

async function inspectCard(id) {
  let card;
  try {
    card = await fetchCard(id);
  } catch (error) {
    return { requestedId: id, category: 'catalog-fetch-error', detail: error.message };
  }

  const identity = {
    tcgdexId: card.id,
    setId: card.set?.id,
    cardNumber: String(card.localId ?? ''),
    name: card.name,
  };

  if (card.image === undefined || card.image === null || card.image === '') {
    return { identity, category: 'no-image-url' };
  }
  if (typeof card.image !== 'string') {
    return { identity, category: 'malformed-image-url', detail: 'image field is not a string' };
  }

  const imageUrl = imageUrlFromBase(card.image);
  if (!imageUrl) {
    return { identity, category: 'malformed-image-url', detail: String(card.image) };
  }
  if (placeholderPattern.test(imageUrl.href)) {
    return { identity, category: 'known-placeholder-url', imageUrl: imageUrl.href };
  }

  try {
    const response = await fetch(imageUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return {
        identity,
        category: 'image-url-failed',
        imageUrl: imageUrl.href,
        detail: `HTTP ${response.status}`,
      };
    }
    return { identity, category: 'available', imageUrl: imageUrl.href, status: response.status };
  } catch (error) {
    return {
      identity,
      category: 'image-probe-error',
      imageUrl: imageUrl.href,
      detail: error.message,
    };
  }
}

const results = [];
for (let offset = 0; offset < cardIds.length; offset += 4) {
  const batch = cardIds.slice(offset, offset + 4);
  results.push(...await Promise.all(batch.map(inspectCard)));
}

const counts = Object.groupBy
  ? Object.fromEntries(Object.entries(Object.groupBy(results, (result) => result.category)).map(([key, entries]) => [key, entries.length]))
  : results.reduce((summary, result) => {
      summary[result.category] = (summary[result.category] ?? 0) + 1;
      return summary;
    }, {});

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  source: 'TCGdex English card API and TCGdex asset URLs',
  boundedSampleSize: cardIds.length,
  counts,
  findings: results.filter((result) => result.category !== 'available'),
}, null, 2));
