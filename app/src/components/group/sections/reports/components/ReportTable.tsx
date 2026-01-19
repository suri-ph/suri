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
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#0a0a0a] z-10 text-xs uppercase text-white/40 font-semibold tracking-wider">
          <tr>
            {visibleColDefs.map((c) => {
              // Special alignment classes
              let alignClass = "text-left";
              if (c.align === "center") alignClass = "text-center";
              else if (c.align === "right") alignClass = "text-right";
              return (
                <th
                  key={c.key}
                  className={`px-4 py-3 border-b border-white/10 ${alignClass}`}
                >
                  {c.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-white/5">
          {Object.entries(groupedRows).map(([groupInfo, rows]) => {
            if (rows.length === 0) return null;
            return (
              <>
                {groupInfo !== "__all__" && (
                  <tr className="bg-white/[0.02]">
                    <td
                      colSpan={visibleColDefs.length}
                      className="px-4 py-2 font-medium text-cyan-200 text-xs"
                    >
                      {groupInfo} <span className="opacity-50 mx-1">•</span>{" "}
                      {rows.length} records
                    </td>
                  </tr>
                )}
                {rows.map((row, rIdx) => (
                  <tr
                    key={rIdx} // ideally composite key, but row has person_id and date
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    {visibleColDefs.map((c) => {
                      const val = row[c.key];
                      let content: React.ReactNode = val as string;

                      if (c.key === "status") {
                        const s = row.status;
                        let colorClass = "text-white/50";
                        if (s === "present") colorClass = "text-emerald-400";
                        if (s === "absent") colorClass = "text-rose-400";
                        if (s === "no_records") colorClass = "text-white/20";

                        content = (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold bg-white/[0.05] ${colorClass}`}
                          >
                            {s === "no_records" ? "No Data" : s}
                          </span>
                        );
                      } else if (c.key === "is_late") {
                        content = row.is_late ? (
                          <span className="text-amber-400 font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="text-white/20">-</span>
                        );
                      } else if (c.key === "check_in_time") {
                        if (row.check_in_time) {
                          content = new Date(
                            row.check_in_time,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        } else {
                          content = <span className="text-white/20">-</span>;
                        }
                      } else if (c.key === "late_minutes") {
                        content =
                          row.late_minutes > 0 ? (
                            <span className="text-amber-400">
                              {row.late_minutes}m
                            </span>
                          ) : (
                            <span className="text-white/20">-</span>
                          );
                      } else if (c.key === "date") {
                        content = new Date(row.date).toLocaleDateString(
                          undefined,
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        );
                      }

                      // Cell alignment
                      let alignClass = "text-left";
                      if (c.align === "center") alignClass = "text-center";
                      else if (c.align === "right") alignClass = "text-right";

                      return (
                        <td
                          key={c.key}
                          className={`px-4 py-2.5 whitespace-nowrap ${alignClass}`}
                        >
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
