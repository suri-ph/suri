import { useState, useEffect, useCallback } from "react";
import { useGroupStore } from "../stores";
import { getLocalDateString } from "../../../utils";
import type { AttendanceGroup } from "../../../types/recognition";

// Hooks & Components
import { useReportData } from "./reports/hooks/useReportData";
import { useReportViews } from "./reports/hooks/useReportViews";
import { useReportTransform } from "./reports/hooks/useReportTransform";
import { ReportHeader } from "./reports/components/ReportHeader";
import { ReportToolbar } from "./reports/components/ReportToolbar";
import { ReportTable } from "./reports/components/ReportTable";
import { exportReportToCSV } from "./reports/utils/exportUtils";

interface ReportsProps {
  group: AttendanceGroup;
  onDaysTrackedChange?: (daysTracked: number, loading: boolean) => void;
  onExportHandlersReady?: (handlers: {
    exportCSV: () => void;
    print: () => void;
  }) => void;
  onAddMember?: () => void;
}

export function Reports({
  group,
  onDaysTrackedChange,
  onExportHandlersReady,
  onAddMember,
}: ReportsProps) {
  const storeMembers = useGroupStore((state) => state.members);

  // --- Date State ---
  const [reportStartDate, setReportStartDate] =
    useState<string>(getLocalDateString());
  const [reportEndDate, setReportEndDate] =
    useState<string>(getLocalDateString());

  // --- Data Hook ---
  const { report, sessions, members, loading, error, generateReport } =
    useReportData(group, storeMembers, reportStartDate, reportEndDate);

  // --- Views Hook ---
  const {
    views,
    activeViewIndex,
    defaultViewName,
    visibleColumns,
    setVisibleColumns,
    groupBy,
    setGroupBy,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    isDirty,
    handleSave,
    handleSaveAs,
    handleDeleteView,
    handleViewChange,
  } = useReportViews(group.id, [
    "name",
    "date",
    "status",
    "check_in_time",
    "is_late",
  ]);

  // --- Transform Hook ---
  const { groupedRows, daysTracked, allColumns } = useReportTransform(
    members,
    sessions,
    report,
    reportStartDate,
    reportEndDate,
    groupBy,
    statusFilter,
    search,
  );

  // --- Sync Effects ---
  // Debounce generateReport
  useEffect(() => {
    const timer = setTimeout(() => {
      generateReport();
    }, 300);
    return () => clearTimeout(timer);
  }, [generateReport]);

  // Sync daysTracked
  useEffect(() => {
    if (onDaysTrackedChange) {
      onDaysTrackedChange(daysTracked, loading);
    }
  }, [daysTracked, loading, onDaysTrackedChange]);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    exportReportToCSV(
      groupedRows,
      visibleColumns,
      allColumns,
      group.name,
      reportStartDate,
      reportEndDate,
    );
  }, [
    groupedRows,
    visibleColumns,
    allColumns,
    group.name,
    reportStartDate,
    reportEndDate,
  ]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  useEffect(() => {
    if (onExportHandlersReady && members.length > 0 && !loading) {
      onExportHandlersReady({
        exportCSV: handleExportCSV,
        print: handlePrint,
      });
    }
  }, [
    onExportHandlersReady,
    handleExportCSV,
    handlePrint,
    members.length,
    loading,
  ]);

  // Empty State
  if (!loading && members.length === 0) {
    return (
      <section className="h-full flex flex-col overflow-hidden p-6">
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="flex flex-col items-center justify-center space-y-3 max-w-md text-center">
            <div className="text-white/70 text-sm font-medium">
              No members yet
            </div>
            <div className="text-white/40 text-xs">
              Add members first to generate attendance reports and exports.
            </div>
            {onAddMember && (
              <button
                onClick={onAddMember}
                className="px-4 py-2 text-xs bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded text-white/70 hover:text-white/90 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-user-plus text-xs"></i>
                Add Member
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full flex flex-col overflow-hidden space-y-4 p-6">
      <ReportHeader
        startDate={reportStartDate}
        endDate={reportEndDate}
        onStartDateChange={setReportStartDate}
        onEndDateChange={setReportEndDate}
        daysTracked={daysTracked}
        loading={loading}
      />

      <div className="flex-1 overflow-hidden min-h-0 pr-2">
        {error && (
          <div className="px-4 py-2 bg-red-600/20 border border-red-500/40 text-red-200 rounded-lg text-sm mb-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin" />
              <span className="text-sm text-white/60">
                Generating report...
              </span>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="rounded-xl border border-white/10 bg-white/5 h-full flex flex-col">
              <ReportToolbar
                views={views}
                activeViewIndex={activeViewIndex}
                defaultViewName={defaultViewName}
                onViewChange={handleViewChange}
                onSave={handleSave}
                onSaveAs={handleSaveAs}
                onDeleteView={handleDeleteView}
                isDirty={isDirty}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
                groupBy={groupBy}
                setGroupBy={setGroupBy}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                search={search}
                setSearch={setSearch}
                allColumns={allColumns}
                defaultColumns={[
                  "name",
                  "date",
                  "status",
                  "check_in_time",
                  "is_late",
                ]}
              />

              <ReportTable
                groupedRows={groupedRows}
                visibleColumns={visibleColumns}
                allColumns={allColumns}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
