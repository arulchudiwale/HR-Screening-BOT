import React, { useState } from "react";
import * as XLSX from "xlsx";
import "./ResultsTable.css";
import Gauge from "./Gauge";

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
  weights, // Added weights prop for gauge visualization
}) {
  const [popup, setPopup] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

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
      "Score Breakdown": `Exp: ${row?.experience_score ?? 0}, Skills: ${row?.skill_score ?? 0}, Edu: ${
        row?.education_score ?? 0
      }, Ind: ${row?.industry_score ?? 0}`,
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
          <div className="popup-header">
            <h5>{popup.header}</h5>
            <button className="popup-close" onClick={() => setPopup(null)}>&times;</button>
          </div>
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

      {/* Table toolbar with export buttons */}
      <div className="table-toolbar">
        <div className="table-actions">
          {/* Show "Download All as Excel" only on the Accepted table */}
          {showDownloadAll && (
            <button
              className="btn btn-primary"
              onClick={handleDownloadAllExcel}
            >
              Download All as Excel
            </button>
          )}
          
          {/* Per-table export button */}
          <button
            className="btn btn-secondary download-xls-btn"
            onClick={handleDownloadExcel}
          >
            Download as Excel
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="results-table">
          <colgroup>
            <col style={{width:'6%'}} />   {/* Rank */}
            <col style={{width:'18%'}} />  {/* File Name */}
            <col style={{width:'14%'}} />  {/* Name */}
            <col style={{width:'8%'}} />   {/* Score */}
            <col style={{width:'20%'}} />  {/* Experience - increased width */}
            <col style={{width:'12%'}} />  {/* Education */}
            <col style={{width:'18%'}} />  {/* Skills Matched */}
            <col style={{width:'20%'}} />  {/* Remark - increased width */}
          </colgroup>
          <thead>
            <tr>
              <th className="rank-header">Rank</th>
              <th>File Name</th>
              <th>Name</th>
              <th className="text-right">Score</th>
              <th>Experience</th>
              <th>Education</th>
              <th>Skills Matched</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => {
              const rowId = `${row?.filename || "row"}-${idx}`;
              const isExpanded = expandedRows[rowId] || false;
              
              // Get the weights for gauges
              const defaultWeights = { experience: 30, skills: 40, education: 20, industry: 10 };
              const rowWeights = weights || defaultWeights;
              
              return (
                <React.Fragment key={rowId}>
                  <tr 
                    className={`table-row ${idx % 2 === 0 ? 'table-row-even' : 'table-row-odd'}`}
                  >
                    <td className="rank-cell">{idx + 1}</td>
                    <td onDoubleClick={() => handleDoubleClick("File Name", row?.filename)}>
                      {row?.filename || "—"}
                    </td>
                    <td onDoubleClick={() => handleDoubleClick("Name", row?.name)}>
                      {row?.name || "—"}
                    </td>
                    <td
                      className={`score-cell text-right ${row?.score >= 70 ? "score-accept" : "score-reject"}`}
                      onDoubleClick={() => handleDoubleClick("Score", row?.score ?? 0)}
                    >
                      {typeof row?.score === "number" && !isNaN(row.score) ? row.score : 0}
                    </td>
                    {/* Experience: plain wrapping, no clamp, no toggle */}
                    <td 
                      onDoubleClick={() => handleDoubleClick("Experience", row?.experience_summary)}
                    >
                      {row?.experience_summary || "—"}
                    </td>
                    {/* Education: already plain wrapping */}
                    <td onDoubleClick={() => handleDoubleClick("Education", row?.education)}>
                      {row?.education || "—"}
                    </td>
                    {/* Skills Matched: plain wrapping, no clamp */}
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
                    {/* Remark: the ONLY cell with clamp + Show more/less */}
                    <td 
                      className="cell-remark"
                      onDoubleClick={() => handleDoubleClick("Remark", row?.remark)}
                    >
                      <div className="clamp-text">
                        {row?.remark || "—"}
                      </div>
                      <button 
                        className="toggle-expand-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedRows(prev => ({
                            ...prev, 
                            [rowId]: !prev[rowId]
                          }));
                        }}
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    </td>

                  </tr>
                  
                  {/* Expandable row details */}
                  {isExpanded && (
                    <tr className="expanded-row-details">
                      <td colSpan="8">
                        <div className="expanded-content">
                          <div className="gauges-container">
                            <Gauge 
                              value={row?.experience_score ?? 0} 
                              maxValue={rowWeights.experience} 
                              label="Experience" 
                            />
                            <Gauge 
                              value={row?.skill_score ?? 0} 
                              maxValue={rowWeights.skills} 
                              label="Skills" 
                            />
                            <Gauge 
                              value={row?.education_score ?? 0} 
                              maxValue={rowWeights.education} 
                              label="Education" 
                            />
                            <Gauge 
                              value={row?.industry_score ?? 0} 
                              maxValue={rowWeights.industry} 
                              label="Industry" 
                            />
                          </div>
                          <div className="weighting-info">
                            Weighting used: Exp {rowWeights.experience}, Skills {rowWeights.skills}, 
                            Edu {rowWeights.education}, Ind {rowWeights.industry} (sum {rowWeights.experience + rowWeights.skills + rowWeights.education + rowWeights.industry})
                          </div>
                          <div className="expanded-text">
                            <div className="expanded-section">
                              <h4>Experience</h4>
                              <p>{row?.experience_summary || "—"}</p>
                            </div>
                            <div className="expanded-section">
                              <h4>Skills Matched</h4>
                              <p>{Array.isArray(row?.skills_matched) ? row.skills_matched.join(", ") : row?.skills_matched || "—"}</p>
                            </div>
                            <div className="expanded-section">
                              <h4>Remark</h4>
                              <p>{row?.remark || "—"}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
        
        </tbody>
      </table>
    </div>
      <Popup />
    </div>
  );
}

export default ResultsTable;
