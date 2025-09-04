// src/components/AdminLogsTable.js
import React, { useEffect, useState, useMemo } from "react";

const COLUMNS = [
  "timestamp",
  "username",
  "role",
  "action",
  "success",
  "duration_ms",
  "client_ip",
  "user_agent",
  "jd_filename",
  "resume_count",
  "resume_filenames",
  "remarkStyle",
  "weights_sum",
  "jd_length_words",
];

export default function AdminLogsTable({ apiBase }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(500);
  const [filter, setFilter] = useState("");

  const token = localStorage.getItem("token") || "";

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/admin/logs/rows?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json(); // {count, rows}
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e) {
      console.error(e);
      alert("Failed to load admin logs.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCSV() {
    try {
      const res = await fetch(`${apiBase}/admin/logs/export?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const text = await res.text();
      const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "admin_usage_logs.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to download CSV.");
    }
  }

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      COLUMNS.some((c) => String(r?.[c] ?? "").toLowerCase().includes(q))
    );
  }, [rows, filter]);

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Admin: Usage Logs</h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <button onClick={fetchRows} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Show
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={5000}>5000</option>
          </select>
          rows
        </label>

        <input
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1, minWidth: 160 }}
        />

        <button onClick={downloadCSV}>Download CSV</button>
      </div>

      <div style={{ overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
        <table className="min-w-full" style={{ fontSize: 13, width: "100%" }}>
          <thead style={{ background: "#f3f4f6" }}>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c} style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={idx} style={{ background: idx % 2 ? "#fff" : "#fafafa" }}>
                {COLUMNS.map((c) => (
                  <td key={c} style={{ padding: "8px 10px", borderBottom: "1px solid #e5e7eb", verticalAlign: "top", whiteSpace: "nowrap" }}>
                    {r?.[c] !== null && r?.[c] !== undefined ? String(r[c]) : ""}
                  </td>
                ))}
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
