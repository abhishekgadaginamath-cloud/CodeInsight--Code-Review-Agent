import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import githubRouter from "./github";
import fixesRouter from "./fixes";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/reviews", reviewsRouter);
router.use("/reviews/:id/fixes", fixesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/github", githubRouter);

export default router;
