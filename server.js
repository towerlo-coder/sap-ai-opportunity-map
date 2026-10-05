// Serves the opportunity map only to signed-in users.
// Credentials come from environment variables (ADMIN_USER, ADMIN_PASSWORD); nothing secret is stored in the repo.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const USER = process.env.ADMIN_USER || "admin";
const PASSWORD = process.env.ADMIN_PASSWORD || "";
// Without SESSION_SECRET, sessions reset whenever the service restarts.
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 12);
const COOKIE = "sapai_session";

const SITE = fs.readFileSync(path.join(__dirname, "site", "index.html"), "utf8");
const LOGIN = fs.readFileSync(path.join(__dirname, "login.html"), "utf8");
const LOGOUT_LINK = `<a href="/logout" style="position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));font:13px system-ui,sans-serif;padding:6px 12px;border-radius:999px;background:var(--fg,#14202b);color:var(--bg,#fff);text-decoration:none;opacity:.85">退出登录</a>`;
const PAGE = SITE.replace(/<\/body>/i, LOGOUT_LINK + "</body>");

const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function readSession(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, mac] = decodeURIComponent(m[1]).split(".");
  return !!exp && !!mac && Number(exp) > Date.now() && safeEqual(mac, sign(exp));
}

function cookie(req, value, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// Slow down password guessing: after 5 failures an IP waits 15 minutes.
// The last X-Forwarded-For entry is the one added by the hosting proxy; earlier entries can be forged by the client.
const failures = new Map();
const clientIp = (req) => (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",").pop().trim();
function blocked(ip) {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > 15 * 60 * 1000) { failures.delete(ip); return false; }
  return f.count >= 5;
}
function recordFailure(ip) {
  const f = failures.get(ip) || { count: 0, first: Date.now() };
  f.count++;
  failures.set(ip, f);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
    ...headers,
  });
  res.end(body);
}

const loginPage = (msg) => LOGIN.replace("<!--MESSAGE-->", msg ? `<p class="err" role="alert">${msg}</p>` : "");

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (!PASSWORD) {
    return send(res, 503, "<p>ADMIN_PASSWORD is not set. Add it to the service's environment variables and restart.</p>");
  }

  if (url.pathname === "/login" && req.method === "POST") {
    const ip = clientIp(req);
    if (blocked(ip)) return send(res, 429, loginPage("尝试次数过多，请 15 分钟后再试。"));
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 4096) req.destroy(); });
    req.on("end", () => {
      const form = new URLSearchParams(body);
      const okUser = safeEqual(form.get("username") || "", USER);
      const okPass = safeEqual(form.get("password") || "", PASSWORD);
      if (okUser && okPass) {
        failures.delete(ip);
        const exp = String(Date.now() + SESSION_HOURS * 3600 * 1000);
        return send(res, 303, "", { Location: "/", "Set-Cookie": cookie(req, `${exp}.${sign(exp)}`, SESSION_HOURS * 3600) });
      }
      recordFailure(ip);
      send(res, 401, loginPage("用户名或密码不正确。"));
    });
    return;
  }

  if (url.pathname === "/logout") {
    return send(res, 303, "", { Location: "/login", "Set-Cookie": cookie(req, "", 0) });
  }

  if (url.pathname === "/login") {
    return readSession(req) ? send(res, 303, "", { Location: "/" }) : send(res, 200, loginPage());
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    return readSession(req) ? send(res, 200, PAGE) : send(res, 303, "", { Location: "/login" });
  }

  send(res, 404, "<p>Not found</p>");
}).listen(PORT, () => console.log(`Listening on ${PORT}`));
