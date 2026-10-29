// CochleaConsensus front-end: i18n toggle + data-driven tables + interactive browsers + Analyze tools.
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
function T(en, zh) { return LANG === "en" ? en : zh; }

// Sortable-table helpers. cols: {h: header, f: cell fn, s: sort-key fn (default f)}
function sortRows(rows, cols, st) {
  const out = rows.slice();
  if (!st || st.i < 0) return out;
  const k = cols[st.i].s || cols[st.i].f;
  out.sort((a, b) => {
    const x = k(a), y = k(b);
    if (typeof x === "number" && typeof y === "number") return (x - y) * st.dir;
    return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true }) * st.dir;
  });
  return out;
}
function theadS(cols, st) {
  return "<thead><tr>" + cols.map((c, i) =>
    `<th data-ci="${i}" style="cursor:pointer" title="sort">${c.h}${st && st.i === i ? (st.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("") + "</tr></thead>";
}
function bindSort(el, st, redraw) {
  el.querySelectorAll("th[data-ci]").forEach(th => th.onclick = () => {
    const i = +th.dataset.ci;
    if (st.i === i) st.dir = -st.dir; else { st.i = i; st.dir = 1; }
    redraw();
  });
}
function renderS(el, cols, rows, st) {
  const rs = sortRows(rows, cols, st);
  el.innerHTML = theadS(cols, st) + "<tbody>" +
    rs.map(r => "<tr>" + cols.map(c => `<td>${c.f(r) ?? ""}</td>`).join("") + "</tr>").join("") + "</tbody>";
  return rs;
}

const PAGE = document.body.dataset.page;

// ------------------------------------------------------------- Home
if (PAGE === "index.html") {
  const form = document.getElementById("home-gene-form");
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const q = document.getElementById("home-gene").value.trim();
    if (q) location.href = "analyze.html?gene=" + encodeURIComponent(q);
  };
}

// ------------------------------------------------------------- Cohorts
if (PAGE === "cohorts.html") (async () => {
  const d = await J("data/cohorts.json");
  let contrastsP = null; // lazy-loaded on first row expansion
  const fl = document.getElementById("f-layer"), fv = document.getElementById("f-verdict"),
        fs = document.getElementById("f-species");
  [...new Set(d.map(r => r.layer))].sort().forEach(v => fl.add(new Option(v, v)));
  [...new Set(d.map(r => r.sp))].sort().forEach(v => fs.add(new Option(v, v)));
  [...new Set(d.map(r => r.verdict).filter(Boolean))].sort().forEach(v => fv.add(new Option(v, v)));
  const cols = [
    { h: "GSE", f: r => `<a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.gse}">${r.gse}</a>`, s: r => r.gse },
    { h: "Title", f: r => esc(r.title), s: r => r.title.toLowerCase() },
    { h: "Layer", f: r => r.layer, s: r => r.layer },
    { h: "Species", f: r => r.sp, s: r => r.sp },
    { h: "Tier", f: r => r.tier, s: r => r.tier },
    { h: "Samples", f: r => r.n, s: r => r.n },
    { h: "Verdict", f: r => r.verdict, s: r => r.verdict },
    { h: "Note", f: r => r.verdict === "unusable" ? esc(r.reason) : "", s: r => r.reason || "" }];
  const st = { i: -1, dir: 1 };
  const expanded = new Set();
  let contrasts = null;
  async function ensureContrasts() {
    if (!contrastsP) contrastsP = J("data/cohort_contrasts.json");
    contrasts = await contrastsP;
  }
  function detailHtml(r) {
    const cs = (contrasts && contrasts[r.gse]) || [];
    if (!contrasts) return T("Loading contrast detail…", "正在加载对比明细…");
    if (!cs.length) return T("No adjudicated comparable contrast for this series.",
      "该系列无裁定的可比对比。") + (r.reason ? " " + esc(r.reason) : "");
    return cs.map(c => `<div><b>${esc(c.case)}</b> vs <b>${esc(c.ctrl)}</b>` +
      ` · n=${esc(c.nc)}v${esc(c.nk)} · ${esc(c.tissue)} · ${esc(c.platform)}` +
      (c.note ? ` · ${esc(c.note)}` : "") + "</div>").join("");
  }
  function draw() {
    const q = document.getElementById("f-q").value.toLowerCase();
    const rows = d.filter(r => (!fl.value || r.layer === fl.value) &&
      (!fv.value || r.verdict === fv.value) && (!fs.value || r.sp === fs.value) &&
      (!q || (r.gse + " " + r.title).toLowerCase().includes(q)));
    document.getElementById("f-count").textContent =
      rows.length + T(" series", " 个系列");
    const el = document.getElementById("cohort-table");
    const rs = sortRows(rows, cols, st);
    el.innerHTML = theadS(cols, st) + "<tbody>" + rs.map(r => {
      const main = `<tr data-gse="${r.gse}" style="cursor:pointer">` +
        cols.map(c => `<td>${c.f(r) ?? ""}</td>`).join("") + "</tr>";
      const det = expanded.has(r.gse)
        ? `<tr class="detailrow"><td colspan="${cols.length}">${detailHtml(r)}</td></tr>` : "";
      return main + det;
    }).join("") + "</tbody>";
    bindSort(el, st, draw);
    el.querySelectorAll("tr[data-gse]").forEach(tr => tr.onclick = async e => {
      if (e.target.tagName === "A") return;
      const g = tr.dataset.gse;
      if (expanded.has(g)) { expanded.delete(g); draw(); return; }
      expanded.add(g);
      if (!contrasts) { draw(); await ensureContrasts(); }
      draw();
    });
  }
  [fl, fv, fs].forEach(e => e.onchange = draw);
  document.getElementById("f-q").oninput = draw; draw();
})();

