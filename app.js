// ATS + Hiring Manager resume review — all analysis runs client-side.

if (window["pdfjsLib"]) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const resumeTextEl = document.getElementById("resumeText");
const jdTextEl = document.getElementById("jdText");
const resumeWordCountEl = document.getElementById("resumeWordCount");
const jdWordCountEl = document.getElementById("jdWordCount");
const resumeFileStatusEl = document.getElementById("resumeFileStatus");
const jdFileStatusEl = document.getElementById("jdFileStatus");
const analyzeBtn = document.getElementById("analyzeBtn");
const analyzeErrorEl = document.getElementById("analyzeError");
const resultsEl = document.getElementById("diagnoseResults");

function wordCount(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

function refreshWordCount(el, target) {
  target.textContent = `${wordCount(el.value)} words`;
}

resumeTextEl.addEventListener("input", () => refreshWordCount(resumeTextEl, resumeWordCountEl));
jdTextEl.addEventListener("input", () => refreshWordCount(jdTextEl, jdWordCountEl));

async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) {
    return await file.text();
  }
  if (name.endsWith(".pdf")) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text;
  }
  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }
  throw new Error("Unsupported file type. Use .pdf, .docx, or .txt.");
}

function wireFileInput(inputId, textEl, statusEl, wordCountEl) {
  document.getElementById(inputId).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    statusEl.textContent = "Reading...";
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) {
        statusEl.textContent = `${file.name}: no extractable text (likely a scanned/image file)`;
        return;
      }
      textEl.value = text.trim();
      refreshWordCount(textEl, wordCountEl);
      statusEl.textContent = `Loaded: ${file.name}`;
    } catch (err) {
      statusEl.textContent = `Failed to read ${file.name}: ${err.message}`;
    }
  });
}

wireFileInput("resumeFile", resumeTextEl, resumeFileStatusEl, resumeWordCountEl);
wireFileInput("jdFile", jdTextEl, jdFileStatusEl, jdWordCountEl);

// ---------- text analysis helpers ----------

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function getContentLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 15 && l.length < 300 && !/^[A-Z\s&/,.-]+$/.test(l));
}

function stripLeadingBullet(line) {
  return line.replace(/^[•●▪○◦*\-]+\s*/, "").trim();
}

