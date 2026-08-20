import http from "http";
import { AddressInfo } from "net";
import { HttpExecutor } from "../../src/executors/http.executor";
import { validateTargetUrl, isPrivateIP } from "../../src/executors/ssrf.validator";
import { UnrecoverableError } from "bullmq";

describe("SSRF Validator", () => {
  it("detects private and loopback IPv4 addresses", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(true);
    expect(isPrivateIP("127.1.2.3")).toBe(true);
    expect(isPrivateIP("10.0.0.1")).toBe(true);
    expect(isPrivateIP("172.16.0.1")).toBe(true);
    expect(isPrivateIP("172.31.255.255")).toBe(true);
    expect(isPrivateIP("192.168.1.1")).toBe(true);
    expect(isPrivateIP("169.254.169.254")).toBe(true);
    expect(isPrivateIP("0.0.0.0")).toBe(true);
  });

  it("detects private and loopback IPv6 addresses", () => {
    expect(isPrivateIP("::1")).toBe(true);
    expect(isPrivateIP("::")).toBe(true);
    expect(isPrivateIP("fe80::1")).toBe(true);
    expect(isPrivateIP("fc00::1")).toBe(true);
    expect(isPrivateIP("fd00::1")).toBe(true);
    expect(isPrivateIP("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIP("::ffff:192.168.1.1")).toBe(true);
  });

  it("allows public IP addresses", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false);
    expect(isPrivateIP("1.1.1.1")).toBe(false);
    expect(isPrivateIP("93.184.216.34")).toBe(false);
  });

  beforeEach(() => {
    delete process.env.ALLOW_INTERNAL_NETWORK_REQUESTS;
  });

  it("blocks direct loopback and private hostnames", async () => {
    delete process.env.ALLOW_INTERNAL_NETWORK_REQUESTS;
    await expect(validateTargetUrl("http://localhost:4000/api")).rejects.toThrow(/SSRF protection/);
    await expect(validateTargetUrl("http://127.0.0.1:5432")).rejects.toThrow(/SSRF protection/);
    await expect(validateTargetUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(/SSRF protection/);
    await expect(validateTargetUrl("http://postgres:5432")).rejects.toThrow(/SSRF protection/);
    await expect(validateTargetUrl("http://redis:6379")).rejects.toThrow(/SSRF protection/);
    await expect(validateTargetUrl("http://backend:4000")).rejects.toThrow(/SSRF protection/);
    await expect(validateTargetUrl("http://worker:4000")).rejects.toThrow(/SSRF protection/);
  });

  it("rejects non-http protocols", async () => {
    await expect(validateTargetUrl("ftp://example.com/file")).rejects.toThrow(/Unsupported protocol/);
    await expect(validateTargetUrl("file:///etc/passwd")).rejects.toThrow(/Unsupported protocol/);
  });
});

