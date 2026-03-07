/**
 * Service catalog loader and registry
 * Manages available services from YAML definitions
 */

import { readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import type { ServiceDefinition, ServiceCategory } from "../../types/index.js";
import { logger } from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CATALOG_DIR = join(__dirname, "..", "..", "..", "catalog", "services");

export class ServiceCatalog {
  private services: Map<string, ServiceDefinition> = new Map();
  private loaded = false;

  /**
   * Load all services from catalog directory
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    const categories = await this.getCategoryDirs();

    for (const category of categories) {
      const categoryPath = join(CATALOG_DIR, category);

      try {
        const files = await readdir(categoryPath);

        for (const file of files) {
          if (file.endsWith(".yaml") || file.endsWith(".yml")) {
            const service = await this.loadServiceFile(join(categoryPath, file));
            if (service) {
              this.services.set(service.name, service);
            }
          }
        }
      } catch (error) {
        logger.warn("catalog.loader", `Failed to load category ${category}: ${error}`);
      }
    }

    this.loaded = true;
  }

  /**
   * Get list of category directories
   */
  private async getCategoryDirs(): Promise<string[]> {
    try {
      const entries = await readdir(CATALOG_DIR, { withFileTypes: true });
      return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith("_")).map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Load a single service definition from YAML file
   */
  private async loadServiceFile(path: string): Promise<ServiceDefinition | null> {
    try {
      const content = await readFile(path, "utf-8");
      const parsed = parseYaml(content) as ServiceDefinition;
      return parsed;
    } catch (error) {
      logger.warn("catalog.loader", `Failed to load service from ${path}: ${error}`);
      return null;
    }
  }

  /**
   * Get all available services
   */
  async getAll(): Promise<ServiceDefinition[]> {
    await this.load();
    return Array.from(this.services.values());
  }

  /**
   * Get service by name
   */
  async get(name: string): Promise<ServiceDefinition | undefined> {
    await this.load();
    return this.services.get(name);
  }

  /**
   * Get services by category
   */
  async getByCategory(category: ServiceCategory): Promise<ServiceDefinition[]> {
    await this.load();
    return Array.from(this.services.values()).filter((s) => s.category === category);
  }

  /**
   * Check if service exists in catalog
   */
  async exists(name: string): Promise<boolean> {
    await this.load();
    return this.services.has(name);
  }

  /**
   * Get list of available categories
   */
  async getCategories(): Promise<ServiceCategory[]> {
    await this.load();
    const categories = new Set<ServiceCategory>();

    for (const service of this.services.values()) {
      categories.add(service.category);
    }

    return Array.from(categories).sort();
  }

  /**
   * Search services by name or description
   */
  async search(query: string): Promise<ServiceDefinition[]> {
    await this.load();
    const lowerQuery = query.toLowerCase();

    return Array.from(this.services.values()).filter(
      (service) =>
        service.name.toLowerCase().includes(lowerQuery) || service.description.toLowerCase().includes(lowerQuery)
    );
  }
}

// Export singleton instance
export const catalog = new ServiceCatalog();
