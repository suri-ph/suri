import { Fragment } from "react";
import type { RowData, ColumnKey } from "../types";

interface ReportTableProps {
  groupedRows: Record<string, RowData[]>;
  visibleColumns: ColumnKey[];
  allColumns: ReadonlyArray<{ key: ColumnKey; label: string; align?: string }>;
}

export function ReportTable({
  groupedRows,
  visibleColumns,
  allColumns,
}: ReportTableProps) {
  const visibleColDefs = allColumns.filter((c) =>
    visibleColumns.includes(c.key),
  );

  return (
    <div className="flex-1 overflow-auto custom-scroll">
      <table className="w-full text-left border-separate border-spacing-0">
        <thead className="sticky top-0 bg-[#0f0f0f] z-10">
          <tr>
            {visibleColDefs.map((c, i) => {
              let alignClass = "text-left";
              if (c.align === "center") alignClass = "text-center";
              else if (c.align === "right") alignClass = "text-right";
              return (
                <th
                  key={c.key}
                  className={`px-4 py-4 border-b border-white/10 text-[10px] uppercase font-bold tracking-widest text-white/30 bg-[#0f0f0f] ${alignClass} ${i === 0 ? 'rounded-tl-xl' : ''} ${i === visibleColDefs.length - 1 ? 'rounded-tr-xl' : ''}`}
                >
                  {c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-white/5">
          {Object.keys(groupedRows).length === 0 ||
            Object.values(groupedRows).every(rows => rows.length === 0) ? (
            <tr>
              <td colSpan={visibleColDefs.length} className="py-20">
                <div className="flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
                    <i className="fa-solid fa-magnifying-glass-chart text-2xl text-white/10"></i>
                  </div>
                  <h3 className="text-sm font-semibold text-white/60 mb-1">No matching records</h3>
                  <p className="text-xs text-white/30 max-w-[240px]">
                    Try adjusting your filters, date range, or search query to find what you're looking for.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            Object.entries(groupedRows).map(([groupInfo, rows]) => {
              if (rows.length === 0) return null;
              return (
                <Fragment key={groupInfo}>
                  {groupInfo !== "__all__" && (
                    <tr>
                      <td
                        colSpan={visibleColDefs.length}
                        className="px-4 py-3 bg-white/[0.03] border-b border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                          <span className="text-xs font-bold text-cyan-100/90 tracking-wide">{groupInfo}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 text-[10px] text-white/40 font-medium">
                            {rows.length} {rows.length === 1 ? 'record' : 'records'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="group hover:bg-cyan-500/[0.03] transition-all duration-200 cursor-default"
                    >
                      {visibleColDefs.map((c, cIdx) => {
                        const val = row[c.key];
                        let content: React.ReactNode = val as string;

                        if (c.key === "status") {
                          const s = row.status;
                          let badgeClass = "bg-white/5 text-white/40 border-white/10";
                          if (s === "present") badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          if (s === "absent") badgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                          if (s === "no_records") badgeClass = "bg-white/[0.02] text-white/20 border-white/5";

                          content = (
                            <div
                              className={`inline-flex items-center px-2 py-1 rounded-lg text-[10px] uppercase tracking-wider font-bold border ${badgeClass} transition-transform group-hover:scale-105`}
                            >
                              <div className={`w-1 h-1 rounded-full mr-1.5 ${s === 'present' ? 'bg-emerald-400' : s === 'absent' ? 'bg-rose-400' : 'bg-current opacity-30'}`} />
                              {s === "no_records" ? "No Data" : s}
                            </div>
                          );
                        } else if (c.key === "is_late") {
                          content = row.is_late ? (
                            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] uppercase tracking-tight">
                              <i className="fa-solid fa-clock text-[9px]"></i>
                              Late
                            </div>
                          ) : (
                            <span className="text-white/10">-</span>
                          );
                        } else if (c.key === "check_in_time") {
                          if (row.check_in_time) {
                            content = (
                              <div className="flex flex-col">
                                <span className="text-white/90 font-medium">
                                  {new Date(row.check_in_time).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {row.is_late && row.late_minutes > 0 && (
                                  <span className="text-[10px] text-amber-500/70 font-bold uppercase mt-0.5">
                                    +{row.late_minutes}m
                                  </span>
                                )}
                              </div>
                            );
                          } else {
                            content = <span className="text-white/10">-</span>;
                          }
                        } else if (c.key === "late_minutes") {
                          content =
                            row.late_minutes > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {row.late_minutes}m
                              </span>
                            ) : (
                              <span className="text-white/10">-</span>
                            );
                        } else if (c.key === "date") {
                          content = (
                            <span className="text-white/60 font-medium">
                              {new Date(row.date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          );
                        } else if (c.key === "name") {
                          content = (
                            <span className="text-white font-semibold">
                              {val as string}
                            </span>
                          );
                        }

                        // Cell alignment
                        let alignClass = "text-left";
                        if (c.align === "center") alignClass = "text-center";
                        else if (c.align === "right") alignClass = "text-right";

                        return (
                          <td
                            key={c.key}
                            className={`px-4 py-3.5 whitespace-nowrap border-b border-white/[0.04] ${alignClass} ${cIdx === 0 ? 'relative' : ''}`}
                          >
                            {cIdx === 0 && (
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
