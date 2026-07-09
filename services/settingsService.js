"use strict";

const SettingsHelper = require("../helpers/settingsHelper");

class SettingsService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000;
  }

  async getCachedSettings() {
    const now = Date.now();
    if (
      !this.cache.has("settings") ||
      this.cache.get("settingsExpiry") < now
    ) {
      const settings = await SettingsHelper.consolidatedSettings();

      this.cache.set("settings", settings);
      this.cache.set("settingsExpiry", now + this.CACHE_TTL);
    }

    return this.cache.get("settings");
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new SettingsService();
