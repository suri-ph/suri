import type { RowData, ColumnKey } from "../types";

export function exportReportToCSV(
  groupedRows: Record<string, RowData[]>,
  visibleColumns: ColumnKey[],
  allColumns: ReadonlyArray<{ key: ColumnKey; label: string }>,
  groupName: string,
  startDate: string,
  endDate: string,
) {
  try {
    const cols = allColumns.filter((c) => visibleColumns.includes(c.key));
    const header = cols.map((c) => c.label);
    const rows: string[][] = [];
    Object.values(groupedRows).forEach((groupArr) => {
      groupArr.forEach((r) => {
        const row = cols.map((c) => {
          const v = (r as RowData)[c.key];
          if (typeof v === "boolean") return v ? "true" : "false";
          if (typeof v === "number") return String(v);
          if (v instanceof Date) return v.toISOString();
          return v ?? "";
        });
        rows.push(row);
      });
    });

    const csvContent = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;

    const formatDateForFilename = (dateString: string): string => {
      const date = new Date(dateString);
      const month = date.toLocaleString("en-US", { month: "long" });
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    };

    const formattedStartDate = formatDateForFilename(startDate);
    const formattedEndDate = formatDateForFilename(endDate);

    const dateRange =
      startDate === endDate
        ? formattedStartDate
        : `${formattedStartDate} to ${formattedEndDate}`;

    anchor.download = `${groupName} (${dateRange}).csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return { success: true };
  } catch (err) {
    console.error("Error exporting view:", err);
    return { success: false, error: err };
  }
}
