import express, { Router } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../middleware';

export type AppContainer = {
  authRouter: Router;
  roleRouter: Router;
  userRouter: Router;
  notificationRouter: Router;
  friendshipRouter: Router;
  officeSlotsRouter: Router;
  parkingSlotsRouter: Router;
};

export function createApp(container: AppContainer) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());

  const router = Router();

  router.use('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.use('/users', container.userRouter);
  router.use('/notifications', container.notificationRouter);
  router.use('/roles', container.roleRouter);
  router.use('/auth', container.authRouter);
  router.use('/friendships', container.friendshipRouter);

  router.use('/reservations', container.officeSlotsRouter);
  router.use('/parking', container.parkingSlotsRouter);

  app.use('/api', router);
  app.use(errorHandler);

  return app;
}
