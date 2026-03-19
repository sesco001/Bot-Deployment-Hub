import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import walletRouter from "./wallet";
import botsRouter from "./bots";
import referralsRouter from "./referrals";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(walletRouter);
router.use(botsRouter);
router.use(referralsRouter);
router.use(adminRouter);

export default router;
