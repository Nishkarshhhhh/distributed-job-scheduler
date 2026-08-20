import { Router } from "express";
import { register, login, me } from "./auth.controller";
import { validate } from "../../middleware/validate.middleware";
import { authenticate } from "../../middleware/auth.middleware";
import { registerSchema, loginSchema } from "./auth.validation";

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       201: { description: User registered successfully }
 *       409: { description: Email already in use }
 */
router.post("/register", validate(registerSchema), register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post("/login", validate(loginSchema), login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the currently authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Current user profile }
 *       401: { description: Unauthorized }
 */
router.get("/me", authenticate, me);

export default router;