// ------------------------------------------------------------- Consensus
if (PAGE === "consensus.html") (async () => {
  const sel = document.getElementById("c-layer");
  const layers = ["GENETIC", "NOISE", "OTOTOX", "REGEN", "FISH-regen"];
  layers.forEach(l => sel.add(new Option(l, l)));
  const cache = {};
  const dirSel = document.getElementById("c-dir"), slider = document.getElementById("c-minns");
  let filtered = [];
  async function draw() {
    const L = sel.value;
    if (!cache[L]) cache[L] = await J(`data/consensus_${L}.json`);
    const q = document.getElementById("c-q").value.toLowerCase();
    const minns = +slider.value;
    document.getElementById("c-minns-v").textContent = minns;
    filtered = cache[L].filter(r => (!dirSel.value || r.d === dirSel.value) &&
      r.ns >= minns && (!q || r.g.toLowerCase().includes(q)));
    document.getElementById("c-count").textContent = T(
      `${cache[L].length} cross-study consensus genes · ${filtered.length} after filters (showing ${Math.min(filtered.length, 500)})`,
      `跨研究共识基因 ${cache[L].length} 个 · 筛选后 ${filtered.length} 个（显示前 ${Math.min(filtered.length, 500)}）`);
    tbl(document.getElementById("consensus-table"),
      [["Gene", r => r.g], ["Direction", r => r.d], ["Grade", r => r.gr],
       ["mean logFC", r => r.lf], ["min FDR", r => r.fdr], ["Studies", r => r.ns]],
      filtered.slice(0, 500));
  }
  sel.onchange = draw; dirSel.onchange = draw; slider.oninput = draw;
  document.getElementById("c-q").oninput = draw;
  document.getElementById("c-export").onclick = () => {
    const csv = "gene,direction,grade,mean_logFC,min_FDR,n_studies\n" +
      filtered.map(r => [r.g, r.d, r.gr, r.lf, r.fdr, r.ns].join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `consensus_${sel.value}_filtered.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };
  draw();
  const core = await J("data/cross_core.json");
  const coreEl = document.getElementById("core-table");
  function drawCore(hl) {
    coreEl.innerHTML = "<thead><tr><th>Gene</th><th>Direction</th><th>Layers</th><th>mean logFC</th></tr></thead><tbody>" +
      core.map(r => {
        const chips = r.layers.split(";").map(l =>
          `<span class="chip${hl === r.gene ? " hl" : ""}">${l}</span>`).join(" ");
        return `<tr data-gene="${esc(r.gene)}" style="cursor:pointer"><td><b>${esc(r.gene)}</b></td>` +
          `<td>${r.direction}</td><td>${chips}</td><td>${r.mean_logFC}</td></tr>`;
      }).join("") + "</tbody>";
    coreEl.querySelectorAll("tr[data-gene]").forEach(tr => tr.onclick = () => {
      const g = tr.dataset.gene;
      document.getElementById("c-q").value = g;
      drawCore(g); draw();
      document.getElementById("consensus-table").scrollIntoView({ block: "center" });
    });
  }
  drawCore(null);
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
  const pcols = [
    { h: "Database", f: r => r.db, s: r => r.db },
    { h: "Term", f: r => esc(r.t), s: r => r.t.toLowerCase() },
    { h: "q", f: r => r.q.toExponential(2), s: r => r.q },
    { h: "Genes", f: r => r.n, s: r => r.n },
    { h: "GeneRatio", f: r => r.gr, s: r => r.gr }];
  const pst = { i: 2, dir: 1 };
  const tfst = { i: 2, dir: 1 };
  function draw() {
    const s = sel.value;
    const dbf = document.getElementById("p-db").value;
    const q = document.getElementById("p-q").value.toLowerCase();
    const out = [];
    for (const db of ["GO_BP", "GO_CC", "GO_MF", "KEGG", "Reactome"]) {
      if (dbf && db !== dbf) continue;
      for (const t of (pw[s][db] || [])) out.push({ db, ...t });
    }
    const rows = out.filter(r => !q || r.t.toLowerCase().includes(q));
    document.getElementById("p-count").textContent = T(
      `${rows.length} terms (top 50 per database, q < 0.05)`,
      `${rows.length} 条词条（每数据库前 50，q < 0.05）`);
    const el = document.getElementById("pathway-table");
    renderS(el, pcols, rows.slice(0, 200), pst); bindSort(el, pst, draw);
    const layer = s.replace("bulk_", "").replace("ortho_", "").replace(/_(up|down)$/, "");
    document.getElementById("p-dot").src = `img/dotplot_${s.startsWith("ortho") ? "ortho_" : "bulk_"}${layer}.png`;
    const tq = document.getElementById("tf-q").value.toLowerCase();
    const trows = (tf[s] || []).filter(t => !tq || t.tf.toLowerCase().includes(tq));
    document.getElementById("tf-count").textContent = T(
      `${trows.length} significant TFs in this set`, `本集 ${trows.length} 个显著 TF`);
    const tfcols = [
      { h: "TF", f: r => r.tf, s: r => r.tf.toLowerCase() },
      { h: "Regulon overlap", f: r => r.ov, s: r => r.ov },
      { h: "q", f: r => r.q.toExponential(2), s: r => r.q }];
    const tel = document.getElementById("tf-table");
    renderS(tel, tfcols, trows, tfst); bindSort(tel, tfst, draw);
  }
  sel.onchange = draw;
  document.getElementById("p-db").onchange = draw;
  document.getElementById("p-q").oninput = draw;
  document.getElementById("tf-q").oninput = draw;
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

  // ---- DE browser
  const tables = await J("data/sc_tables.json");
  const dSeries = document.getElementById("de-series"), dTable = document.getElementById("de-table");
  [...new Set(tables.map(t => t.series))].sort().forEach(v => dSeries.add(new Option(v, v)));
  const deCache = {};
  let deRows = [];
  const decols = [
    { h: "Gene", f: r => r.g, s: r => r.g.toLowerCase() },
    { h: "logFC", f: r => r.lf.toFixed(3), s: r => r.lf },
    { h: "|logFC|", f: r => Math.abs(r.lf).toFixed(3), s: r => Math.abs(r.lf) },
    { h: "FDR", f: r => r.fdr.toExponential(2), s: r => r.fdr }];
  const dest = { i: 2, dir: -1 };
  function drawDE() {
    const q = document.getElementById("de-q").value.toLowerCase();
    const minlf = +document.getElementById("de-lfc").value;
    const maxfdr = +document.getElementById("de-fdr").value;
    const rows = deRows.filter(r => Math.abs(r.lf) >= minlf && r.fdr <= maxfdr &&
      (!q || r.g.toLowerCase().includes(q)));
    const el = document.getElementById("de-results");
    const rs = sortRows(rows, decols, dest).slice(0, 200);
    el.innerHTML = theadS(decols, dest) + "<tbody>" +
      rs.map(r => "<tr>" + decols.map(c => `<td>${c.f(r) ?? ""}</td>`).join("") + "</tr>").join("") + "</tbody>";
    bindSort(el, dest, drawDE);
    document.getElementById("de-count").textContent = T(
      `Showing ${rs.length} / ${rows.length} significant genes (table total ${deRows.length}, FDR < 0.05)`,
      `显示 ${rs.length} / ${rows.length} 个显著基因（本表共 ${deRows.length} 个，FDR < 0.05）`);
  }
  async function loadTable() {
    const meta = tables.filter(t => t.series === dSeries.value)[+dTable.value || 0];
    if (!meta) { deRows = []; drawDE(); return; }
    if (!deCache[meta.file])
      deCache[meta.file] = (await J(`data/sc_de/${meta.file}`))
        .map(a => ({ g: a[0], lf: a[1], fdr: a[2] }));
    deRows = deCache[meta.file];
    drawDE();
  }
  function fillTables() {
    dTable.innerHTML = "";
    tables.filter(t => t.series === dSeries.value).forEach((t, i) => {
      const o = new Option(`${t.contrast} · ${t.celltype} (${t.nsig} sig)`, String(i));
      dTable.add(o);
    });
    loadTable();
  }
  dSeries.onchange = fillTables; dTable.onchange = loadTable;
  ["de-q", "de-lfc", "de-fdr"].forEach(id => document.getElementById(id).oninput = drawDE);
  document.getElementById("de-fdr").onchange = drawDE;
  document.getElementById("de-lfc").onchange = drawDE;
  fillTables();

  // ---- Composition comparator
  const comp = await J("data/sc_comp.json");
  const compSeries = Object.keys(comp).sort();
  const cA = document.getElementById("comp-a"), cB = document.getElementById("comp-b");
  compSeries.forEach(v => { cA.add(new Option(v, v)); cB.add(new Option(v, v)); });
  const allCt = [...new Set(compSeries.flatMap(s => comp[s].ct))].sort();
  const PALETTE = ["#1a6fb5", "#e67e22", "#27ae60", "#8e44ad", "#c0392b", "#16a085",
    "#f39c12", "#2c3e50", "#d35400", "#7f8c8d", "#2980b9", "#e84393", "#6c5ce7",
    "#00b894", "#b8860b", "#5d6d7e", "#a93226", "#1abc9c", "#9b59b6", "#34495e",
    "#d4ac0d", "#ba4a00", "#117a65", "#6e5100"];
  const ctColor = {};
  allCt.forEach((c, i) => ctColor[c] = PALETTE[i % PALETTE.length]);
  function barRow(label, series, fracs) {
    let x = 0, rects = "";
    series.ct.forEach((c, i) => {
      const w = fracs[i] * 640;
      if (w > 0.05) rects += `<rect x="${(110 + x).toFixed(1)}" y="0" width="${w.toFixed(1)}" height="20" fill="${ctColor[c]}"><title>${esc(c)} ${(100 * fracs[i]).toFixed(1)}%</title></rect>`;
      x += w;
    });
    return `<text x="0" y="15" font-size="12">${esc(label)}</text>${rects}`;
  }
  function seriesBlock(series, split) {
    const e = comp[series];
    let rowsHtml = "", y = 0;
    const addRow = (label, fracs) => {
      rowsHtml += `<g transform="translate(0 ${y})">${barRow(label, e, fracs)}</g>`; y += 26;
    };
    if (split && e.groups) {
      for (const g of Object.keys(e.groups)) addRow(`${g} (n=${e.gn[g]})`, e.groups[g]);
    } else addRow(T("All cells", "全部细胞"), e.all);
    return `<div class="compblock"><h3>${series} · ${e.n.toLocaleString()} ${T("cells", "个细胞")}</h3>` +
      `<svg viewBox="0 0 760 ${y}" width="100%" role="img">${rowsHtml}</svg></div>`;
  }
  function drawComp() {
    const split = document.getElementById("comp-split").checked;
    const A = cA.value, B = cB.value;
    let note = "";
    if (split) for (const s of [A, B]) {
      if (s && !comp[s].groups) note += T(
        `${s} has a single sample-arm group in the metadata — shown combined. `,
        `${s} 在元数据中只有一个样本臂分组——合并展示。`);
    }
    document.getElementById("comp-note").textContent = note;
    let h = seriesBlock(A, split);
    if (B) h += seriesBlock(B, split);
    const present = [...new Set([A, B].filter(Boolean).flatMap(s => comp[s].ct))];
    h += `<div class="complegend">` + present.map(c =>
      `<span class="legitem"><span class="swatch" style="background:${ctColor[c]}"></span>${esc(c)}</span>`).join("") + "</div>";
    document.getElementById("comp-chart").innerHTML = h;
  }
  cA.onchange = drawComp; cB.onchange = drawComp;
  document.getElementById("comp-split").onchange = drawComp;
  drawComp();
})();

// ------------------------------------------------------------- Ortholog
if (PAGE === "ortholog.html") (async () => {
  const d = await J("data/ortho.json");
  tbl(document.getElementById("ortho-table"),
    [["Mouse layer", r => r.layer], ["1:1 pairs", r => r.pairs],
     ["Same-direction fraction", r => r.frac], ["Permutation p", r => r.perm],
     ["Binomial p", r => r.binom], ["Spearman rho", r => r.rho]], d);
  const sel = document.getElementById("o-layer");
  ["GENETIC", "NOISE", "OTOTOX", "REGEN", "AGING"].forEach(l => sel.add(new Option(l, l)));
  const cache = {};
  let rows = [];
  const ocols = [
    { h: "Mouse gene", f: r => r.g, s: r => r.g.toLowerCase() },
    { h: "Fish gene", f: r => r.f, s: r => r.f.toLowerCase() },
    { h: "Direction", f: r => r.d, s: r => r.d },
    { h: "logFC mouse", f: r => r.lm, s: r => r.lm },
    { h: "logFC fish", f: r => r.lf, s: r => r.lf },
    { h: "Double-strong", f: r => r.s ? "yes" : "—", s: r => r.s }];
  const ost = { i: -1, dir: 1 };
  function drawStats() {
    const s = d.find(r => r.layer === sel.value);
    if (!s) { document.getElementById("o-stats").innerHTML = ""; return; }
    document.getElementById("o-stats").innerHTML =
      `<div class="card"><b>${s.pairs.toLocaleString()}</b><span>1:1 ortholog pairs</span></div>` +
      `<div class="card"><b>${s.frac}</b><span>same-direction fraction</span></div>` +
      `<div class="card"><b>${esc(s.perm)}</b><span>permutation p</span></div>` +
      `<div class="card"><b>${esc(s.binom)}</b><span>binomial p</span></div>` +
      `<div class="card"><b>${s.rho}</b><span>Spearman rho</span></div>`;
  }
  function draw() {
    const q = document.getElementById("o-q").value.toLowerCase();
    const dir = document.getElementById("o-dir").value;
    const f = rows.filter(r => (!dir || r.d === dir) &&
      (!q || r.g.toLowerCase().includes(q) || r.f.toLowerCase().includes(q)));
    document.getElementById("o-count").textContent = T(
      `${f.length} concordant pairs (showing ${Math.min(f.length, 200)})`,
      `同向基因对 ${f.length} 个（显示前 ${Math.min(f.length, 200)}）`);
    const el = document.getElementById("o-table");
    const rs = sortRows(f, ocols, ost).slice(0, 200);
    el.innerHTML = theadS(ocols, ost) + "<tbody>" +
      rs.map(r => "<tr>" + ocols.map(c => `<td>${c.f(r) ?? ""}</td>`).join("") + "</tr>").join("") + "</tbody>";
    bindSort(el, ost, draw);
  }
  async function loadLayer() {
    const L = sel.value;
    if (!cache[L]) cache[L] = await J(`data/ortho_genes_${L}.json`);
    rows = cache[L];
    drawStats(); draw();
  }
  sel.onchange = loadLayer;
  document.getElementById("o-dir").onchange = draw;
  document.getElementById("o-q").oninput = draw;
  loadLayer();
})();

// ------------------------------------------------------------- Aging
if (PAGE === "aging.html") (async () => {
  const d = await J("data/aging.json");
  const tierSel = document.getElementById("ag-tier"), vSel = document.getElementById("ag-verdict");
  [...new Set(d.map(r => r.tier))].sort().forEach(v => tierSel.add(new Option(v, v)));
  [...new Set(d.map(r => r.verdict).filter(Boolean))].sort().forEach(v => vSel.add(new Option(v, v)));
  const cols = [
    { h: "GSE", f: r => `<a href="https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.gse}">${r.gse}</a>`, s: r => r.gse },
    { h: "Title", f: r => esc(r.title), s: r => r.title.toLowerCase() },
    { h: "Tier", f: r => r.tier, s: r => r.tier },
    { h: "Samples", f: r => r.n, s: r => r.n },
    { h: "Verdict", f: r => r.verdict, s: r => r.verdict },
    { h: "Note", f: r => esc(r.note), s: r => r.note || "" }];
  const st = { i: -1, dir: 1 };
  function draw() {
    const q = document.getElementById("ag-q").value.toLowerCase();
    const rows = d.filter(r => (!tierSel.value || r.tier === tierSel.value) &&
      (!vSel.value || r.verdict === vSel.value) &&
      (!q || (r.gse + " " + r.title + " " + (r.note || "")).toLowerCase().includes(q)));
    document.getElementById("ag-count").textContent =
      rows.length + T(" of 25 series", " / 共 25 个系列");
    const el = document.getElementById("aging-table");
    renderS(el, cols, rows, st); bindSort(el, st, draw);
  }
  tierSel.onchange = draw; vSel.onchange = draw;
  document.getElementById("ag-q").oninput = draw; draw();
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
  async function lookupGene(q) {
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
        rec.bulk.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${(+r[4]).toFixed(3)}</td><td>${(+r[5]).toExponential(2)}</td></tr>`).join("") + "</tbody></table>";
    }
    if (rec.sc) {
      h += `<h4>Single-cell DE (${rec.sc.length})</h4><table class="t"><thead><tr><th>Series</th><th>Contrast</th><th>Cell type</th><th>logFC</th><th>FDR</th></tr></thead><tbody>` +
        rec.sc.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${(+r[3]).toFixed(3)}</td><td>${(+r[4]).toExponential(2)}</td></tr>`).join("") + "</tbody></table>";
    }
    out.innerHTML = h;
  }
  document.getElementById("g-run").onclick = () =>
    lookupGene(document.getElementById("g-q").value.trim());
  const pre = new URLSearchParams(location.search).get("gene");
  if (pre) {
    document.getElementById("g-q").value = pre;
    lookupGene(pre.trim());
  }
})();
applyLang();
