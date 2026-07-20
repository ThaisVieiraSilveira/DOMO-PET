import express from "express";
import { AuthenticatedRequest } from "./verifyIdToken";
import { TenantMemberService } from "../services/tenantMemberService";

export function requireTenantPermission(requiredPermission: string) {
  return async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const tenantId = (req.params?.tenantId || req.body?.tenantId || req.query?.tenantId) as string;
    if (!tenantId) {
      res.status(400).json({ error: "Missing tenantId" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const hasPerm = await TenantMemberService.hasPermission(tenantId, req.user.uid, requiredPermission);
      if (!hasPerm) {
        res.status(403).json({ error: "Forbidden: Insufficient permissions for this tenant" });
        return;
      }
      next();
    } catch (error) {
      res.status(500).json({ error: "Internal server error during permission check" });
    }
  };
}
