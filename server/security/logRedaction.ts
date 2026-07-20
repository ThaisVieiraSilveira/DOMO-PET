export function redactToken(body: any): any {
  if (!body) return body;
  if (typeof body !== "object") return body;
  
  const redacted = { ...body };
  if ("token" in redacted) {
    redacted.token = "[REDACTED]";
  }
  if ("tutorAccessToken" in redacted) {
    redacted.tutorAccessToken = "[REDACTED]";
  }
  return redacted;
}

export function redactLogString(message: string): string {
  if (!message) return message;
  let redacted = message;

  // 1. Redact explicit token JSON keys/parameters
  redacted = redacted.replace(/("token"|"tutorAccessToken"|token|tutorAccessToken)\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}["']?/ig, '$1: "[REDACTED]"');

  // 2. Redact custom tutorAccessToken_... prefixes
  redacted = redacted.replace(/tutorAccessToken_[a-zA-Z0-9_-]{16,}/ig, "[REDACTED_SECRET]");

  // 3. Redact high-entropy alphanumeric strings of length 32 to 128 (captures raw tokens, hashes, etc.)
  redacted = redacted.replace(/\b([a-fA-F0-9]{32,128})\b/ig, "[REDACTED_SECRET]");

  // 4. Redact auth headers and parameter tokens
  redacted = redacted.replace(/(Bearer\s+)[a-zA-Z0-9_\-\.\~+\/]+=*/ig, "$1[REDACTED_AUTH]");
  redacted = redacted.replace(/(\btok=\b|\btoken\b|\bkey\b)[a-zA-Z0-9_\-\.\~+\/]+=*/ig, "$1=[REDACTED_PARAM]");

  return redacted;
}

export function redactError(err: any): Error {
  if (!err) return err;
  
  const cleanMessage = redactLogString(err.message || String(err));
  const cleanStack = err.stack ? redactLogString(err.stack) : undefined;
  
  const cleanErr = new Error(cleanMessage);
  if (cleanStack) {
    cleanErr.stack = cleanStack;
  }
  return cleanErr;
}

export class SecureLogger {
  private static interceptedLogs: string[] = [];

  static enableTestInterceptor() {
    this.interceptedLogs = [];
  }

  static getInterceptedLogs(): string[] {
    return this.interceptedLogs;
  }

  static redactMessage(msg: any): string {
    if (msg === null || msg === undefined) return "";
    let str = "";
    if (msg instanceof Error) {
      str = `${msg.name}: ${msg.message}\nStack: ${msg.stack || ""}`;
    } else if (typeof msg === "object") {
      try {
        str = JSON.stringify(msg);
      } catch {
        str = String(msg);
      }
    } else {
      str = String(msg);
    }
    return redactLogString(str);
  }

  static info(message: any, ...args: any[]) {
    const formatted = this.redactMessage(message);
    const formattedArgs = args.map(a => this.redactMessage(a));
    this.interceptedLogs.push(formatted + " " + formattedArgs.join(" "));
    console.log(formatted, ...formattedArgs);
  }

  static error(message: any, ...args: any[]) {
    const formatted = this.redactMessage(message);
    const formattedArgs = args.map(a => this.redactMessage(a));
    this.interceptedLogs.push(formatted + " " + formattedArgs.join(" "));
    console.error(formatted, ...formattedArgs);
  }
}
