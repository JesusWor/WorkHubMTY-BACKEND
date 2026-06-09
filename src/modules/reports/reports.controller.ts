import { Request, Response } from "express";
import { ReportsService } from "./reports.service.js";
import { ReportsQuerySchema, GlobalReportsQuerySchema } from "./reports.schema.js";
import { GlobalResponse } from "../../shared/response/globalresponse.js";
import ExcelJS from "exceljs";

export type ReportsController = {
    getAttendanceStats:       (req: Request, res: Response) => Promise<void>;
    getReservationStats:      (req: Request, res: Response) => Promise<void>;
    getGlobalAttendanceStats: (req: Request, res: Response) => Promise<void>;
    getGlobalReservationStats:(req: Request, res: Response) => Promise<void>;
    getTopUsersByAttendance:  (req: Request, res: Response) => Promise<void>;
    exportGlobalAttendance:   (req: Request, res: Response) => Promise<void>;
};

export function makeReportsController(service: ReportsService): ReportsController {

    const getAttendanceStats = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReportsQuerySchema.safeParse({
            userId: req.params.userId,
            period: req.query.period,
            from:   req.query.from,
            to:     req.query.to,
        });
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }
        const { userId, period, from, to } = parsed.data;
        const result = await service.getAttendanceStats(userId, period, from, to);
        GlobalResponse.okWithData(res, result);
    };

    const getReservationStats = async (req: Request, res: Response): Promise<void> => {
        const parsed = ReportsQuerySchema.safeParse({
            userId: req.params.userId,
            period: req.query.period,
            from:   req.query.from,
            to:     req.query.to,
        });
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }
        const { userId, period, from, to } = parsed.data;
        const result = await service.getReservationStats(userId, period, from, to);
        GlobalResponse.okWithData(res, result);
    };

    const getGlobalAttendanceStats = async (req: Request, res: Response): Promise<void> => {
        const parsed = GlobalReportsQuerySchema.safeParse({
            period: req.query.period,
            from:   req.query.from,
            to:     req.query.to,
        });
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }
        const { period, from, to } = parsed.data;
        const result = await service.getGlobalAttendanceStats(period, from, to);
        GlobalResponse.okWithData(res, result);
    };

    const getGlobalReservationStats = async (req: Request, res: Response): Promise<void> => {
        const parsed = GlobalReportsQuerySchema.safeParse({
            period: req.query.period,
            from:   req.query.from,
            to:     req.query.to,
        });
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }
        const { period, from, to } = parsed.data;
        const result = await service.getGlobalReservationStats(period, from, to);
        GlobalResponse.okWithData(res, result);
    };

    const getTopUsersByAttendance = async (req: Request, res: Response): Promise<void> => {
        const parsed = GlobalReportsQuerySchema.safeParse({
            period: req.query.period,
            from:   req.query.from,
            to:     req.query.to,
        });
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }
        const limit = req.query.limit ? Number(req.query.limit) : 10;
        if (isNaN(limit) || limit < 1 || limit > 100) {
            GlobalResponse.badRequest(res, "limit must be a number between 1 and 100");
            return;
        }
        const { period, from, to } = parsed.data;
        const result = await service.getTopUsersByAttendance(period, from, to, limit);
        GlobalResponse.okWithData(res, result);
    };

    /*
        GET /stats/global/export?period=week&from=YYYY-MM-DD&to=YYYY-MM-DD
        Descarga un archivo .xlsx con todas las estadísticas de asistencia globales.
    */
    const exportGlobalAttendance = async (req: Request, res: Response): Promise<void> => {
        const parsed = GlobalReportsQuerySchema.safeParse({
            period: req.query.period,
            from:   req.query.from,
            to:     req.query.to,
        });
        if (!parsed.success) {
            GlobalResponse.badRequest(res, parsed.error.issues.map((i) => i.message).join(", "));
            return;
        }

        const { period, from, to } = parsed.data;
        const rows = await service.getGlobalAttendanceExport(period, from, to);

        const workbook  = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Estadísticas de asistencia");

        // Columnas
        worksheet.columns = [
            { header: "ID Usuario",        key: "ID Usuario",        width: 14 },
            { header: "Nombre",            key: "Nombre",            width: 28 },
            { header: "Periodo",           key: "Periodo",           width: 14 },
            { header: "Total",             key: "Total",             width: 10 },
            { header: "Asistencias",       key: "Asistencias",       width: 14 },
            { header: "Faltas",            key: "Faltas",            width: 10 },
            { header: "Canceladas",        key: "Canceladas",        width: 14 },
            { header: "Pendientes",        key: "Pendientes",        width: 14 },
            { header: "Tasa asistencia %", key: "Tasa asistencia %", width: 18 },
        ];

        // Estilo de encabezado
        worksheet.getRow(1).eachCell((cell) => {
            cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        // Datos
        rows.forEach((row) => worksheet.addRow(row));

        // Alternar colores de filas
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const fill = rowNumber % 2 === 0
                ? { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8F7FF" } }
                : { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
            row.eachCell((cell) => { cell.fill = fill; });
        });

        const filename = `estadisticas_${period}_${from}_${to}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();
    };

    return {
        getAttendanceStats,
        getReservationStats,
        getGlobalAttendanceStats,
        getGlobalReservationStats,
        getTopUsersByAttendance,
        exportGlobalAttendance,
    };
}