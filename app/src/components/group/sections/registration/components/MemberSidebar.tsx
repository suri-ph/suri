import { useMemo } from "react";
import type { AttendanceMember } from "../../../../../types/recognition";
import { generateDisplayNames } from "../../../../../utils";

interface MemberSidebarProps {
  members: AttendanceMember[];
  selectedMemberId: string;
  onSelectMember: (id: string) => void;
  memberSearch: string;
  setMemberSearch: (val: string) => void;
  registrationFilter: "all" | "registered" | "non-registered";
  setRegistrationFilter: (val: "all" | "registered" | "non-registered") => void;
  memberStatus: Map<string, boolean>;
  onRemoveFaceData: (
    member: AttendanceMember & { displayName: string },
  ) => void;
}

export function MemberSidebar({
  members,
  selectedMemberId,
  onSelectMember,
  memberSearch,
  setMemberSearch,
  registrationFilter,
  setRegistrationFilter,
  memberStatus,
  onRemoveFaceData,
}: MemberSidebarProps) {
  const membersWithDisplayNames = useMemo(() => {
    return generateDisplayNames(members);
  }, [members]);

  const filteredMembers = useMemo(() => {
    let result = membersWithDisplayNames;

    if (memberSearch.trim()) {
      const query = memberSearch.toLowerCase();
      result = result.filter(
        (member) =>
          member.name.toLowerCase().includes(query) ||
          member.displayName.toLowerCase().includes(query) ||
          member.person_id.toLowerCase().includes(query),
      );
    }

    if (registrationFilter !== "all") {
      result = result.filter((member) => {
        const isRegistered = memberStatus.get(member.person_id) ?? false;
        return registrationFilter === "registered"
          ? isRegistered
          : !isRegistered;
      });
    }

    result = [...result].sort((a, b) => {
      const aRegistered = memberStatus.get(a.person_id) ?? false;
      const bRegistered = memberStatus.get(b.person_id) ?? false;

      if (aRegistered && !bRegistered) return -1;
      if (!aRegistered && bRegistered) return 1;
      return 0;
    });

    return result;
  }, [memberSearch, membersWithDisplayNames, registrationFilter, memberStatus]);

  return (
    <div className="space-y-3 flex flex-col overflow-hidden min-h-0 h-full p-6">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:bg-white/10 focus:outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        {members.length > 0 && filteredMembers.length > 0 && (
          <div className="text-xs text-white/30">
            Showing {filteredMembers.length} of {members.length} member
            {members.length !== 1 ? "s" : ""}
            {registrationFilter !== "all" && (
              <span className="ml-1">
                (
                {registrationFilter === "registered"
                  ? "registered"
                  : "needs registration"}
                )
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setRegistrationFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              registrationFilter === "all"
                ? "bg-white/10 text-white border border-white/20"
                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/8 hover:text-white/80"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setRegistrationFilter("non-registered")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              registrationFilter === "non-registered"
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/8 hover:text-white/80"
            }`}
          >
            Needs Registration
          </button>
          <button
            onClick={() => setRegistrationFilter("registered")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              registrationFilter === "registered"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
                : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/8 hover:text-white/80"
            }`}
          >
            Registered
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto custom-scroll overflow-x-hidden min-h-0">
        {members.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/5 bg-white/[0.02] px-3 py-12 text-center w-full">
            <div className="text-xs text-white/40">No members yet</div>
          </div>
        )}

        {members.length > 0 && filteredMembers.length === 0 && (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-6 text-center w-full">
            <div className="text-xs text-white/40">
              {memberSearch.trim()
                ? `No results for "${memberSearch}"`
                : registrationFilter === "registered"
                  ? "No registered members"
                  : registrationFilter === "non-registered"
                    ? "All members are registered"
                    : "No members found"}
            </div>
          </div>
        )}

        {filteredMembers.map((member) => {
          const isSelected = selectedMemberId === member.person_id;
          const hasEmbeddings = memberStatus.get(member.person_id) ?? false;
          return (
            <button
              key={member.person_id}
              onClick={() => onSelectMember(member.person_id)}
              className={`group relative w-full rounded-xl border px-3 py-3 text-left transition-all ${
                isSelected
                  ? "border-cyan-400/50 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 shadow-lg shadow-cyan-500/10"
                  : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-sm font-medium truncate transition-colors ${
                        isSelected ? "text-cyan-100" : "text-white"
                      }`}
                    >
                      {member.displayName}
                    </div>
                  </div>
                  {member.role && (
                    <div className="text-xs text-white/40 truncate mt-0.5">
                      {member.role}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasEmbeddings && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30">
                      <svg
                        className="w-3 h-3 text-cyan-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-xs font-medium text-cyan-300">
                        Registered
                      </span>
                    </span>
                  )}
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </div>
              </div>
              {hasEmbeddings && isSelected && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFaceData(member);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveFaceData(member);
                    }
                  }}
                  className="mt-2 w-full rounded-lg bg-red-500/10 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors cursor-pointer"
                >
                  Remove Face Data
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
