import { Request, Response } from "express";
import { UserTimelineService } from "./user-timeline.service.js";
import { UserTimelineQuerySchema } from "./user-timeline.schema.js";
import { GlobalResponse } from "../../../shared/response/globalresponse.js";

export type UserTimelineController = {
    getTimeline: (req: Request, res: Response) => Promise<void>;
};

export function makeUserTimelineController(
    service: UserTimelineService
): UserTimelineController {

    const getTimeline = async (req: Request, res: Response): Promise<void> => {
        const caller = req.user;
        if (!caller) {
            GlobalResponse.unauthorized(res);
            return;
        }

        const parsed = UserTimelineQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            GlobalResponse.badRequest(
                res,
                parsed.error.issues.map((i) => i.message).join(", ")
            );
            return;
        }

        const eId = req.params.eId as string;
        const result = await service.getTimeline(eId, caller, parsed.data);
        GlobalResponse.okWithData(res, result);
    };

    return { getTimeline };
}
