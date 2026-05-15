import express, { Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../middleware/index.js';
import morgan from "morgan"

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
};

export function createApp(container: AppContainer) {
  const app = express();

  const allowedOrigins = ["http://localhost:3000", "https://workhubmty-backend-production.up.railway.app/"];

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


  app.use('/api', router);

  app.use(errorHandler);

  return app;
}
