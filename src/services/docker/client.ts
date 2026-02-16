/**
 * Docker API client wrapper
 * Provides type-safe access to Docker daemon
 */

import Docker from 'dockerode';
import type { ContainerInfo } from 'dockerode';

export interface ContainerStatus {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created';
  status: string;
  health?: 'healthy' | 'unhealthy' | 'starting' | undefined;
  ports: Array<{
    privatePort: number;
    publicPort?: number;
    type: string;
  }>;
  labels: Record<string, string>;
  uptime?: number;
}

export class DockerClient {
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Check if Docker daemon is accessible
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Docker version info
   */
  async version(): Promise<unknown> {
    return this.docker.version();
  }

  /**
   * List all containers (running and stopped)
   */
  async listContainers(all = true): Promise<ContainerStatus[]> {
    const containers = await this.docker.listContainers({ all });
    
    return containers.map(container => this.mapContainerInfo(container));
  }

  /**
   * Get container by name or ID
   */
  async getContainer(nameOrId: string): Promise<ContainerStatus | null> {
    const containers = await this.listContainers(true);
    
    // Try exact match first
    let container = containers.find(c => 
      c.id === nameOrId || 
      c.name === nameOrId || 
      c.name === `/${nameOrId}`
    );
    
    // Try partial match
    if (!container) {
      container = containers.find(c => 
        c.id.startsWith(nameOrId) || 
        c.name.includes(nameOrId)
      );
    }
    
    return container || null;
  }

  /**
   * Get detailed container info
   */
  async inspectContainer(id: string): Promise<unknown> {
    const container = this.docker.getContainer(id);
    return container.inspect();
  }

  /**
   * Get container logs
   */
  async getLogs(id: string, options: {
    tail?: number;
    since?: number;
    timestamps?: boolean;
  } = {}): Promise<string> {
    const container = this.docker.getContainer(id);
    
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.tail || 100,
      since: options.since,
      timestamps: options.timestamps,
      follow: false,
    });

    // Handle buffer response - remove Docker multiplex headers
    if (Buffer.isBuffer(logs)) {
      let output = '';
      let offset = 0;
      
      while (offset < logs.length) {
        // Docker multiplex format: [1 byte stream type][3 bytes padding][4 bytes length][data]
        if (offset + 8 <= logs.length) {
          const length = logs.readUInt32BE(offset + 4);
          if (offset + 8 + length <= logs.length) {
            output += logs.slice(offset + 8, offset + 8 + length).toString('utf-8');
            offset += 8 + length;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      return output;
    }
    
    return '';
  }

  /**
   * Check if container exists
   */
  async containerExists(name: string): Promise<boolean> {
    const container = await this.getContainer(name);
    return container !== null;
  }

  /**
   * Map Dockerode container info to our format
   */
  private mapContainerInfo(container: ContainerInfo): ContainerStatus {
    const state = container.State as ContainerStatus['state'];
    const status = container.Status;
    
    // Parse health from status string if available
    let health: ContainerStatus['health'];
    if (status.includes('(healthy)')) {
      health = 'healthy';
    } else if (status.includes('(unhealthy)')) {
      health = 'unhealthy';
    } else if (status.includes('(health: starting)')) {
      health = 'starting';
    }

    return {
      id: container.Id,
      name: container.Names[0] || '',
      image: container.Image,
      state,
      status,
      health,
      ports: container.Ports.map(p => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
      labels: container.Labels || {},
    };
  }

  /**
   * Create a Docker network
   */
  async createNetwork(name: string): Promise<void> {
    try {
      await this.docker.createNetwork({
        Name: name,
        Driver: 'bridge',
        CheckDuplicate: true,
      });
    } catch (error) {
      // Network might already exist
      if ((error as Error).message?.includes('already exists')) {
        return;
      }
      throw error;
    }
  }

  /**
   * Check if network exists
   */
  async networkExists(name: string): Promise<boolean> {
    try {
      const networks = await this.docker.listNetworks();
      return networks.some(n => n.Name === name);
    } catch {
      return false;
    }
  }

  /**
   * Get Docker system info
   */
  async info(): Promise<unknown> {
    return this.docker.info();
  }

  /**
   * Get network gateway IP address
   */
  async getNetworkGateway(name: string): Promise<string | null> {
    try {
      const network = this.docker.getNetwork(name);
      const inspect = await network.inspect();
      return inspect.IPAM?.Config?.[0]?.Gateway || null;
    } catch {
      return null;
    }
  }

  /**
   * Get container IP address on a specific network
   * Returns the IP address of a container on the specified Docker network
   */
  async getContainerIP(containerName: string, networkName: string): Promise<string | null> {
    try {
      const network = this.docker.getNetwork(networkName);
      const inspect = await network.inspect();
      
      // Find the container in the network's Containers list
      const containers = inspect.Containers || {};
      for (const [containerId, containerInfo] of Object.entries(containers)) {
        if (containerInfo.Name === containerName) {
          // Extract IP from the CIDR notation (e.g., "10.0.7.2/24" -> "10.0.7.2")
          const ipWithCidr = containerInfo.IPv4Address;
          if (ipWithCidr) {
            return ipWithCidr.split('/')[0];
          }
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

// Export singleton
export const docker = new DockerClient();
