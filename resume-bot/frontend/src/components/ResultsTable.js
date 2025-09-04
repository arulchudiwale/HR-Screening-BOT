import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./ResultsTable.css";

// NEW: import the combined exporter (two sheets in one file) or switch to SingleSheet if you prefer
import { exportResultsExcel /* , exportResultsSingleSheet */ } from "../exportResultsExcel";

function ResultsTable({
  title,
  data,
  jdSummary,

  // NEW (optional): pass both lists into ANY instance of ResultsTable
  // so it can show the "Download All as Excel" button that exports both.
  acceptedResults,
  rejectedResults,
  accepted,
  rejected,
}) {
  const [popup, setPopup] = useState(null);

  // small helper used for local & combined exports
  const sortByScore = (arr) =>
    Array.isArray(arr) ? [...arr].sort((a, b) => (+b.score || 0) - (+a.score || 0)) : [];

  // Defensive copy and rank-sort for THIS table
  const sortedData = React.useMemo(() => sortByScore(data), [data]);

  // OPTIONAL arrays for the combined export button (if provided via props)
  const acceptedForExport = React.useMemo(
    () => sortByScore(acceptedResults ?? accepted ?? []),
    [acceptedResults, accepted]
  );
  const rejectedForExport = React.useMemo(
    () => sortByScore(rejectedResults ?? rejected ?? []),
    [rejectedResults, rejected]
  );

  // Download Excel of ONLY THIS TABLE (your original behavior)
  const handleDownloadExcel = () => {
    if (!sortedData.length) return;
    const sheetData = sortedData.map((row, idx) => ({
      Rank: idx + 1,
      "File Name": row?.filename || "",
      Name: row?.name || "",
      Score: row?.score ?? 0,
      Experience: row?.experience_summary || "",
      Education: row?.education || "",
      "Skills Matched": Array.isArray(row?.skills_matched)
        ? row.skills_matched.join(", ")
        : row?.skills_matched || "",
      Remark: row?.remark || "",
      "Score Breakdown": `Exp: ${row?.experience_score ?? 0}, Skills: ${row?.skill_score ?? 0}, Edu: ${row?.education_score ?? 0}, Ind: ${row?.industry_score ?? 0}`,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "screening_results.xlsx");
  };

  // NEW: one Excel file containing BOTH Accepted & Rejected (two sheets)
  const handleDownloadAllExcel = () => {
    // Only show/use if caller supplied either list
    if (!acceptedForExport.length && !rejectedForExport.length) return;

    // If you prefer a single sheet with a Status column instead:
    // exportResultsSingleSheet({ accepted: acceptedForExport, rejected: rejectedForExport });
    exportResultsExcel({ accepted: acceptedForExport, rejected: rejectedForExport });
  };

  const handleDoubleClick = (header, value) => {
    setPopup({
      header,
      value:
        typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : ["", undefined, null].includes(value)
          ? "—"
          : value,
    });
  };

  const Popup = () =>
    popup ? (
      <div
        className="popup-overlay"
        tabIndex={-1}
        onClick={() => setPopup(null)}
        onKeyDown={(e) => e.key === "Escape" && setPopup(null)}
      >
        <div className="popup-content" onClick={(e) => e.stopPropagation()}>
          <h5>{popup.header}</h5>
          <pre style={{ whiteSpace: "pre-wrap" }}>{popup.value}</pre>
          <button onClick={() => setPopup(null)}>Close</button>
        </div>
      </div>
    ) : null;

  if (!sortedData.length) return null;

  // ✅ Show "Download All as Excel" ONLY on the Accepted table to avoid duplicates
  const showDownloadAll =
    (acceptedForExport.length > 0 || rejectedForExport.length > 0) &&
    typeof title === "string" &&
    title.toLowerCase().includes("accepted");

  return (
    <div className="results-table-container">
      <h4 className="results-table-title">{title}</h4>

      {jdSummary && (
        <div className="jd-summary-card">
          <h3>Job Description Summary</h3>
          <div>
            <b>Expected Experience:</b>{" "}
            {jdSummary.expected_experience && jdSummary.expected_experience.trim()
              ? jdSummary.expected_experience
              : "—"}
          </div>
          <div>
            <b>Required Education:</b>{" "}
            {jdSummary.required_education && jdSummary.required_education.trim()
              ? jdSummary.required_education
              : "—"}
          </div>
          <div>
            <b>Key Skills Required:</b>{" "}
            {Array.isArray(jdSummary.key_skills) && jdSummary.key_skills.length > 0
              ? jdSummary.key_skills.join(", ")
              : "—"}
          </div>
        </div>
      )}

     
      {/* Your original per-table export button (kept) */}
      <button
        className="download-xls-btn"
        style={{
          margin: "0 0 1rem 0",
          padding: "0.5rem 1.25rem",
          background: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
        onClick={handleDownloadExcel}
      >
        Download as Excel
      </button>

      <table className="results-table">
        <thead>
          <tr>
            <th className="rank-header">Rank</th>
            <th>File Name</th>
            <th>Name</th>
            <th>Score</th>
            <th>Experience</th>
            <th>Education</th>
            <th>Skills Matched</th>
            <th>Remark</th>
            <th>Score Breakdown</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr key={`${row?.filename || "row"}-${idx}`}>
              <td className="rank-cell">{idx + 1}</td>
              <td onDoubleClick={() => handleDoubleClick("File Name", row?.filename)}>
                {row?.filename || "—"}
              </td>
              <td onDoubleClick={() => handleDoubleClick("Name", row?.name)}>
                {row?.name || "—"}
              </td>
              <td
                className={`score-cell ${row?.score >= 70 ? "score-accept" : "score-reject"}`}
                onDoubleClick={() => handleDoubleClick("Score", row?.score ?? 0)}
              >
                {typeof row?.score === "number" && !isNaN(row.score) ? row.score : 0}
              </td>
              <td onDoubleClick={() => handleDoubleClick("Experience", row?.experience_summary)}>
                {row?.experience_summary || "—"}
              </td>
              <td onDoubleClick={() => handleDoubleClick("Education", row?.education)}>
                {row?.education || "—"}
              </td>
              <td
                onDoubleClick={() =>
                  handleDoubleClick(
                    "Skills Matched",
                    Array.isArray(row?.skills_matched)
                      ? row.skills_matched.join(", ")
                      : row?.skills_matched || "—"
                  )
                }
              >
                {Array.isArray(row?.skills_matched)
                  ? row.skills_matched.join(", ")
                  : row?.skills_matched || "—"}
              </td>
              <td onDoubleClick={() => handleDoubleClick("Remark", row?.remark)}>
                {row?.remark || "—"}
              </td>
              <td
                onDoubleClick={() =>
                  handleDoubleClick(
                    "Score Breakdown",
                    `Exp: ${row?.experience_score ?? 0}, Skills: ${row?.skill_score ?? 0}, Edu: ${row?.education_score ?? 0}, Ind: ${row?.industry_score ?? 0}`
                  )
                }
                style={{ whiteSpace: "nowrap" }}
              >
                {`Exp: ${row?.experience_score ?? 0}, Skills: ${row?.skill_score ?? 0}, Edu: ${row?.education_score ?? 0}, Ind: ${row?.industry_score ?? 0}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Popup />
    </div>
  );
}

export default ResultsTable;
