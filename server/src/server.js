import app from './app.js';
import { ENV } from './config/env.js';
import { connectDB } from './config/db.js';

const startServer = async () => {
  // Connect to Database
  await connectDB();

  // Listen on configured PORT
  const server = app.listen(ENV.PORT, () => {
    console.log(`===============================================`);
    console.log(` Digital Legacy Vault Server running on port ${ENV.PORT}`);
    console.log(` Environment: ${ENV.NODE_ENV}`);
    console.log(` Health check: http://localhost:${ENV.PORT}/api/health`);
    console.log(`===============================================`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n[Server] Gracefully shutting down...');
    server.close(() => {
      console.log('[Server] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer();
