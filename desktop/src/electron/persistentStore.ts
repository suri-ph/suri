import Store from "electron-store";
import {
  type PersistentSettingsSchema,
  defaultSettings,
} from "../services/persistentSettingsDefaults.js";

// Create the persistent store instance (electron-store)
export const persistentStore = new Store<PersistentSettingsSchema>({
  name: "config",
  defaults: defaultSettings,
});
