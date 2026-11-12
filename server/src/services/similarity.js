// Lightweight TF-IDF + cosine similarity used to flag *possible* duplicate grievances.
// Deterministic and explainable; results are only ever shown to humans for review.

const STOP = new Set(`a an the and or but if of to in on at by for with from is are was were be been being this that these those it its
i me my we our you your he she they them his her their there here as not no nor so too very can will would should could may might
have has had do does did done am also than then into over under again more most such only own same just about after before
please sir madam kindly request respected regarding since last days day months month year years still even any all some`.split(/\s+/));

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9ഀ-ൿ\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => t.replace(/(ing|ed|es|s)$/, '')); // crude stemming
}

function termFreq(tokens) {
  const tf = new Map();
  tokens.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
  return tf;
}

function cosine(a, b) {
  let dot = 0; let na = 0; let nb = 0;
  for (const [k, v] of a) { na += v * v; if (b.has(k)) dot += v * b.get(k); }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * @param {string} text  new complaint text
 * @param {{id:number, reference_no:string, text:string, district?:string}[]} candidates
 * @param {{threshold?:number, district?:string, limit?:number}} opts
 */
function findSimilar(text, candidates, { threshold = 0.42, district, limit = 3 } = {}) {
  if (!candidates.length) return [];
  const docs = candidates.map((c) => termFreq(tokenize(c.text)));
  const queryTf = termFreq(tokenize(text));
  const N = docs.length + 1;
  const df = new Map();
  [queryTf, ...docs].forEach((d) => d.forEach((_, k) => df.set(k, (df.get(k) || 0) + 1)));
  const weigh = (tf) => {
    const w = new Map();
    tf.forEach((v, k) => w.set(k, (1 + Math.log(v)) * Math.log(1 + N / df.get(k))));
    return w;
  };
  const q = weigh(queryTf);
  return candidates
    .map((c, i) => {
      let score = cosine(q, weigh(docs[i]));
      if (district && c.district === district) score = Math.min(1, score * 1.1); // same-district boost
      return { id: c.id, reference_no: c.reference_no, subject: c.subject, status: c.status, district: c.district, score: Number(score.toFixed(3)) };
    })
    .filter((r) => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { tokenize, findSimilar };
