require('dotenv').config();
const express = require("express");
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logActivity = require("./middleware/apiLogger");
const cookieParser = require('cookie-parser');
var cors = require('cors');
const UsersControllerClass = require("./controllers/usersController");
const UsersController = new UsersControllerClass();
const validateToken = require("./middleware/validateTokenHandler");
const loggedInGuest = require("./middleware/loggedInGuestHandler");

const app = express();

app.set('trust proxy', 1);

// Security headers — sets CSP, X-Frame-Options, X-Content-Type-Options, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://code.jquery.com", "https://cdn.jsdelivr.net", "https://*.fontawesome.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "https://*.fontawesome.com"],
      fontSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://*.fontawesome.com"],
      imgSrc: ["'self'", "data:", "https://d30gmll2eqdrzt.cloudfront.net", "https://*.cloudfront.net", "https://staymaster.in", "https://*.staymaster.in", "https://thestaymaster.com", "https://*.thestaymaster.com", "https://*.amazonaws.com"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://code.jquery.com", "https://*.fontawesome.com"],
      frameSrc: ["'self'", "https://www.google.com"],
    }
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Gzip/Brotli compression — reduces JSON payload size 60-80%
app.use(compression({ threshold: 1024 }));

// Extra allowed origins from env (comma-separated). Supports `*` wildcards, e.g.
// CORS_EXTRA_ORIGINS=https://your-frontend.vercel.app,https://*.vercel.app
const extraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const staticOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://thestaymaster.com',
  'https://checkin.thestaymaster.com',
  'https://bms.thestaymaster.com',
  'https://tsm.squatics.com',
  'https://staymaster-website.vercel.app',
  'https://masterkey.staymaster.in',
  'https://investors.staymaster.in',
  'http://127.0.0.1:5500',
  'https://tsmprecheckin.startupinnovative.in',
  'https://tsmbackend.startupinnovative.in',
  'https://mediumseagreen-shrew-722722.hostingersite.com',
  'https://olive-ferret-207490.hostingersite.com',
  'https://tsmprecheckin.startupinnovative.in',
  'https://tsmfrontend.startupinnovative.in',
  'https://staymaster.in',
  'https://guest.staymaster.in',
  'https://srv1401463.hstgr.cloud',
  'http://localhost:4200',
  'http://localhost:8081',
  'http://10.0.2.2:8080',
  'http://10.0.3.2:8080',
  'http://127.0.0.1:8080'
];

// Split env origins into exact matches and wildcard patterns (compiled to RegExp)
const exactOrigins = new Set([
  ...staticOrigins,
  ...extraOrigins.filter((o) => !o.includes('*'))
]);
const wildcardPatterns = extraOrigins
  .filter((o) => o.includes('*'))
  .map((o) => new RegExp('^' + o.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));

const isOriginAllowed = (origin) => {
  if (exactOrigins.has(origin)) return true;
  return wildcardPatterns.some((re) => re.test(origin));
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, server-to-server) with no Origin header
    if (!origin || isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-secure-id', 'x-guest-token', 'guesttoken'],
  optionsSuccessStatus: 204
}));

// Rate limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OTP requests, please try again later.' }
});

// Apply global limit to all API routes
app.use('/api', globalLimiter);

// Tighter limits on auth/OTP endpoints
app.use('/api/ext/generateOTP', otpLimiter);
app.use('/api/ext/generateHostOTP', otpLimiter);
app.use('/api/ext/loginWithOTP', otpLimiter);
app.use('/api/ext/verifyHostOTP', otpLimiter);
app.use('/api/users/login', authLimiter);
app.use('/api/hosts/login', authLimiter);
app.use('/api/manager/login', authLimiter);

// Per-route upload timeout (5 min) — applied only to upload routes
const uploadTimeout = (req, res, next) => {
  req.setTimeout(300000);
  res.setTimeout(300000);
  next();
};
app.use('/api/properties/upload-image', uploadTimeout);
app.use('/api/properties/replace-image', uploadTimeout);
app.use('/api/manager/blogs', uploadTimeout);

// Default request timeout: 2 minutes
app.use((req, res, next) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  next();
});

// Scalnex blog webhook — large JSON bodies (HTML content) before global 50kb parser
app.use(
  '/api/webhooks/scalnex',
  express.json({ limit: '5mb' }),
  require('./routes/scalnexWebhookRoutes')
);

// JSON / urlencoded limits — 50kb is enough for all API calls; uploads use multer per-route
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());

const port = process.env.PORT || 8080;
app.set('view engine', 'ejs');
app.use('/api/public', express.static('public'));

// Health check — required by load balancers, PM2, and monitoring tools
const pool = require('./config/dbConnection');
const redisClient = require('./config/redisConnection');
app.get('/health', async (req, res) => {
  let dbOk = false;
  let redisOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch (_) {}
  try { redisOk = Boolean(redisClient && redisClient.isOpen); } catch (_) {}
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk,
    redis: redisOk,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Swagger Documentation — only in non-production environments
if (process.env.NODE_ENV !== 'production') {
  try {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpecs = require('./config/swagger');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
    app.get('/api-docs-json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpecs);
    });
    console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
  } catch (swaggerError) {
    console.warn('Swagger dependencies missing, skipping API docs setup:', swaggerError.message);
  }
}

app.all('*', logActivity);
app.use('/api/ext', require('./routes/apiRoutes'));
app.use('/api/contacts', require("./routes/contactRotes"));
app.use('/api/destinations', require("./routes/destinationRoutes"));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/feusers', require('./routes/feuserRoutes'));
app.use('/api/collections', require('./routes/collectionRoutes'));
app.use('/admin', require('./routes/backendRoutes'));
app.use('/api/hosts', require('./routes/hostRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/banners', require('./routes/bannerRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/manager', require('./routes/managerRoutes'));
try {
  app.use('/api/blogs', require('./routes/blogRoutes'));
} catch (error) {
  console.error("Error loading blogRoutes:", error);
}
app.use('/api/google-reviews', require('./routes/googleReviewRoutes'));

// Guest account utilities
app.delete('/api/clearAllUserData', validateToken, loggedInGuest, UsersController.clearAllUserData);
app.delete('/api/users/clearAllUserData', validateToken, loggedInGuest, UsersController.clearAllUserData);

// Global error handler — must be registered after all routes
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// Only run scheduling/cron on the primary PM2 instance (instance 0) or standalone
const isPrimaryInstance = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

if (isPrimaryInstance) {
  const { initScheduler } = require('./helpers/scheduler');
  initScheduler();
} else {
  console.log(`[Cron/Startup] Skipping on secondary instance (${process.env.NODE_APP_INSTANCE}).`);
}

const server = app.listen(port, () => {
  console.log(`app running on port ${port}`);
});

// Graceful shutdown — drains in-flight requests before PM2 kills the process
const gracefulShutdown = async (signal) => {
  console.log(`[Shutdown] ${signal} received — draining connections...`);
  server.close(async () => {
    try { await pool.end(); } catch (_) {}
    try { if (redisClient && redisClient.isOpen) await redisClient.quit(); } catch (_) {}
    console.log('[Shutdown] Clean exit.');
    process.exit(0);
  });
  // Force-kill if shutdown takes longer than 25s
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout.');
    process.exit(1);
  }, 25000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// Memory usage monitor — only on primary instance, doesn't block process exit
if (isPrimaryInstance) {
  setInterval(() => {
    const mem = process.memoryUsage();
    console.log('[Memory]', {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB'
    });
  }, 300000).unref();
}
