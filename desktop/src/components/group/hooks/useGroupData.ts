import { useEffect, useRef } from "react";
import type { AttendanceGroup } from "../../../types/recognition";

import { useGroupStore } from "../stores";

/**
 * Hook that provides access to group data from Zustand store
 * Handles initialization and side effects
 */
export function useGroupData(initialGroup?: AttendanceGroup | null) {
  const selectedGroup = useGroupStore((state) => state.selectedGroup);
  const groups = useGroupStore((state) => state.groups);
  const members = useGroupStore((state) => state.members);
  const loading = useGroupStore((state) => state.loading);
  const error = useGroupStore((state) => state.error);
  const lastDeletedGroupId = useGroupStore((state) => state.lastDeletedGroupId);
  const setSelectedGroup = useGroupStore((state) => state.setSelectedGroup);
  const setError = useGroupStore((state) => state.setError);
  const fetchGroups = useGroupStore((state) => state.fetchGroups);
  const fetchGroupDetails = useGroupStore((state) => state.fetchGroupDetails);
  const deleteGroup = useGroupStore((state) => state.deleteGroup);
  const exportData = useGroupStore((state) => state.exportData);

  const lastProcessedRef = useRef<string | null>(null);

  // Sync initialGroup with store, but skip if it doesn't exist in groups (was deleted)
  useEffect(() => {
    const currentGroups = useGroupStore.getState().groups;
    const initialGroupId = initialGroup?.id ?? null;
    const selectedGroupId = selectedGroup?.id ?? null;
    const stateKey = `${initialGroupId}-${selectedGroupId}`;

    // Skip if we've already processed this exact state
    if (stateKey === lastProcessedRef.current) {
      return;
    }

    // Check if initialGroup exists in current groups
    const initialGroupExists = initialGroup
      ? currentGroups.some((g) => g.id === initialGroup.id)
      : false;

    // Don't sync deleted groups
    if (initialGroup && !initialGroupExists) {
      lastProcessedRef.current = stateKey;
      return;
    }

    // Don't restore if group was just deleted
    if (
      selectedGroup === null &&
      initialGroup &&
      (lastDeletedGroupId === initialGroup.id || !initialGroupExists)
    ) {
      lastProcessedRef.current = stateKey;
      return;
    }

    // Sync logic
    if (initialGroup === null && selectedGroup) {
      setSelectedGroup(null);
    } else if (
      initialGroup &&
      initialGroupExists &&
      selectedGroup?.id !== initialGroup.id
    ) {
      setSelectedGroup(initialGroup);
    } else if (initialGroup && initialGroupExists && !selectedGroup) {
      setSelectedGroup(initialGroup);
    }

    lastProcessedRef.current = stateKey;
  }, [initialGroup, selectedGroup, setSelectedGroup, lastDeletedGroupId]);

  // Load groups on mount only (not on every fetchGroups reference change)
  const hasLoadedGroupsRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedGroupsRef.current) {
      hasLoadedGroupsRef.current = true;
      fetchGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Load group details when selected group changes
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupDetails(selectedGroup.id);
    }
  }, [selectedGroup, fetchGroupDetails]);

  return {
    selectedGroup,
    groups,
    members,
    loading,
    error,
    setSelectedGroup,
    setError,
    fetchGroups,
    fetchGroupDetails,
    deleteGroup,
    exportData,
  };
}
