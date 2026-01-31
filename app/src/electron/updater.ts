/**
 * GitHub Release Update Checker
 *
 * Checks for new versions via GitHub Releases API.
 * Since the app is unsigned, we use manual download approach:
 * - Check GitHub releases for new version
 * - Notify user if update available
 * - User manually downloads from GitHub releases page
 *
 * OFFLINE-FIRST: This module is designed to work seamlessly offline.
 * - All network calls are non-blocking with timeouts
 * - Errors are silently caught and logged
 * - App functions normally even without internet
 * - No update check failures will affect app functionality
 *
 * Future: When code-signed, migrate to electron-updater for auto-install
 */

import { app, shell, BrowserWindow, net } from "electron";

// GitHub repository configuration (suriAI organization)
const GITHUB_OWNER = "suriAI";
const GITHUB_REPO = "suri";
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// Cache configuration
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NETWORK_TIMEOUT_MS = 8000; // 8 seconds - fail fast if no internet
let lastCheckTime = 0;
let cachedUpdateInfo: UpdateInfo | null = null;

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string | null;
  error?: string;
  isOffline?: boolean;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: {
    name: string;
    browser_download_url: string;
  }[];
}

/**
 * Parse semantic version string into comparable parts
 */
function parseVersion(version: string): number[] {
  // Remove 'v' prefix if present
  const clean = version.replace(/^v/, "");
  return clean.split(".").map((part) => parseInt(part, 10) || 0);
}

/**
 * Compare two semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = parseVersion(a);
  const partsB = parseVersion(b);

  const maxLength = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLength; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;

    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }

  return 0;
}

/**
 * Get the appropriate download asset URL for current platform
 */
function getDownloadUrl(assets: GitHubRelease["assets"]): string | null {
  const platform = process.platform;

  // Define patterns for each platform
  const patterns: Record<string, RegExp[]> = {
    win32: [/\.exe$/i, /\.msi$/i, /portable.*\.exe$/i],
    darwin: [/\.dmg$/i, /\.pkg$/i],
    linux: [/\.AppImage$/i, /\.deb$/i, /\.rpm$/i],
  };

  const platformPatterns = patterns[platform] || [];

  for (const pattern of platformPatterns) {
    const asset = assets.find((a) => pattern.test(a.name));
    if (asset) {
      return asset.browser_download_url;
    }
  }

  return null;
}

/**
 * Check if we have network connectivity
 * Uses Electron's net module for accurate online status
 */
function isOnline(): boolean {
  return net.isOnline();
}

/**
 * Fetch latest release info from GitHub API
 * Returns null if offline or on any error (fail silently)
 */
async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  // Check network status first - fail fast if offline
  if (!isOnline()) {
    console.log("[Updater] Offline - skipping update check");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

    const response = await fetch(GITHUB_RELEASES_URL, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": `Suri/${app.getVersion()}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        console.log("[Updater] No releases found");
        return null;
      }
      console.log(`[Updater] GitHub API returned ${response.status}`);
      return null;
    }

    return (await response.json()) as GitHubRelease;
  } catch (error) {
    // Silently handle all errors - this is expected when offline
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.log(
          "[Updater] Request timed out - likely offline or slow connection",
        );
      } else {
        console.log(
          "[Updater] Network error (expected if offline):",
          error.message,
        );
      }
    }
    return null;
  }
}

/**
 * Check for updates from GitHub releases
 * This is fully offline-compatible - returns gracefully on any error
 * @param force - If true, bypasses the 24-hour cache
 */
export async function checkForUpdates(force = false): Promise<UpdateInfo> {
  const currentVersion = app.getVersion();
  const now = Date.now();

  // Return cached result if within check interval (unless forced)
  if (!force && cachedUpdateInfo && now - lastCheckTime < CHECK_INTERVAL_MS) {
    console.log("[Updater] Returning cached update info");
    return cachedUpdateInfo;
  }

  // Check if we're online first
  if (!isOnline()) {
    console.log("[Updater] Offline - returning current version info");
    const offlineInfo: UpdateInfo = {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseUrl: GITHUB_RELEASES_PAGE,
      releaseNotes: "",
      publishedAt: "",
      downloadUrl: null,
      isOffline: true,
    };
    // Don't cache offline result - check again when online
    return offlineInfo;
  }

  console.log(`[Updater] Checking for updates (current: v${currentVersion})`);

  const release = await fetchLatestRelease();

  if (!release) {
    // Network error or no releases - return gracefully
    const noUpdateInfo: UpdateInfo = {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseUrl: GITHUB_RELEASES_PAGE,
      releaseNotes: "",
      publishedAt: "",
      downloadUrl: null,
    };
    // Cache this result to avoid hammering the API
    cachedUpdateInfo = noUpdateInfo;
    lastCheckTime = now;
    return noUpdateInfo;
  }

  const latestVersion = release.tag_name.replace(/^v/, "");
  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

  const updateInfo: UpdateInfo = {
    currentVersion,
    latestVersion,
    hasUpdate,
    releaseUrl: release.html_url,
    releaseNotes: release.body || "",
    publishedAt: release.published_at,
    downloadUrl: getDownloadUrl(release.assets),
  };

  cachedUpdateInfo = updateInfo;
  lastCheckTime = now;

  console.log(
    `[Updater] Latest: v${latestVersion}, Current: v${currentVersion}, Update available: ${hasUpdate}`,
  );

  return updateInfo;
}

/**
 * Get current app version
 */
export function getCurrentVersion(): string {
  return app.getVersion();
}

/**
 * Open the GitHub releases page in the default browser
 */
export function openReleasePage(url?: string): void {
  shell.openExternal(url || GITHUB_RELEASES_PAGE);
}

/**
 * Send update notification to renderer process
 */
export function notifyRenderer(
  mainWindow: BrowserWindow | null,
  updateInfo: UpdateInfo,
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:update-available", updateInfo);
  }
}

/**
 * Background update check - runs periodically after app startup
 * This is completely non-blocking and offline-safe
 */
export async function startBackgroundUpdateCheck(
  mainWindow: BrowserWindow | null,
  delayMs = 60000, // 1 minute after startup
): Promise<void> {
  // Initial delayed check
  setTimeout(async () => {
    // Only check if online
    if (!isOnline()) {
      console.log("[Updater] Skipping background check - offline");
      return;
    }

    try {
      const updateInfo = await checkForUpdates();
      if (updateInfo.hasUpdate && !updateInfo.isOffline) {
        console.log(`[Updater] Update available: v${updateInfo.latestVersion}`);
        notifyRenderer(mainWindow, updateInfo);
      }
    } catch (error) {
      // Silently ignore all errors - update checks should never affect app
      console.log("[Updater] Background check failed (non-critical):", error);
    }
  }, delayMs);
}
