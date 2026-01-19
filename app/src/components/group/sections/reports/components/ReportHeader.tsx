interface ReportHeaderProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  daysTracked: number;
  loading: boolean;
}

export function ReportHeader({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  daysTracked,
  loading,
}: ReportHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs">
          <span className="text-white/50">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="bg-transparent focus:outline-none w-36 text-white/90"
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-white/50">To</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="bg-transparent focus:outline-none w-36 text-white/90"
          />
        </label>
      </div>
      {!loading && (
        <div className="flex items-center text-xs text-white/60 whitespace-nowrap">
          Days Tracked:{" "}
          <span className="text-white/90 font-semibold ml-1">
            {daysTracked}
          </span>
        </div>
      )}
    </div>
  );
}
