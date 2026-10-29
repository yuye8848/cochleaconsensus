// CochleaConsensus front-end: i18n toggle + data-driven tables + Analyze tools.
let LANG = "en";
function applyLang() {
  document.querySelectorAll("[data-en]").forEach(el => {
    el.textContent = el.getAttribute(LANG === "en" ? "data-en" : "data-zh");
  });
  document.getElementById("btn-en").classList.toggle("on", LANG === "en");
  document.getElementById("btn-zh").classList.toggle("on", LANG === "zh");
}
document.getElementById("btn-en").onclick = () => { LANG = "en"; applyLang(); };
document.getElementById("btn-zh").onclick = () => { LANG = "zh"; applyLang(); };

async function J(p) { const r = await fetch(p); return r.json(); }
function tbl(el, cols, rows) {
  el.innerHTML = "<thead><tr>" + cols.map(c => `<th>${c[0]}</th>`).join("") +
    "</tr></thead><tbody>" + rows.map(r => "<tr>" + cols.map(c => `<td>${c[1](r) ?? ""}</td>`).join("") + "</tr>").join("") + "</tbody>";
}
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

const PAGE = document.body.dataset.page;

// ------------------------------------------------------------- Cohorts
if (PAGE === "cohorts.html") (async () => {
  const d = await J("data/cohorts.json");
  const fl = document.getElementById("f-layer"), fv = document.getElementById("f-verdict");
  [...new Set(d.map(r => r.layer))].sort().forEach(v => fl.add(new Option(v, v)));
  [...new Set(d.map(r => r.verdict).filter(Boolean))].sort().forEach(v => fv.add(new Option(v, v)));
  function draw() {
    const q = document.getElementById("f-q").value.toLowerCase();
    const rows = d.filter(r => (!fl.value || r.layer === fl.value) &&
      (!fv.value || r.verdict === fv.value) &&
      (!q || (r.gse + " " + r.title).toLowerCase().includes(q)));
    document.getElementById("f-count").textContent = rows.length + " series";
    tbl(document.getElementById("cohort-table"),
      [["GSE", r => `<a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.gse}">${r.gse}</a>`],
       ["Title", r => esc(r.title)], ["Layer", r => r.layer], ["Tier", r => r.tier],
       ["Samples", r => r.n], ["Verdict", r => r.verdict],
       ["Note", r => r.verdict === "unusable" ? esc(r.reason) : ""]], rows);
  }
  [fl, fv].forEach(e => e.onchange = draw);
  document.getElementById("f-q").oninput = draw; draw();
})();

// ------------------------------------------------------------- Consensus
if (PAGE === "consensus.html") (async () => {
  const sel = document.getElementById("c-layer");
  const layers = ["GENETIC", "NOISE", "OTOTOX", "REGEN", "FISH-regen"];
  layers.forEach(l => sel.add(new Option(l, l)));
  const cache = {};
  async function draw() {
    const L = sel.value;
    if (!cache[L]) cache[L] = await J(`data/consensus_${L}.json`);
    const q = document.getElementById("c-q").value.toLowerCase();
    const rows = cache[L].filter(r => !q || r.g.toLowerCase().includes(q)).slice(0, 500);
    document.getElementById("c-count").textContent =
      `${cache[L].length} cross-study consensus genes (showing ${rows.length})`;
    tbl(document.getElementById("consensus-table"),
      [["Gene", r => r.g], ["Direction", r => r.d], ["Grade", r => r.gr],
       ["mean logFC", r => r.lf], ["min FDR", r => r.fdr], ["Studies", r => r.ns]], rows);
  }
  sel.onchange = draw; document.getElementById("c-q").oninput = draw; draw();
  const core = await J("data/cross_core.json");
  tbl(document.getElementById("core-table"),
    [["Gene", r => r.gene], ["Direction", r => r.direction], ["Layers", r => r.layers],
     ["mean logFC", r => r.mean_logFC]], core);
  const spec = await J("data/layer_specific_summary.json");
  const conf = await J("data/cross_conflicted_count.json");
  document.getElementById("specific-note").textContent =
    `Layer-specific genes (exactly one mouse layer): ` +
    Object.entries(spec).map(([k, v]) => `${k} ${v}`).join(" · ") +
    `. Genes appearing in ≥3 layers with conflicting directions: ${conf.n} (counting overlap without direction overstates sharing).`;
})();

