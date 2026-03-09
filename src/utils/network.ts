/**
 * Network utilities for detecting the host's LAN IP address
 */

import { networkInterfaces } from "os";

/**
 * Detect the host's primary LAN IPv4 address.
 *
 * Iterates over non-internal network interfaces and returns the first
 * IPv4 address found, skipping loopback and Docker/virtual bridge
 * interfaces (docker*, br-*, veth*).
 *
 * Returns null if no suitable address is found.
 */
export function detectHostIp(): string | null {
  const interfaces = networkInterfaces();

  // Skip virtual/container bridge interfaces
  const skipPrefixes = ["docker", "br-", "veth"];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    const isVirtual = skipPrefixes.some((prefix) => name.startsWith(prefix));
    if (isVirtual) continue;

    for (const addr of addrs) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  return null;
}
