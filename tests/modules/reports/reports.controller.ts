import { Request, Response } from "express";
import { ReportsService } from "./reports.service.js";
import { ReportsQuerySchema } from "./reports.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";

export type ReportsController = {
    getAttendanceStats: (req: Request, res: Response) => Promise<void>;
    getReservationStats: (req: Request, res: Response) => Promise<void>;
};

export function makeReportsController(service: ReportsService): ReportsController {

    /*
        GET /stats/:userId/attendance?period=day|week|month&from=YYYY-MM-DD&to=YYYY-MM-DD
    */
    const getAttendanceStats = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReportsQuerySchema.safeParse({
            userId: req.params.userId,
            period: req.query.period,
            from: req.query.from,
            to: req.query.to,
        });

        if (!parsed.success) {
            GlobalResponse.badRequest(
                res,
                parsed.error.issues.map((i: { message: string }) => i.message).join(", ")
            );
            return;
        }

        const { userId, period, from, to } = parsed.data;
        const result = await service.getAttendanceStats(userId, period, from, to);
        GlobalResponse.okWithData(res, result);
    };

    /*
        GET /stats/:userId/reservations?period=day|week|month&from=YYYY-MM-DD&to=YYYY-MM-DD
    */
    const getReservationStats = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReportsQuerySchema.safeParse({
            userId: req.params.userId,
            period: req.query.period,
            from: req.query.from,
            to: req.query.to,
        });

        if (!parsed.success) {
            GlobalResponse.badRequest(
                res,
                parsed.error.issues.map((i: { message: string }) => i.message).join(", ")
            );
            return;
        }

        const { userId, period, from, to } = parsed.data;
        const result = await service.getReservationStats(userId, period, from, to);
        GlobalResponse.okWithData(res, result);
    };

    return {
        getAttendanceStats,
        getReservationStats,
    };
}