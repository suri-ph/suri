/**
 * Utility functions for generating user-friendly display names
 * Automatically differentiates duplicate names with numbering
 */

export interface PersonWithName {
  person_id: string;
  name: string;
  [key: string]: any;
}

export interface PersonWithDisplayName extends PersonWithName {
  displayName: string;
}

/**
 * Generates display names for a list of people, automatically adding
 * numeric suffixes for duplicates (e.g., "John Smith (2)")
 * Note: Duplicate detection is case-insensitive (e.g., "John" and "john" are treated as duplicates)
 *
 * @param persons - Array of persons with at least person_id and name
 * @returns Array of persons with added displayName property
 *
 * @example
 * const members = [
 *   { person_id: '1', name: 'John Smith' },
 *   { person_id: '2', name: 'Jane Doe' },
 *   { person_id: '3', name: 'john smith' }
 * ];
 * const withDisplayNames = generateDisplayNames(members);
 * // Result:
 * // [
 * //   { person_id: '1', name: 'John Smith', displayName: 'John Smith' },
 * //   { person_id: '2', name: 'Jane Doe', displayName: 'Jane Doe' },
 * //   { person_id: '3', name: 'john smith', displayName: 'john smith (2)' }
 * // ]
 */
export function generateDisplayNames<T extends PersonWithName>(
  persons: T[],
): (T & { displayName: string })[] {
  // Count occurrences of each name (case-insensitive)
  const nameOccurrences = new Map<string, number>();
  persons.forEach((person) => {
    const normalizedName = person.name.toLowerCase();
    const count = nameOccurrences.get(normalizedName) || 0;
    nameOccurrences.set(normalizedName, count + 1);
  });

  // Track which number we're on for each duplicate name (case-insensitive)
  const nameCounters = new Map<string, number>();

  return persons.map((person) => {
    const normalizedName = person.name.toLowerCase();
    const occurrences = nameOccurrences.get(normalizedName) || 1;

    // If name only appears once, use it as-is
    if (occurrences === 1) {
      return {
        ...person,
        displayName: person.name,
      };
    }

    // For duplicates, add numbering starting from (2)
    const currentCount = nameCounters.get(normalizedName) || 0;
    nameCounters.set(normalizedName, currentCount + 1);

    // First occurrence gets no suffix, subsequent ones get (2), (3), etc.
    const displayName =
      currentCount === 0 ? person.name : `${person.name} (${currentCount + 1})`;

    return {
      ...person,
      displayName,
    };
  });
}

/**
 * Gets the display name for a specific person from a list
 * Returns the person's name with differentiation if there are duplicates
 *
 * @param personId - The person_id to look up
 * @param persons - Array of persons
 * @returns Display name or 'Unknown' if not found
 */
export function getDisplayName(
  personId: string,
  persons: PersonWithName[],
): string {
  const withDisplayNames = generateDisplayNames(persons);
  const person = withDisplayNames.find((p) => p.person_id === personId);
  return person?.displayName || "Unknown";
}

/**
 * Creates a map of person_id to display name for efficient lookups
 *
 * @param persons - Array of persons
 * @returns Map<person_id, displayName>
 */
export function createDisplayNameMap(
  persons: PersonWithName[],
): Map<string, string> {
  const withDisplayNames = generateDisplayNames(persons);
  return new Map(withDisplayNames.map((p) => [p.person_id, p.displayName]));
}
