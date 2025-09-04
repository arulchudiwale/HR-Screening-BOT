// src/exportResultsExcel.js
import * as XLSX from "xlsx";

/** Turn one candidate into a flat row with safe fallbacks. */
function mapRow(c = {}, idx = 0, status = "N/A") {
  const name = c.name ?? c.candidateName ?? c.fullName ?? "N/A";
  const fileName = c.fileName ?? c.filename ?? c.file ?? "N/A";
  const experience = c.experience ?? c.exp ?? "N/A";
  const education = c.education ?? c.edu ?? "N/A";

  let skills = c.skillsMatched ?? c.skills ?? c.matchedSkills ?? "N/A";
  if (Array.isArray(skills)) skills = skills.join(", ");

  const bd = c.breakdown ?? c.scoreBreakdown ?? c.scores ?? {};
  const breakdownStr =
    typeof bd === "string"
      ? bd
      : `Exp: ${bd.experience ?? bd.exp ?? 0}, Skills: ${bd.skills ?? 0}, Edu: ${bd.education ?? 0}, Ind: ${bd.industry ?? 0}`;

  const remark = c.remark ?? c.comments ?? c.reason ?? "";

  return {
    Rank: idx + 1,
    Status: status,                       // Accepted / Rejected
    "File Name": fileName,
    Name: name,
    Score: c.score ?? c.totalScore ?? 0,  // keep zeros; no filtering
    Experience: experience,
    Education: education,
    "Skills Matched": skills,
    Remark: remark,
    "Score Breakdown": breakdownStr,
  };
}

/** Nice auto-width for columns. */
function autofit(ws, rows) {
  const cols = Object.keys(rows[0] || {});
  ws["!cols"] = cols.map((k) => {
    const maxLen = Math.max(
      k.length,
      ...rows.map((r) => (r[k] ? String(r[k]).length : 0))
    );
    return { wch: Math.min(Math.max(10, maxLen + 2), 60) };
  });
}

/** Export one workbook with two sheets: Accepted & Rejected. */
export function exportResultsExcel({ accepted = [], rejected = [] }, filename = null) {
  const acceptedRows = accepted.map((c, i) => mapRow(c, i, "Accepted"));
  const rejectedRows = rejected.map((c, i) => mapRow(c, i, "Rejected"));

  const safeAccepted = acceptedRows.length ? acceptedRows : [mapRow({}, 0, "Accepted")];
  const safeRejected = rejectedRows.length ? rejectedRows : [mapRow({}, 0, "Rejected")];

  const wb = XLSX.utils.book_new();

  const wsA = XLSX.utils.json_to_sheet(safeAccepted);
  autofit(wsA, safeAccepted);
  XLSX.utils.book_append_sheet(wb, wsA, "Accepted");

  const wsR = XLSX.utils.json_to_sheet(safeRejected);
  autofit(wsR, safeRejected);
  XLSX.utils.book_append_sheet(wb, wsR, "Rejected");

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, filename || `resume-results-${stamp}.xlsx`);
}

/** Optional: single sheet with a Status column. */
export function exportResultsSingleSheet({ accepted = [], rejected = [] }, filename = null) {
  const rows = [
    ...accepted.map((c, i) => mapRow(c, i, "Accepted")),
    ...rejected.map((c, i) => mapRow(c, i + accepted.length, "Rejected")),
  ];
  const safe = rows.length ? rows : [mapRow({}, 0, "N/A")];
  const ws = XLSX.utils.json_to_sheet(safe);
  autofit(ws, safe);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, filename || `resume-results-all-${stamp}.xlsx`);
}
