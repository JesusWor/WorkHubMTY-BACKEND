import { z } from "zod";
import { ReservationCategorySchema, ReservationCategory } from "../../office-slots/office-slots.schema.js";

function normalizeCsvList(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap((item) => normalizeCsvList(item));
    if (typeof value !== "string") return [];
    return value.split(",").map((s) => s.trim()).filter(Boolean);
}

export const UserTimelineQuerySchema = z.object({
    from: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
    to: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD")
        .optional(),
    includeOfficeReservations: z
        .preprocess((v) => v === "true" || v === true, z.boolean())
        .default(true),
    officeCategories: z
        .preprocess(
            normalizeCsvList,
            z.array(ReservationCategorySchema).optional()
        )
        .optional(),
    includeParkingReservations: z
        .preprocess((v) => v === "true" || v === true, z.boolean())
        .default(true),
    includeEvents: z
        .preprocess((v) => v === "true" || v === true, z.boolean())
        .default(false),
    includeFriends: z
        .preprocess((v) => v === "true" || v === true, z.boolean())
        .default(false),
    includeEIds: z
        .preprocess(normalizeCsvList, z.array(z.string().min(1).max(8)).default([]))
        .default([]),
});

export type UserTimelineQuery = z.infer<typeof UserTimelineQuerySchema>;
export { ReservationCategory };
