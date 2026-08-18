import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { addSSEClient, getClientCount } from "../lib/sse";

const router: IRouter = Router();

router.get("/events", requireAuth, (req, res): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`event: connected\ndata: {"clients":${getClientCount() + 1}}\n\n`);

  const remove = addSSEClient(res, req.session.userId);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: {"ts":${Date.now()}}\n\n`);
    } catch {
      clearInterval(heartbeat);
      remove();
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    remove();
  });
});

export default router;
