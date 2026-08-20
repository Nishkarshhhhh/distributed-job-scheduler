import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createJobSchema,
  updateJobSchema,
  jobIdParamSchema,
  listJobsQuerySchema,
} from "./jobs.validation";
import * as controller from "./jobs.controller";

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /api/jobs:
 *   post:
 *     tags: [Jobs]
 *     summary: Create a new job
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               type: { type: string, enum: [CRON, ONE_TIME] }
 *               cronExpression: { type: string, example: "*​/5 * * * *" }
 *               payload: { type: object }
 *               queueName: { type: string, default: default }
 *               retryLimit: { type: integer, default: 3 }
 *               backoffType: { type: string, enum: [FIXED, EXPONENTIAL] }
 *               backoffDelayMs: { type: integer, default: 5000 }
 *               timeoutMs: { type: integer, default: 60000 }
 *               runAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Job created }
 *   get:
 *     tags: [Jobs]
 *     summary: List jobs (own jobs, or all jobs for admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, PAUSED, DISABLED] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [CRON, ONE_TIME] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Paginated job list }
 */
router.post("/", validate(createJobSchema), controller.create);
router.get("/", validate(listJobsQuerySchema), controller.list);

/**
 * @openapi
 * /api/jobs/{id}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get a job by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job details }
 *       404: { description: Job not found }
 *   patch:
 *     tags: [Jobs]
 *     summary: Update a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job updated }
 *   delete:
 *     tags: [Jobs]
 *     summary: Delete a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Job deleted }
 */
router.get("/:id", validate(jobIdParamSchema), controller.getOne);
router.patch("/:id", validate(updateJobSchema), controller.update);
router.delete("/:id", validate(jobIdParamSchema), controller.remove);

/**
 * @openapi
 * /api/jobs/{id}/trigger:
 *   post:
 *     tags: [Jobs]
 *     summary: Manually trigger a job to run immediately
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       202: { description: Job enqueued }
 */
router.post("/:id/trigger", validate(jobIdParamSchema), controller.trigger);

/**
 * @openapi
 * /api/jobs/{id}/pause:
 *   post:
 *     tags: [Jobs]
 *     summary: Pause a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job paused }
 */
router.post("/:id/pause", validate(jobIdParamSchema), controller.pause);

/**
 * @openapi
 * /api/jobs/{id}/resume:
 *   post:
 *     tags: [Jobs]
 *     summary: Resume a paused job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job resumed }
 */
router.post("/:id/resume", validate(jobIdParamSchema), controller.resume);

/**
 * @openapi
 * /api/jobs/{id}/runs:
 *   get:
 *     tags: [Jobs]
 *     summary: Get run history for a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of job runs }
 */
router.get("/:id/runs", validate(jobIdParamSchema), controller.runs);

/**
 * @openapi
 * /api/jobs/{id}/cancel:
 *   post:
 *     tags: [Jobs]
 *     summary: Cancel the currently active run of a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Cancellation result }
 */
router.post("/:id/cancel", validate(jobIdParamSchema), controller.cancelRun);

export default router;