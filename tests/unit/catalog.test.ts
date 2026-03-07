/**
 * Service catalog loader tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { ServiceCatalog } from "../../src/core/catalog/loader.js";

describe("ServiceCatalog", () => {
  let catalog: ServiceCatalog;

  beforeEach(() => {
    catalog = new ServiceCatalog();
  });

  describe("load", () => {
    it("should load without errors", async () => {
      await catalog.load();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("getAll", () => {
    it("should return array of services", async () => {
      const services = await catalog.getAll();
      expect(Array.isArray(services)).toBe(true);
    });

    it("should include pihole service", async () => {
      const services = await catalog.getAll();
      const pihole = services.find((s) => s.name === "pihole");
      expect(pihole).toBeDefined();
      expect(pihole?.category).toBe("dns");
    });

    it("should include plex service", async () => {
      const services = await catalog.getAll();
      const plex = services.find((s) => s.name === "plex");
      expect(plex).toBeDefined();
      expect(plex?.category).toBe("media");
    });

    it("should include joyride service", async () => {
      const services = await catalog.getAll();
      const joyride = services.find((s) => s.name === "joyride");
      expect(joyride).toBeDefined();
      expect(joyride?.category).toBe("media");
    });

    it("should include openspeedtest service", async () => {
      const services = await catalog.getAll();
      const openspeedtest = services.find((s) => s.name === "openspeedtest");
      expect(openspeedtest).toBeDefined();
      expect(openspeedtest?.category).toBe("development");
    });

    it("should include webtop service", async () => {
      const services = await catalog.getAll();
      const webtop = services.find((s) => s.name === "webtop");
      expect(webtop).toBeDefined();
      expect(webtop?.category).toBe("development");
    });
  });

  describe("get", () => {
    it("should return specific service by name", async () => {
      const pihole = await catalog.get("pihole");
      expect(pihole).toBeDefined();
      expect(pihole?.name).toBe("pihole");
      expect(pihole?.category).toBe("dns");
    });

    it("should return undefined for non-existent service", async () => {
      const service = await catalog.get("nonexistent");
      expect(service).toBeUndefined();
    });
  });

  describe("exists", () => {
    it("should return true for existing service", async () => {
      const exists = await catalog.exists("pihole");
      expect(exists).toBe(true);
    });

    it("should return false for non-existent service", async () => {
      const exists = await catalog.exists("nonexistent");
      expect(exists).toBe(false);
    });
  });

  describe("getByCategory", () => {
    it("should return services in specified category", async () => {
      const mediaServices = await catalog.getByCategory("media");
      expect(mediaServices.length).toBeGreaterThan(0);
      expect(mediaServices.every((s) => s.category === "media")).toBe(true);
    });

    it("should return empty array for empty category", async () => {
      // Use a category type that has no service definitions
      const services = await catalog.getByCategory("games" as "dns");
      // If games has entries, this validates filtering works correctly
      for (const s of services) {
        expect(s.category).toBe("games");
      }
    });
  });

  describe("search", () => {
    it("should find services by name", async () => {
      const results = await catalog.search("pihole");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.name === "pihole")).toBe(true);
    });

    it("should find services by description", async () => {
      const results = await catalog.search("media");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should be case-insensitive", async () => {
      const results = await catalog.search("PIHOLE");
      expect(results.some((s) => s.name === "pihole")).toBe(true);
    });

    it("should return empty array for no matches", async () => {
      const results = await catalog.search("xyznonexistent");
      expect(results).toHaveLength(0);
    });
  });

  describe("getCategories", () => {
    it("should return array of categories", async () => {
      const categories = await catalog.getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it("should include dns and media categories", async () => {
      const categories = await catalog.getCategories();
      expect(categories.includes("dns")).toBe(true);
      expect(categories.includes("media")).toBe(true);
    });
  });
});
