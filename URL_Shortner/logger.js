const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;
const HOST = "localhost";

const urlStore = new Map();
const analyticsStore = new Map();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const log = (tag, msg, lvl = "INFO") =>
    console.log(`[${new Date().toISOString()}] [${lvl}] ${tag}: ${msg}`);

const makeCode = () =>
    Array.from({ length: 6 }, () =>
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".charAt(
            Math.floor(Math.random() * 62)
        )
    ).join("");

const checkUrl = (val) => {
    try {
        const parsed = new URL(val);
        return ["http:", "https:"].includes(parsed.protocol);
    } catch {
        return false;
    }
};

const clientInfo = (req) => ({
    ip: (req.headers["x-forwarded-for"] || req.ip || "unknown")
        .split(",")[0]
        .trim(),
    agent: req.get("User-Agent") || "unknown",
    ref: req.get("Referer") || "direct",
    time: new Date().toISOString(),
});

const sendErr = (res, code, err, msg) =>
    res.status(code).json({ error: err, message: msg });

app.post("/shorturls", (req, res) => {
    try {
        const { url, validity = 30, shortcode } = req.body;
        if (!url) return sendErr(res, 400, "URL missing", "URL is required");
        if (!checkUrl(url))
            return sendErr(res, 400, "Bad URL", "Use http:// or https://");

        const expiry = new Date(Date.now() + validity * 60000);
        let code = shortcode || makeCode();

        if (shortcode) {
            if (!/^[a-zA-Z0-9]{1,20}$/.test(shortcode))
                return sendErr(res, 400, "Invalid shortcode", "Alphanumeric only (1–20)");
            if (urlStore.has(shortcode))
                return sendErr(res, 400, "Duplicate", "Shortcode already taken");
        } else {
            while (urlStore.has(code)) code = makeCode();
        }

        urlStore.set(code, {
            originalUrl: url,
            shortcode: code,
            expiry: expiry.toISOString(),
            createdAt: new Date().toISOString(),
            clicks: 0,
        });

        analyticsStore.set(code, {
            total: 0,
            details: [],
            createdAt: new Date().toISOString(),
        });

        log("CREATE", `Shortcode ${code} for ${url}`);
        res.status(201).json({
            shortLink: `http://${req.get("host")}/shorturls/${code}`,
            expiry: expiry.toISOString(),
        });
    } catch (e) {
        log("CREATE", e.message, "ERROR");
        sendErr(res, 500, "Server failure", "Short URL creation failed");
    }
});

app.get("/shorturls/:code", (req, res) => {
    try {
        const entry = urlStore.get(req.params.code);
        if (!entry) return sendErr(res, 404, "Not found", "Unknown shortcode");
        if (new Date() > new Date(entry.expiry)) {
            urlStore.delete(req.params.code);
            analyticsStore.delete(req.params.code);
            return sendErr(res, 410, "Expired", "This link is no longer active");
        }

        entry.clicks++;
        const stats = analyticsStore.get(req.params.code);
        stats.details.push({ ...clientInfo(req), clickedAt: new Date().toISOString() });
        stats.total++;

        res.redirect(302, entry.originalUrl);
    } catch (e) {
        log("REDIRECT", e.message, "ERROR");
        sendErr(res, 500, "Server failure", "Redirect failed");
    }
});

app.get("/shorturls/:code/stats", (req, res) => {
    try {
        const entry = urlStore.get(req.params.code);
        const stats = analyticsStore.get(req.params.code);
        if (!entry || !stats)
            return sendErr(res, 404, "Not found", "No statistics available");
        if (new Date() > new Date(entry.expiry))
            return sendErr(res, 410, "Expired", "Stats unavailable for expired link");

        const refCounts = {};
        stats.details.forEach((c) => {
            const r = c.ref || "direct";
            refCounts[r] = (refCounts[r] || 0) + 1;
        });

        const topRefs = Object.entries(refCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([referrer, count]) => ({ referrer, count }));

        const avg =
            stats.total /
            Math.max(1, Math.floor((new Date() - new Date(stats.createdAt)) / 86400000));

        res.json({
            shortcode: req.params.code,
            originalUrl: entry.originalUrl,
            totalClicks: stats.total,
            createdAt: stats.createdAt,
            expiry: entry.expiry,
            isExpired: false,
            clickDetails: stats.details.map((c) => ({
                timestamp: c.time,
                source: c.ref,
                referrer: c.ref,
                location: "Unknown",
                userAgent: c.agent,
                ip: c.ip.replace(/\.\d+$/, ".xxx"),
            })),
            summary: {
                averageClicksPerDay: avg,
                topReferrers: topRefs,
                topLocations: [{ location: "Unknown", count: stats.total }],
            },
        });
    } catch (e) {
        log("STATS", e.message, "ERROR");
        sendErr(res, 500, "Server failure", "Stats retrieval failed");
    }
});

app.get("/health", (req, res) =>
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "URL Shortener",
        version: "1.0.0",
        activeUrls: urlStore.size,
        totalAnalytics: analyticsStore.size,
    })
);

setInterval(() => {
    const now = new Date();
    let removed = 0;
    for (const [c, d] of urlStore.entries()) {
        if (now > new Date(d.expiry)) {
            urlStore.delete(c);
            analyticsStore.delete(c);
            removed++;
        }
    }
    if (removed) log("CLEANUP", `Pruned ${removed} expired links`);
}, 3600000);

const server = app.listen(PORT, () =>
    log("SERVER", `Listening at http://${HOST}:${PORT}`)
);

["SIGINT", "SIGTERM"].forEach((sig) =>
    process.on(sig, () =>
        server.close(() => {
            log("SHUTDOWN", `Stopped by ${sig}`);
            process.exit(0);
        })
    )
);

module.exports = app;