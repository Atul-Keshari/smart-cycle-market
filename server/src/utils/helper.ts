import { Response } from "express";

export const sendErrorRes = (res: Response, message: string, statusCode:number)=>{
    return res.status(statusCode).json({ message });
}