function extractKeywords(jdText, limit = 25) {
  const rawWords = jdText
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter(Boolean);

  const freq = {};
  rawWords.forEach((w) => {
    if (STOPWORDS.has(w) || w.length <= 2 || /^\d+$/.test(w)) return;
    freq[w] = (freq[w] || 0) + 1;
  });

  const bigramFreq = {};
  for (let i = 0; i < rawWords.length - 1; i++) {
    const a = rawWords[i];
    const b = rawWords[i + 1];
    if (STOPWORDS.has(a) || STOPWORDS.has(b) || a.length < 3 || b.length < 3) continue;
    const bg = `${a} ${b}`;
    bigramFreq[bg] = (bigramFreq[bg] || 0) + 1;
  }

  const unigramEntries = Object.entries(freq).map(([term, count]) => ({ term, weight: count }));
  const bigramEntries = Object.entries(bigramFreq)
    .filter(([, c]) => c > 1)
    .map(([term, count]) => ({ term, weight: count * 1.8 }));

  const combined = [...bigramEntries, ...unigramEntries].sort((a, b) => b.weight - a.weight);

  const seen = new Set();
  const result = [];
  for (const item of combined) {
    if (seen.has(item.term)) continue;
    seen.add(item.term);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function matchKeywords(keywords, resumeText) {
  const lower = resumeText.toLowerCase();
  const matched = [];
  const missing = [];
  keywords.forEach((k) => {
    const term = k.term;
    const singular = term.endsWith("s") && term.length > 4 ? term.slice(0, -1) : term;
    const pattern = new RegExp(escapeRegex(term) + "|" + escapeRegex(singular), "i");
    if (pattern.test(lower)) matched.push(term);
    else missing.push(term);
  });
  return { matched, missing };
}

function findSkillsInText(text, skillList) {
  const lower = text.toLowerCase();
  const found = [];
  skillList.forEach((skill) => {
    const pattern = new RegExp("(^|[^a-z0-9])" + escapeRegex(skill.toLowerCase()) + "([^a-z0-9]|$)", "i");
    if (pattern.test(lower)) found.push(skill);
  });
  return found;
}

function matchSkills(resumeText, jdText) {
  const jdSkills = findSkillsInText(jdText, SKILL_DICTIONARY);
  const resumeSkills = findSkillsInText(resumeText, SKILL_DICTIONARY);
  return {
    matched: jdSkills.filter((s) => resumeSkills.includes(s)),
    missing: jdSkills.filter((s) => !resumeSkills.includes(s)),
    bonus: resumeSkills.filter((s) => !jdSkills.includes(s)),
  };
}

function quantificationCheck(resumeText) {
  const lines = getContentLines(resumeText);
  const numRegex = /(\$\s?\d|\d+(\.\d+)?\s?%|\b\d{2,}\b|\d+x\b)/i;
  const quantified = lines.filter((l) => numRegex.test(l));
  return {
    total: lines.length,
    quantified: quantified.length,
    pct: lines.length ? Math.round((quantified.length / lines.length) * 100) : 0,
  };
}

function actionVerbCheck(resumeText) {
  const lines = getContentLines(resumeText);
  let strongCount = 0;
  lines.forEach((line) => {
    const clean = stripLeadingBullet(line);
    const firstWord = (clean.split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
    if (STRONG_ACTION_VERBS.includes(firstWord)) strongCount++;
  });
  const lowerFull = resumeText.toLowerCase();
  const weakHits = WEAK_PHRASES.filter((phrase) => lowerFull.includes(phrase));
  return {
    totalLines: lines.length,
    strongCount,
    strongPct: lines.length ? Math.round((strongCount / lines.length) * 100) : 0,
    weakHits,
  };
}

function formatChecksFn(resumeText) {
  const checks = [];
  const words = tokenize(resumeText).length;

  if (words < 180) {
    checks.push({
      label: "Resume length",
      status: "fail",
      detail: `Only ~${words} words. This reads as thin, likely under half a page of real content. A hiring manager may assume you're junior or that the resume is incomplete.`,
    });
  } else if (words > 1100) {
    checks.push({
      label: "Resume length",
      status: "warn",
      detail: `~${words} words, likely running 3+ pages. Trim to the most relevant, recent, and quantifiable material.`,
    });
  } else {
    checks.push({ label: "Resume length", status: "pass", detail: `~${words} words, a reasonable 1-2 page length.` });
  }

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(resumeText);
  const hasPhone = /(\+?\d[\d\s().-]{8,}\d)/.test(resumeText);
  if (hasEmail && hasPhone) {
    checks.push({ label: "Contact information", status: "pass", detail: "Email and phone number both detected." });
  } else {
    const missingParts = [!hasEmail && "an email address", !hasPhone && "a phone number"].filter(Boolean).join(" and ");
    checks.push({
      label: "Contact information",
      status: "fail",
      detail: `Missing ${missingParts}. Put this in plain text at the top of the page, not inside a header/footer or text box, which many ATS parsers skip entirely.`,
    });
  }

  EXPECTED_SECTIONS.forEach((section) => {
    if (section.name === "Contact Info") return;
    const found = section.patterns.some((p) => p.test(resumeText));
    checks.push({
      label: `${section.name} section`,
      status: found ? "pass" : "warn",
      detail: found
        ? `A recognizable "${section.name}" heading was found.`
        : `No clear "${section.name}" heading detected. Use a standard, literal heading, ATS parsers and hiring managers both rely on it.`,
    });
  });

  const lines = resumeText.split(/\r?\n/);
  const suspiciousLines = lines.filter((l) => /\t/.test(l) || /\s{4,}\S+\s{4,}/.test(l));
  if (suspiciousLines.length > Math.max(3, lines.length * 0.05)) {
    checks.push({
      label: "Layout / tables",
      status: "warn",
      detail:
        "Detected several lines with large internal gaps or tab characters, often a sign of a multi-column layout or table. Many ATS parsers read left-to-right per line and scramble the order. A single-column layout is safest.",
    });
  } else {
    checks.push({
      label: "Layout / tables",
      status: "pass",
      detail: "No strong signs of a multi-column or table-based layout that would confuse an ATS parser.",
    });
  }

  const bulletLines = lines.filter((l) => /^\s*[•●▪○◦*-]/.test(l));
  if (bulletLines.length < 3) {
    checks.push({
      label: "Bullet structure",
      status: "warn",
      detail: "Few or no bullet points detected. Dense paragraphs are harder to scan in the few seconds a first pass gets.",
    });
  } else {
    checks.push({ label: "Bullet structure", status: "pass", detail: `${bulletLines.length} bullet points detected, a scannable format.` });
  }

  return checks;
}

function computeScore({ keywordMatch, skillMatch, quant, verbs, formatChecks }) {
  const kwTotal = keywordMatch.matched.length + keywordMatch.missing.length;
  const kwPct = kwTotal > 0 ? (keywordMatch.matched.length / kwTotal) * 100 : 100;

  const skillTotal = skillMatch.matched.length + skillMatch.missing.length;
  const skillPct = skillTotal > 0 ? (skillMatch.matched.length / skillTotal) * 100 : 100;

  const quantPct = quant.pct;

  let langScore = verbs.totalLines ? (verbs.strongCount / verbs.totalLines) * 100 : 50;
  langScore = Math.max(0, Math.min(100, langScore - verbs.weakHits.length * 5));

  const formatPassCount = formatChecks.filter((c) => c.status === "pass").length;
  const formatPct = formatChecks.length ? (formatPassCount / formatChecks.length) * 100 : 100;

  const weights = { kw: 0.35, skill: 0.2, quant: 0.15, lang: 0.1, format: 0.2 };
  const overall = kwPct * weights.kw + skillPct * weights.skill + quantPct * weights.quant + langScore * weights.lang + formatPct * weights.format;

  return {
    overall: Math.round(overall),
    breakdown: [
      { label: "Keyword Match", pct: Math.round(kwPct) },
      { label: "Hard Skills Match", pct: Math.round(skillPct) },
      { label: "Quantified Impact", pct: Math.round(quantPct) },
      { label: "Language Strength", pct: Math.round(langScore) },
      { label: "ATS Formatting", pct: Math.round(formatPct) },
    ],
  };
}

function getVerdict(score) {
  if (score >= 80)
    return {
      tag: "Strong Match",
      cls: "good",
      text: "I would move this forward to a phone screen without hesitation. Tighten the few gaps below and it is genuinely competitive.",
    };
  if (score >= 60)
    return {
      tag: "Borderline",
      cls: "warn",
      text: 'This could go either way depending on the rest of the applicant pool. Close the gaps below and it moves from "maybe" to "yes."',
    };
  return {
    tag: "Needs Work",
    cls: "bad",
    text: "As written, this is likely filtered out before a human opens it, or skimmed and set aside. The fixes below are not optional.",
  };
}

function buildHiringManagerNotes(data) {
  const { keywordMatch, skillMatch, quant, verbs, formatChecks, score } = data;
  const paras = [];
  const kwTotal = keywordMatch.matched.length + keywordMatch.missing.length;

  paras.push(
    `I've screened enough resumes to know within the first pass whether someone bothered to read the job posting. ${keywordMatch.matched.length} of the ${kwTotal} key terms from this posting show up in your resume. That tells me ${
      kwTotal && keywordMatch.matched.length >= kwTotal * 0.7
        ? "you tailored this, and I notice that."
        : "this may be a generic resume sent to several postings, which is usually obvious to whoever's reading it."
    }`
  );

  if (skillMatch.missing.length) {
    paras.push(
      `On hard skills specifically, I don't see ${skillMatch.missing
        .slice(0, 6)
        .map((s) => `"${s}"`)
        .join(", ")} anywhere in your resume, even though the posting calls for ${
        skillMatch.missing.length === 1 ? "it" : "them"
      }. If you have this experience, it needs to be on the page in plain language. I am not going to infer it, and neither will the software that filters this before I see it.`
    );
  } else if (skillMatch.matched.length) {
    paras.push(
      `Your hard skills line up well with what's being asked for: ${skillMatch.matched.slice(0, 6).join(", ")} are all present. That part is done.`
    );
  }

  if (quant.pct < 30) {
    paras.push(
      `Only about ${quant.pct}% of your bullet points include a number, percentage, or dollar figure. Most resumes I read say "responsible for" something. The one that says "cut onboarding time 30%" or "managed a $2M budget" is the one I remember an hour later. Right now, most of your bullets read like a job description, not a track record.`
    );
  } else {
    paras.push(`You're quantifying roughly ${quant.pct}% of your bullet points, which is solid. Numbers are what separate a track record from a list of duties.`);
  }

  if (verbs.weakHits.length) {
    paras.push(
      `I also flagged filler phrases like ${verbs.weakHits
        .slice(0, 4)
        .map((p) => `"${p}"`)
        .join(", ")}. These say nothing about what you actually did or changed. Replace them with a strong verb and a result: not "responsible for managing a team," but "managed a team of 8, cutting turnover 20% in a year."`
    );
  }

  const failedFormat = formatChecks.filter((c) => c.status !== "pass");
  if (failedFormat.length) {
    paras.push(
      `Mechanically, ${failedFormat.length === 1 ? "one thing" : failedFormat.length + " things"} could cause this to get lost before a human sees it: ${failedFormat
        .map((f) => f.label.toLowerCase())
        .join(", ")}. Fix these first, a great resume the software can't parse never reaches my desk.`
    );
  }

  paras.push(`Bottom line: ${getVerdict(score).text}`);
  return paras;
}

function buildFixList(data) {
  const { keywordMatch, skillMatch, quant, verbs, formatChecks } = data;
  const fixes = [];

  if (skillMatch.missing.length) {
    fixes.push(`Add these missing skills if you genuinely have them: ${skillMatch.missing.slice(0, 8).join(", ")}.`);
  }
  if (keywordMatch.missing.length) {
    fixes.push(`Work these job-posting terms into your bullets naturally: ${keywordMatch.missing.slice(0, 8).join(", ")}.`);
  }
  if (quant.pct < 50) {
    fixes.push("Add a number to more bullet points: scope (team size, budget), scale (%, $, volume), or outcome (time saved, revenue, error rate).");
  }
  if (verbs.weakHits.length) {
    fixes.push(`Cut filler phrases (${verbs.weakHits.slice(0, 3).join(", ")}) and start bullets with a strong action verb instead.`);
  }
  formatChecks.filter((c) => c.status !== "pass").forEach((c) => fixes.push(`${c.label}: ${c.detail}`));

  if (!fixes.length) fixes.push("No major gaps found, minor polish only. Have someone else proofread for typos before you submit.");
  return fixes.slice(0, 8);
}

// ---------- rendering ----------

function renderChips(container, items, extraClass) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<span class="empty-note">None</span>`;
    return;
  }
  items.forEach((item) => {
    const span = document.createElement("span");
    span.className = "chip" + (extraClass ? " " + extraClass : "");
    span.textContent = item;
    container.appendChild(span);
  });
}

function barColor(pct) {
  if (pct >= 75) return "var(--good)";
  if (pct >= 50) return "var(--warn)";
  return "var(--bad)";
}

function render(data) {
  const { keywordMatch, skillMatch, quant, verbs, formatChecks, score } = data;

  // score ring
  const circumference = 377;
  const offset = circumference - (score.overall / 100) * circumference;
  document.getElementById("ringFg").style.strokeDashoffset = offset;
  document.getElementById("ringFg").style.stroke = barColor(score.overall);
  document.getElementById("scoreValue").textContent = score.overall;

  const verdict = getVerdict(score.overall);
  const verdictTag = document.getElementById("verdictTag");
  verdictTag.textContent = verdict.tag;
  verdictTag.className = "verdict-tag " + verdict.cls;
  document.getElementById("verdictText").textContent = verdict.text;

  const breakdownGrid = document.getElementById("breakdownGrid");
  breakdownGrid.innerHTML = "";
  score.breakdown.forEach((item) => {
    const div = document.createElement("div");
    div.className = "breakdown-item";
    div.innerHTML = `
      <h4>${item.label}</h4>
      <div class="bar-track"><div class="bar-fill" style="width:${item.pct}%; background:${barColor(item.pct)}"></div></div>
      <span class="pct" style="color:${barColor(item.pct)}">${item.pct}%</span>
    `;
    breakdownGrid.appendChild(div);
  });

  document.getElementById("kwMatchedCount").textContent = `(${keywordMatch.matched.length})`;
  document.getElementById("kwMissingCount").textContent = `(${keywordMatch.missing.length})`;
  renderChips(document.getElementById("kwMatched"), keywordMatch.matched);
  renderChips(document.getElementById("kwMissing"), keywordMatch.missing, "missing");

  renderChips(document.getElementById("skillMatched"), skillMatch.matched);
  renderChips(document.getElementById("skillMissing"), skillMatch.missing, "missing");
  renderChips(document.getElementById("skillBonus"), skillMatch.bonus, "bonus");

  const checklistEl = document.getElementById("formatChecklist");
  checklistEl.innerHTML = "";
  formatChecks.forEach((c) => {
    const li = document.createElement("li");
    li.className = c.status;
    const icon = c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "!";
    li.innerHTML = `<span class="check-icon">${icon}</span><span><strong>${c.label}</strong> — ${c.detail}</span>`;
    checklistEl.appendChild(li);
  });

  const notesEl = document.getElementById("hmNotes");
  notesEl.innerHTML = "";
  buildHiringManagerNotes(data).forEach((para) => {
    const p = document.createElement("p");
    p.textContent = para;
    notesEl.appendChild(p);
  });

  const fixListEl = document.getElementById("fixList");
  fixListEl.innerHTML = "";
  buildFixList(data).forEach((fix) => {
    const li = document.createElement("li");
    li.textContent = fix;
    fixListEl.appendChild(li);
  });

  resultsEl.classList.remove("hidden");
  resultsEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function analyze() {
  analyzeErrorEl.textContent = "";
  const resumeText = resumeTextEl.value.trim();
  const jdText = jdTextEl.value.trim();

  if (!resumeText || !jdText) {
    analyzeErrorEl.textContent = "Paste or upload both a resume and a job description first.";
    return;
  }
  if (wordCount(resumeText) < 30) {
    analyzeErrorEl.textContent = "That resume looks too short to analyze meaningfully.";
    return;
  }

  const keywords = extractKeywords(jdText, 25);
  const keywordMatch = matchKeywords(keywords, resumeText);
  const skillMatch = matchSkills(resumeText, jdText);
  const quant = quantificationCheck(resumeText);
  const verbs = actionVerbCheck(resumeText);
  const formatChecks = formatChecksFn(resumeText);
  const score = computeScore({ keywordMatch, skillMatch, quant, verbs, formatChecks });

  render({ keywordMatch, skillMatch, quant, verbs, formatChecks, score });
  unlockStep(2);
}

analyzeBtn.addEventListener("click", analyze);

// ---------- wizard navigation ----------

const WORKER_URL = "https://aj-ai-resume-worker.ashlinjaishal23.workers.dev";

let furthestUnlocked = 1;

function unlockStep(n) {
  if (n > furthestUnlocked) furthestUnlocked = n;
}

function goToStep(n) {
  document.querySelectorAll(".step-panel").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.stepPanel) === n);
  });
  document.querySelectorAll("#stepNav li").forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => goToStep(Number(btn.dataset.goto)));
});

document.querySelectorAll("#stepNav li").forEach((li) => {
  li.addEventListener("click", () => {
    const s = Number(li.dataset.step);
    if (s <= furthestUnlocked) goToStep(s);
  });
});

// ---------- step 3: AI rewrite ----------

const rewriteBtn = document.getElementById("rewriteBtn");
const rewriteErrorEl = document.getElementById("rewriteError");
const rewriteLoadingEl = document.getElementById("rewriteLoading");
const rewriteResultsEl = document.getElementById("rewriteResults");
const bulletListEl = document.getElementById("bulletList");

let lastRewrite = null;

async function requestRewrite() {
  rewriteErrorEl.textContent = "";
  const resumeText = resumeTextEl.value.trim();
  const jdText = jdTextEl.value.trim();

  if (!resumeText || !jdText) {
    rewriteErrorEl.textContent = "Go back to Step 1 and add both a resume and a job description first.";
    return;
  }

  rewriteBtn.disabled = true;
  rewriteLoadingEl.classList.remove("hidden");
  rewriteResultsEl.classList.add("hidden");

  try {
    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, jdText }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      rewriteErrorEl.textContent = data.error === "Claude API error"
        ? "AJ.ai's AI backend couldn't complete this request (likely a billing/API key issue on the server side)."
        : data.error || "Something went wrong generating the rewrite.";
      return;
    }

    lastRewrite = data;
    renderRewrite(data);
    unlockStep(4);
  } catch (err) {
    rewriteErrorEl.textContent = "Couldn't reach AJ.ai's server. Check your connection and try again.";
  } finally {
    rewriteBtn.disabled = false;
    rewriteLoadingEl.classList.add("hidden");
  }
}

function renderRewrite(data) {
  bulletListEl.innerHTML = "";
  data.rewrittenBullets.forEach((b) => {
    const div = document.createElement("div");
    div.className = "bullet-item";
    div.innerHTML = `
      <p class="original">${b.original}</p>
      <p class="rewritten">${b.rewritten}</p>
      ${b.note ? `<p class="note">${b.note}</p>` : ""}
    `;
    bulletListEl.appendChild(div);
  });

  document.getElementById("finalResumeOut").value = data.finalResume || "";
  document.getElementById("templateOut").value = data.template || "";

  rewriteResultsEl.classList.remove("hidden");
}

rewriteBtn.addEventListener("click", requestRewrite);

// ---------- step 4: copy buttons ----------

document.querySelectorAll(".copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = document.getElementById(btn.dataset.copyTarget);
    try {
      await navigator.clipboard.writeText(target.value);
      const original = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = original), 1500);
    } catch {
      target.select();
    }
  });
});
