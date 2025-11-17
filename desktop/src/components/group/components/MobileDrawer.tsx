import { useEffect } from "react";
import type { GroupSection } from "../types";
import type { AttendanceGroup } from "../../../types/recognition";
import { MobileNav } from "./MobileNav";
import { Dropdown } from "../../shared/Dropdown";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: GroupSection;
  onSectionChange: (section: GroupSection) => void;
  selectedGroup: AttendanceGroup | null;
  groups: AttendanceGroup[];
  onGroupChange: (group: AttendanceGroup | null) => void;
  onCreateGroup: () => void;
}

export function MobileDrawer({
  isOpen,
  onClose,
  activeSection,
  onSectionChange,
  selectedGroup,
  groups,
  onGroupChange,
  onCreateGroup,
}: MobileDrawerProps) {
  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 lg:hidden animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`
          fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white/[0.02]
          border-r border-white/[0.08] z-50 lg:hidden backdrop-blur-sm
          transform transition-transform duration-300 ease-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="h-full flex flex-col pt-12 pb-5">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
            aria-label="Close menu"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Menu Header */}
          <div className="px-4 pt-1 pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <img src="/suri_icon.png" alt="Suri" className="w-6 h-6" />
              <h1 className="text-lg font-semibold text-white">Menu</h1>
            </div>
          </div>

          {/* Group Selector & Actions - Above Navigation */}
          <div className="px-4 py-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Dropdown
                  options={groups.map((group) => ({
                    value: group.id,
                    label: group.name,
                  }))}
                  value={selectedGroup?.id ?? null}
                  onChange={(groupId: string | null) => {
                    if (groupId) {
                      const group = groups.find((g) => g.id === groupId);
                      onGroupChange(group ?? null);
                    } else {
                      onGroupChange(null);
                    }
                  }}
                  placeholder="Select group…"
                  emptyMessage="No groups available"
                  maxHeight={256}
                  buttonClassName="h-10"
                  allowClear={true}
                />
              </div>
              <button
                onClick={onCreateGroup}
                className="h-10 px-3 rounded-lg text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors border border-white/10 flex-shrink-0"
                aria-label="New Group"
                title="New Group"
              >
                Add
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 min-h-0">
            <MobileNav
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              selectedGroup={selectedGroup}
              onClose={onClose}
            />
          </div>
        </div>
      </div>
    </>
  );
}
