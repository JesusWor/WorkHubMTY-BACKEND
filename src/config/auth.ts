import dotenv from 'dotenv';
dotenv.config();

export const authConfig = {
    jwt_secret: process.env.JWT_SECRET,
}