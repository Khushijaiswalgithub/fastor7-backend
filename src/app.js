import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import enquiryRoutes from './routes/enquiryRoutes.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  if (env.nodeEnv === 'development') app.use(morgan('dev'));

  // Landing route: a quick overview for anyone who opens the base URL in a browser.
  app.get('/', (_req, res) =>
    res.json({
      success: true,
      name: 'Fastor CRM API',
      docs: 'https://github.com/Khushijaiswalgithub/fastor7-backend#api',
      endpoints: {
        'POST /api/auth/register': 'Register an employee',
        'POST /api/auth/login': 'Log in, returns a JWT',
        'GET /api/auth/me': 'Logged-in employee (auth)',
        'POST /api/enquiries/public': 'Public enquiry form (no auth)',
        'GET /api/enquiries/public': 'Unclaimed leads (auth)',
        'PATCH /api/enquiries/:id/claim': 'Claim a lead (auth)',
        'GET /api/enquiries/private': 'Leads claimed by the logged-in employee (auth)',
      },
    })
  );
  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/enquiries', enquiryRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
