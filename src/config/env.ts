import dotenv from 'dotenv';

import { smtpConfig } from './mail';
import { dbConfig } from './db';
import { authConfig } from './auth';

dotenv.config();
export const config = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    dbConfig,
    authConfig,
    smtpConfig
};