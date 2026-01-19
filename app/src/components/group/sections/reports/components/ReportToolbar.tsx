import type {
  SavedViewConfig,
  ColumnKey,
  GroupByKey,
  ReportStatusFilter,
} from "../types";

interface ReportToolbarProps {
  // Views
  views: SavedViewConfig[];
  activeViewIndex: number | null;
  defaultViewName: string | null;
  onViewChange: (idx: number | null) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onDeleteView: () => void;
  isDirty: boolean;

  // View State
  visibleColumns: ColumnKey[];
  setVisibleColumns: (cols: ColumnKey[]) => void;
  groupBy: GroupByKey;
  setGroupBy: (key: GroupByKey) => void;
  statusFilter: ReportStatusFilter;
  setStatusFilter: (filter: ReportStatusFilter) => void;
  search: string;
  setSearch: (val: string) => void;

  // Static Config
  allColumns: ReadonlyArray<{ key: ColumnKey; label: string }>;
  defaultColumns: ColumnKey[];
}

export function ReportToolbar({
  views,
  activeViewIndex,
  defaultViewName,
  onViewChange,
  onSave,
  onSaveAs,
  onDeleteView,
  isDirty,
  visibleColumns,
  setVisibleColumns,
  groupBy,
  setGroupBy,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  allColumns,
}: ReportToolbarProps) {
  return (
    <div className="p-3 border-b border-white/10 grid grid-cols-1 lg:grid-cols-3 gap-3 flex-shrink-0">
      {/* 1. View Selection & Actions */}
      <div className="flex items-start gap-2 flex-wrap">
        <select
          className="bg-transparent text-xs border border-white/20 rounded px-4 py-1"
          style={{ colorScheme: "dark" }}
          value={activeViewIndex ?? ""}
          onChange={(e) => {
            const val = e.target.value === "" ? null : Number(e.target.value);
            onViewChange(val);
          }}
        >
          <option className="bg-black text-white" value="">
            (Default View)
          </option>
          {views.map((v, i) => (
            <option className="bg-black text-white" key={v.name + i} value={i}>
              {defaultViewName === v.name ? "★ " : ""}
              {v.name}
            </option>
          ))}
        </select>

        {activeViewIndex === null ? (
          <button
            className="text-xs px-2 py-1 border border-white/20 rounded hover:bg-white/10"
            onClick={onSaveAs}
          >
            Save
          </button>
        ) : (
          <>
            <button
              className="text-xs px-2 py-1 border border-white/20 rounded hover:bg-white/10"
              onClick={onSave}
            >
              Save
            </button>
            <button
              className="text-xs px-2 py-1 border border-white/20 rounded hover:bg-white/10"
              onClick={onSaveAs}
            >
              Save as new
            </button>
            <button
              className="text-xs px-2 py-1 border border-white/20 rounded hover:bg-white/10"
              onClick={onDeleteView}
            >
              Delete
            </button>
          </>
        )}

        {isDirty && activeViewIndex !== null && (
          <span className="text-[10px] text-amber-300 ml-1">
            Unsaved changes
          </span>
        )}
      </div>

      {/* 2. Group By & Status Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Group by</span>
          <select
            className="bg-transparent text-xs border border-white/20 rounded px-2 py-1"
            style={{ colorScheme: "dark" }}
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByKey)}
          >
            <option className="bg-black text-white" value="none">
              None
            </option>
            <option className="bg-black text-white" value="person">
              Person
            </option>
            <option className="bg-black text-white" value="date">
              Date
            </option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">Status</span>
          {(["all", "present", "absent", "no_records"] as const).map((st) => {
            const active = statusFilter === st;
            return (
              <label
                key={st}
                className="text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <input
                  type="radio"
                  name="statusFilter"
                  checked={active}
                  onChange={() => setStatusFilter(st)}
                  className="cursor-pointer"
                />
                <span className="capitalize">
                  {st === "no_records" ? "No records" : st}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 3. Columns & Search */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        {allColumns.map((c) => (
          <label
            key={c.key}
            className="text-[11px] flex items-center gap-1 whitespace-nowrap"
          >
            <input
              type="checkbox"
              checked={visibleColumns.includes(c.key)}
              onChange={(e) => {
                if (e.target.checked) {
                  setVisibleColumns([...visibleColumns, c.key]);
                } else {
                  setVisibleColumns(visibleColumns.filter((k) => k !== c.key));
                }
              }}
            />
            {c.label}
          </label>
        ))}

        <div className="relative w-full max-w-[150px]">
          <input
            type="search"
            placeholder="Filter data..."
            className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