describe("HttpExecutor", () => {
  let server: http.Server;
  let serverPort: number;
  let lastRequest: {
    method?: string;
    headers?: http.IncomingHttpHeaders;
    body?: string;
    url?: string;
  } = {};
  let serverHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

  const executor = new HttpExecutor();

  beforeAll((done) => {
    server = http.createServer((req, res) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        lastRequest = {
          method: req.method,
          headers: req.headers,
          body: data,
          url: req.url,
        };
        if (serverHandler) {
          serverHandler(req, res);
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      serverPort = (server.address() as AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    lastRequest = {};
    process.env.ALLOW_INTERNAL_NETWORK_REQUESTS = "true";
  });

  afterEach(() => {
    delete process.env.ALLOW_INTERNAL_NETWORK_REQUESTS;
  });

  it("executes HTTP GET successfully", async () => {
    serverHandler = (req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "hello get" }));
    };

    const result = await executor.execute({
      url: `http://127.0.0.1:${serverPort}/test-get`,
      method: "GET",
      headers: { "X-Custom-Header": "custom-val" },
    });

    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(lastRequest.method).toBe("GET");
    expect(lastRequest.headers?.["x-custom-header"]).toBe("custom-val");
    expect(result.responseBody).toContain("hello get");
  });

  it("executes HTTP POST with JSON body and custom headers", async () => {
    serverHandler = (req, res) => {
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ created: true }));
    };

    const payloadBody = { name: "Job Item", count: 42 };

    const result = await executor.execute({
      url: `http://127.0.0.1:${serverPort}/test-post`,
      method: "POST",
      body: payloadBody,
      headers: { "X-Trace-Id": "12345" },
    });

    expect(result.success).toBe(true);
    expect(result.httpStatus).toBe(201);
    expect(lastRequest.method).toBe("POST");
    expect(lastRequest.headers?.["x-trace-id"]).toBe("12345");
    expect(lastRequest.headers?.["content-type"]).toBe("application/json");
    expect(JSON.parse(lastRequest.body || "{}")).toEqual(payloadBody);
  });

  it("executes HTTP PUT, PATCH, DELETE methods", async () => {
    for (const method of ["PUT", "PATCH", "DELETE"] as const) {
      serverHandler = (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ method: req.method }));
      };

      const result = await executor.execute({
        url: `http://127.0.0.1:${serverPort}/test-${method.toLowerCase()}`,
        method,
        body: method !== "DELETE" ? { action: "update" } : undefined,
      });

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(lastRequest.method).toBe(method);
    }
  });

  it("handles 4xx client errors as non-retryable UnrecoverableError", async () => {
    serverHandler = (req, res) => {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    };

    await expect(
      executor.execute({
        url: `http://127.0.0.1:${serverPort}/not-found`,
        method: "GET",
      })
    ).rejects.toThrow(UnrecoverableError);
  });

  it("handles 5xx server errors as retryable Error", async () => {
    serverHandler = (req, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Service Unavailable" }));
    };

    let caughtError: any;
    try {
      await executor.execute({
        url: `http://127.0.0.1:${serverPort}/server-error`,
        method: "GET",
      });
    } catch (err: any) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    expect(caughtError).not.toBeInstanceOf(UnrecoverableError);
    expect(caughtError.message).toContain("503");
  });

  it("enforces timeout via AbortController", async () => {
    serverHandler = (req, res) => {
      // Intentionally do not respond immediately
      setTimeout(() => {
        res.writeHead(200);
        res.end("delayed");
      }, 1500);
    };

    await expect(
      executor.execute({
        url: `http://127.0.0.1:${serverPort}/timeout`,
        method: "GET",
        timeoutMs: 50, // very short timeout
      })
    ).rejects.toThrow(/timed out/i);
  });

  it("supports cancellation via external AbortSignal", async () => {
    serverHandler = (req, res) => {
      setTimeout(() => {
        res.writeHead(200);
        res.end("delayed");
      }, 1000);
    };

    const parentController = new AbortController();
    setTimeout(() => {
      parentController.abort();
    }, 50);

    await expect(
      executor.execute(
        {
          url: `http://127.0.0.1:${serverPort}/cancel`,
          method: "GET",
          timeoutMs: 5000,
        },
        parentController.signal
      )
    ).rejects.toThrow(/cancelled|aborted/i);
  });

  it("truncates large response bodies safely", async () => {
    const largeText = "A".repeat(40000);
    serverHandler = (req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(largeText);
    };

    const result = await executor.execute({
      url: `http://127.0.0.1:${serverPort}/large-response`,
      method: "GET",
    });

    expect(result.success).toBe(true);
    expect(result.responseBody?.length).toBeLessThan(35000);
    expect(result.responseBody).toContain("[truncated after 32768 bytes]");
  });

  it("throws UnrecoverableError when URL is missing or empty", async () => {
    await expect(
      executor.execute({
        url: "",
      })
    ).rejects.toThrow("HTTP job is missing a valid URL");

    await expect(
      executor.execute({} as any)
    ).rejects.toThrow("HTTP job is missing a valid URL");
  });

  it("throws UnrecoverableError when method is unsupported", async () => {
    await expect(
      executor.execute({
        url: `http://127.0.0.1:${serverPort}/test`,
        method: "INVALID_METHOD" as any,
      })
    ).rejects.toThrow(UnrecoverableError);
  });
});
