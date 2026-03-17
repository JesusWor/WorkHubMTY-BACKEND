import { Response } from "express";
import { ZodError } from "zod";

export class PaginationInfo {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;

  constructor(totalItems: number, currentPage: number, pageSize: number) {
    this.totalItems = totalItems;
    this.currentPage = currentPage;
    this.pageSize = pageSize;
    this.totalPages = Math.ceil(totalItems / pageSize);
    this.hasPrevious = currentPage > 1;
    this.hasNext = currentPage < this.totalPages;
  }
}

export class GlobalResponse {
  static ok(res: Response, message = "Operación exitosa") {
    return res.status(200).json({ success: true, message });
  }

  static okWithData<T>(res: Response, data: T, message = "Operación exitosa") {
    return res.status(200).json({ success: true, message, data });
  }

  static created<T>(res: Response, data: T, message = "Recurso creado exitosamente") {
    return res.status(201).json({ success: true, message, data });
  }

  static okPaginated<T>(
    res: Response,
    data: T,
    totalItems: number,
    currentPage: number,
    pageSize: number,
    message = "Datos obtenidos exitosamente"
  ) {
    const pagination = new PaginationInfo(totalItems, currentPage, pageSize);
    return res.status(200).json({ success: true, message, data, pagination });
  }

  static fail(res: Response, message: string, statusCode = 400) {
    return res.status(statusCode).json({ success: false, message });
  }

  static unauthorized(res: Response, message = "No autorizado") {
    return res.status(401).json({ success: false, message });
  }

  static forbidden(res: Response, message = "Permisos insuficientes") {
    return res.status(403).json({ success: false, message });
  }
  
  static notFound(res: Response, message = "Recurso no encontrado") {
    return res.status(404).json({ success: false, message });
  }

  static serverError(res: Response, message = "Error interno del servidor") {
    return res.status(500).json({ success: false, message });
  }

  static zodError(res: Response, error: ZodError) {
    const errors = error.issues.map((e) => ({
      field: e.path.map(String).join("."),
      message: e.message,
    }));
    return res.status(422).json({ success: false, message: "Validation failed", errors });
  }
}