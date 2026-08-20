import net from "net";
import dns from "dns/promises";
import { env } from "../config/env";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "postgres",
  "redis",
  "backend",
  "worker",
  "frontend",
  "job-scheduler-postgres",
  "job-scheduler-redis",
  "job-scheduler-backend",
  "job-scheduler-frontend",
  "job-scheduler-worker",
  "host.docker.internal",
  "gateway.docker.internal",
]);

function isPrivateIPv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
    return true; // invalid IPv4 format treated as unsafe
  }

  const [a, b, c] = octets;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 10.0.0.0/8 (RFC 1918)
  if (a === 10) return true;

  // 100.64.0.0/10 (Carrier-grade NAT RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 169.254.0.0/16 (Link-local RFC 3927)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 (RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.168.0.0/16 (RFC 1918)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback (::1)
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;

  // Unspecified (::)
  if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:a.b.c.d)
  if (normalized.startsWith("::ffff:") || normalized.startsWith("0:0:0:0:0:ffff:")) {
    const parts = normalized.split(":");
    const lastPart = parts[parts.length - 1];
    if (net.isIPv4(lastPart)) {
      return isPrivateIPv4(lastPart);
    }
    return true;
  }

  // Link-local (fe80::/10)
  if (/^fe[89ab]/i.test(normalized)) return true;

  // Unique local address (fc00::/7 -> fc.. or fd..)
  if (/^f[cd]/i.test(normalized)) return true;

  // Multicast (ff00::/8)
  if (/^ff/i.test(normalized)) return true;

  return false;
}

export function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isPrivateIPv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIPv6(ip);
  }
  return false;
}

export interface ValidateUrlOptions {
  allowInternal?: boolean;
}

export async function validateTargetUrl(
  rawUrl: string,
  options?: ValidateUrlOptions
): Promise<URL> {
  const allowInternal =
    options?.allowInternal ??
    (process.env.ALLOW_INTERNAL_NETWORK_REQUESTS === "true" ||
      env.ALLOW_INTERNAL_NETWORK_REQUESTS === true);

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL format: "${rawUrl}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol "${parsed.protocol}". Only http: and https: are allowed.`);
  }

  if (allowInternal) {
    return parsed;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Strip brackets from IPv6 hostnames like [::1]
  const cleanHostname = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;

  // 1. Direct hostname blacklist
  if (BLOCKED_HOSTNAMES.has(cleanHostname)) {
    throw new Error(`Access to internal/private host "${hostname}" is blocked (SSRF protection)`);
  }

  // 2. Direct IP check
  if (net.isIP(cleanHostname)) {
    if (isPrivateIP(cleanHostname)) {
      throw new Error(`Access to private IP address "${cleanHostname}" is blocked (SSRF protection)`);
    }
    return parsed;
  }

  // 3. DNS resolution check (prevents DNS rebinding and aliases pointing to private IPs)
  try {
    const records = await dns.lookup(cleanHostname, { all: true });
    if (!records || records.length === 0) {
      throw new Error(`Unable to resolve hostname "${cleanHostname}"`);
    }

    for (const record of records) {
      if (isPrivateIP(record.address)) {
        throw new Error(
          `Host "${hostname}" resolved to private IP "${record.address}" (SSRF protection)`
        );
      }
    }
  } catch (err: any) {
    if (err.message.includes("SSRF protection")) {
      throw err;
    }
    throw new Error(`DNS resolution failed for hostname "${hostname}": ${err.message}`);
  }

  return parsed;
}