// ------------------------------------------------------------- Pathways
if (PAGE === "pathways.html") (async () => {
  const pw = await J("data/pathways.json"), tf = await J("data/tf.json");
  const sel = document.getElementById("p-set");
  Object.keys(pw).sort().forEach(s => sel.add(new Option(s, s)));
  function draw() {
    const s = sel.value, out = [];
    for (const db of ["GO_BP", "GO_CC", "GO_MF", "KEGG", "Reactome"])
      for (const t of (pw[s][db] || [])) out.push({ db, ...t });
    out.sort((a, b) => a.q - b.q);
    tbl(document.getElementById("pathway-table"),
      [["Database", r => r.db], ["Term", r => esc(r.t)], ["q", r => r.q.toExponential(2)],
       ["Genes", r => r.n], ["GeneRatio", r => r.gr]], out.slice(0, 60));
    const layer = s.replace("bulk_", "").replace("ortho_", "").replace(/_(up|down)$/, "");
    document.getElementById("p-dot").src = `img/dotplot_${s.startsWith("ortho") ? "ortho_" : "bulk_"}${layer}.png`;
    const trows = [];
    for (const [set, arr] of Object.entries(tf)) if (set === s)
      for (const t of arr) trows.push(t);
    tbl(document.getElementById("tf-table"),
      [["TF", r => r.tf], ["Regulon overlap", r => r.ov], ["q", r => r.q.toExponential(2)]],
      trows);
  }
  sel.onchange = draw;
  if (sel.options.length) { sel.value = "bulk_NOISE_down"; draw(); }
})();

// ------------------------------------------------------------- Single-cell
if (PAGE === "singlecell.html") (async () => {
  const d = await J("data/sc_index.json");
  const sel = document.getElementById("s-series");
  [...new Set(d.map(r => r.series))].sort().forEach(v => sel.add(new Option(v, v)));
  function draw() {
    const rows = d.filter(r => !sel.value || r.series === sel.value);
    document.getElementById("s-count").textContent = rows.length + " tables";
    tbl(document.getElementById("sc-table"),
      [["Series", r => r.series], ["Contrast", r => r.contrast], ["Cell type", r => r.celltype],
       ["Genes tested", r => r.n], ["FDR<0.05", r => r.nsig], ["Engine", r => r.engine],
       ["Inference", r => r.inference]], rows);
  }
  sel.onchange = draw; draw();
  const imm = await J("data/immune.json");
  tbl(document.getElementById("immune-table"),
    [["Series", r => r.series], ["Layer", r => r.stratum], ["Cells", r => r.total_cells],
     ["Immune cells (broad)", r => r.immune_cells_broad],
     ["Immune fraction", r => (100 * (+r.immune_frac_broad)).toFixed(1) + "%"],
     ["Groups", r => esc(r.groups)], ["Note", r => esc(r.note)]], imm);
})();

// ------------------------------------------------------------- Ortholog
if (PAGE === "ortholog.html") (async () => {
  const d = await J("data/ortho.json");
  tbl(document.getElementById("ortho-table"),
    [["Mouse layer", r => r.layer], ["1:1 pairs", r => r.pairs],
     ["Same-direction fraction", r => r.frac], ["Permutation p", r => r.perm],
     ["Binomial p", r => r.binom], ["Spearman rho", r => r.rho]], d);
})();

// ------------------------------------------------------------- Aging
if (PAGE === "aging.html") (async () => {
  const d = await J("data/aging.json");
  tbl(document.getElementById("aging-table"),
    [["GSE", r => `<a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.gse}">${r.gse}</a>`],
     ["Title", r => esc(r.title)], ["Tier", r => r.tier], ["Samples", r => r.n],
     ["Verdict", r => r.verdict]], d);
})();

