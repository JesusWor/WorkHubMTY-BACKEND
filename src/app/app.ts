import express, { Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../middleware/index.js';
import morgan from "morgan";

export type AppContainer = {
  authRouter: Router;
  roleRouter: Router;
  userRouter: Router;
  notificationRouter: Router;
  friendshipRouter: Router;
  officeSlotsRouter: Router;
  reservablesRouter: Router;
  reservationsRouter: Router;
  eventsRouter: Router;
  workGroupsRouter: Router;
  parkingSlotsRouter: Router;
  achievementsRouter: Router;
  reportsRouter: Router;
};

export function createApp(container: AppContainer) {
  const app = express();

  // const allowedOrigins = [
  //   "http://localhost:3000",
  //   "https://costra.dev",
  //   "https://www.costra.dev",
  //   "https://kaleidoscopic-pony-6861ef.netlify.app",
  //   "https://work-hub-mty-frontend.vercel.app",
  // ];
  const allowedOrigins = [
    "http://localhost:3000",
    "https://costra.dev",
    "https://www.costra.dev",
  ];

  app.use(cors({
    origin: ( origin, callback ) => {
      if ( !origin || allowedOrigins.includes(origin) ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(morgan("combined"))

  const router = Router();

  router.use('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.use('/users', container.userRouter);
  router.use('/notifications', container.notificationRouter);
  router.use('/roles', container.roleRouter);
  router.use('/auth', container.authRouter);
  router.use('/friendships', container.friendshipRouter);
  router.use('/achievements', container.achievementsRouter);

  router.use('/reservations', container.officeSlotsRouter);
  router.use('/reservations/reservables', container.reservablesRouter);
  router.use('/reservations/reservations', container.reservationsRouter);
  router.use('/reservations/events', container.eventsRouter);
  router.use('/reservations/work-groups', container.workGroupsRouter);
  router.use('/parking', container.parkingSlotsRouter);
  router.use('/reports', container.reportsRouter);


  app.use('/api', router);

  app.use(errorHandler);

  return app;
}
