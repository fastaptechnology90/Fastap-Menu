import { Router, type IRouter } from "express";

const router: IRouter = Router();

const healthHandler = (_req: any, res: any) => {
  res.json({ status: "ok" });
};

router.get("/healthz", healthHandler);
router.get("/health", healthHandler);

export default router;
