// src/exportResultsExcel.js
import * as XLSX from "xlsx";

/* ---------- helpers ---------- */

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sortByScoreDesc = (arr) =>
  Array.isArray(arr) ? [...arr].sort((a, b) => toNum(b?.score) - toNum(a?.score)) : [];

/** Map one candidate to a flat row with safe fallbacks that match our UI fields. */
function mapRow(c = {}, idx = 0) {
  const name =
    c.name ?? c.candidateName ?? c.fullName ?? "";

  const fileName =
    c.filename ?? c.fileName ?? c.file ?? "";

  const experience =
    c.experience_summary ?? c.experience ?? "";

  const education = c.education ?? "";

  let skills = c.skills_matched;
  if (Array.isArray(skills)) skills = skills.join(", ");
  if (skills == null) skills = ""; // handle undefined/null

  const expScore = toNum(c.experience_score);
  const skillScore = toNum(c.skill_score ?? c.skills_score);
  const eduScore = toNum(c.education_score);
  const indScore = toNum(c.industry_score);

  const breakdownStr = `Exp: ${expScore}, Skills: ${skillScore}, Edu: ${eduScore}, Ind: ${indScore}`;

  return {
    Rank: idx + 1,
    "File Name": fileName,
    Name: name,
    Score: toNum(c.score),
    Experience: experience,
    Education: education,
    "Skills Matched": skills,
    Remark: c.remark ?? "",
    "Score Breakdown": breakdownStr,
  };
}

// Default columns (also used to create header-only sheets when a list is empty)
const COLUMNS = [
  "Rank",
  "File Name",
  "Name",
  "Score",
  "Experience",
  "Education",
  "Skills Matched",
  "Remark",
  "Score Breakdown",
];

function autofit(ws, rows) {
  const src = rows && rows.length ? rows : [Object.fromEntries(COLUMNS.map((k) => [k, ""]))];
  ws["!cols"] = COLUMNS.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...src.map((r) => (r[k] ? String(r[k]).length : 0))
    );
    return { wch: Math.min(Math.max(10, maxLen + 2), 60) };
  });
}

/* ---------- main: two-sheet export ---------- */

export function exportResultsExcel({ accepted = [], rejected = [] }, filename = null) {
  // Sort first to ensure ranking is by score (desc), regardless of caller.
  const sortedAccepted = sortByScoreDesc(accepted);
  const sortedRejected = sortByScoreDesc(rejected);

  const acceptedRows = sortedAccepted.map((c, i) => mapRow(c, i));
  const rejectedRows = sortedRejected.map((c, i) => mapRow(c, i));

  const wb = XLSX.utils.book_new();

  // Always create the Accepted sheet
  const wsA =
    acceptedRows.length
      ? XLSX.utils.json_to_sheet(acceptedRows, { header: COLUMNS })
      : XLSX.utils.json_to_sheet([], { header: COLUMNS });
  autofit(wsA, acceptedRows);
  XLSX.utils.book_append_sheet(wb, wsA, "Accepted");

  // Always create the Rejected sheet
  const wsR =
    rejectedRows.length
      ? XLSX.utils.json_to_sheet(rejectedRows, { header: COLUMNS })
      : XLSX.utils.json_to_sheet([], { header: COLUMNS });
  autofit(wsR, rejectedRows);
  XLSX.utils.book_append_sheet(wb, wsR, "Rejected");

  // Minimal verification log
  // (Counts reflect the arrays passed in, before sorting/mapping.)
  // eslint-disable-next-line no-console
  console.log(
    `[Excel Export] Accepted: ${Array.isArray(accepted) ? accepted.length : 0} | Rejected: ${
      Array.isArray(rejected) ? rejected.length : 0
    }`
  );

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, filename || `resume-results-${stamp}.xlsx`);
}

/* ---------- optional: single-sheet exporter (unchanged, kept for reference) ---------- */
export function exportResultsSingleSheet({ accepted = [], rejected = [] }, filename = null) {
  const sortedAccepted = sortByScoreDesc(accepted);
  const sortedRejected = sortByScoreDesc(rejected);

  const rows = [
    ...sortedAccepted.map((c, i) => ({ Status: "Accepted", ...mapRow(c, i) })),
    ...sortedRejected.map((c, i) => ({ Status: "Rejected", ...mapRow(c, i + sortedAccepted.length) })),
  ];

  const ws = rows.length
    ? XLSX.utils.json_to_sheet(rows, { header: ["Status", ...COLUMNS] })
    : XLSX.utils.json_to_sheet([], { header: ["Status", ...COLUMNS] });

  autofit(ws, rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All");

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, filename || `resume-results-all-${stamp}.xlsx`);
}