// ------------------------------------------------------------- Downloads
if (PAGE === "downloads.html") {
  const files = ["universe_final.csv", "comparable_contrasts.csv", "series_verdicts.csv",
    "consensus_GENETIC.csv", "consensus_NOISE.csv", "consensus_OTOTOX.csv", "consensus_REGEN.csv",
    "consensus_FISH-regen.csv", "consensus_AGING.csv", "marker_check.csv",
    "concordant_genes_GENETIC.csv", "concordant_genes_NOISE.csv", "concordant_genes_OTOTOX.csv",
    "concordant_genes_REGEN.csv", "concordant_genes_AGING.csv", "concordance_stats.csv",
    "enrichment_summary.csv", "tf_enrichment.csv", "cross_insult_core.csv",
    "layer_specific_genes.csv", "cross_insult_conflicted.csv", "deafness_gene_overlap.csv",
    "immune_sc_composition.csv", "immune_consensus_genes.csv", "zenodo_package_MANIFEST.csv"];
  tbl(document.getElementById("dl-table"), [["File", f => `<a href="downloads/${f}">${f}</a>`]],
    files);
}

// ------------------------------------------------------------- Analyze
function lgam(x) { // Lanczos log-gamma
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgam(1 - x);
  x -= 1; let a = c[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function hyperP(k, K, n, N) { // P[X >= k], X ~ Hypergeom(N, K, n)
  const logC = (a, b) => (b < 0 || b > a) ? -Infinity : lgam(a + 1) - lgam(b + 1) - lgam(a - b + 1);
  let s = 0; const mx = Math.min(K, n);
  for (let i = k; i <= mx; i++) s += Math.exp(logC(K, i) + logC(N - K, n - i) - logC(N, n));
  return Math.min(1, s);
}
if (PAGE === "analyze.html") (async () => {
  const sets = await J("data/sets.json");
  const BG = 17981; // largest tested-gene universe (GENETIC layer background)
  function parse(id) {
    return [...new Set(document.getElementById(id).value.split(/[\s,;]+/)
      .map(s => s.trim()).filter(Boolean))];
  }
  document.getElementById("a-run").onclick = () => {
    const up = parse("a-up"), dn = parse("a-down"), out = [];
    for (const [name, genes] of Object.entries(sets)) {
      const S = new Set(genes);
      const isUp = name.endsWith("_up");
      const mine = isUp ? up : dn, other = isUp ? dn : up;
      const k = mine.filter(g => S.has(g)).length;
      const kOpp = other.filter(g => S.has(g)).length;
      if (!mine.length && !k) continue;
      out.push({ name, k, n: mine.length, K: S.size, opp: kOpp,
                 p: mine.length ? hyperP(k, S.size, mine.length, BG) : null });
    }
    out.sort((a, b) => (a.p ?? 1) - (b.p ?? 1));
    tbl(document.getElementById("a-out"),
      [["Reference set", r => r.name], ["Overlap", r => `${r.k} / ${r.n} vs set ${r.K}`],
       ["Hypergeometric p", r => r.p === null ? "" : r.p.toExponential(2)],
       ["Opposite-direction hits", r => r.opp]], out);
  };
  const idx = await J("data/gene_index.json");
  document.getElementById("g-run").onclick = async () => {
    const q = document.getElementById("g-q").value.trim();
    const out = document.getElementById("g-out");
    if (!q) return;
    const shard = /[a-z0-9]/i.test(q[0]) ? q[0].toLowerCase() : "other";
    let genes;
    try { genes = await J(`data/genes/${shard}.json`); } catch (e) { genes = {}; }
    const key = Object.keys(genes).find(g => g.toLowerCase() === q.toLowerCase());
    if (!key) { out.innerHTML = `<p>No records for ${esc(q)} (genes indexed: ${idx.n_genes}).</p>`; return; }
    const rec = genes[key];
    let h = `<h3>${esc(key)}</h3>`;
    if (rec.bulk) {
      h += `<h4>Bulk contrasts (${rec.bulk.length})</h4><table class="t"><thead><tr><th>Layer</th><th>Study</th><th>Contrast</th><th>logFC</th><th>FDR</th></tr></thead><tbody>` +
        rec.bulk.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join("") + "</tbody></table>";
    }
    if (rec.sc) {
      h += `<h4>Single-cell DE (${rec.sc.length})</h4><table class="t"><thead><tr><th>Series</th><th>Contrast</th><th>Cell type</th><th>logFC</th><th>FDR</th></tr></thead><tbody>` +
        rec.sc.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join("") + "</tbody></table>";
    }
    out.innerHTML = h;
  };
})();
applyLang();
