import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/errors.js";
import { optionalString, projectStatus, requireString } from "../lib/validation.js";
import { projectResponse } from "../lib/serializers.js";

export function createProjectsController({ projects }) { return {
  list: asyncHandler(async (req, res) => { const result = await projects.listForUser(req.auth.sub, { page: req.query.page, limit: req.query.limit }); res.json({ data: result.items.map(projectResponse), meta: { page: result.page, limit: result.limit, total: result.total } }); }),
  create: asyncHandler(async (req, res) => { const project = await projects.createProject({ ownerId: req.auth.sub, name: requireString(req.body.name, "name", { min: 2, max: 120 }), description: optionalString(req.body.description ?? "", "description", { min: 0, max: 2000 }) || "", status: req.body.status === undefined ? "planned" : projectStatus(req.body.status) }); res.status(201).json({ data: projectResponse(project) }); }),
  getById: asyncHandler(async (req, res) => { const project = await projects.findOwnedById(req.params.projectId, req.auth.sub); if (!project) throw notFound("Project"); res.json({ data: projectResponse(project) }); }),
  update: asyncHandler(async (req, res) => { const changes = {}; if (req.body.name !== undefined) changes.name = requireString(req.body.name, "name", { min: 2, max: 120 }); if (req.body.description !== undefined) changes.description = optionalString(req.body.description, "description", { min: 0, max: 2000 }); if (req.body.status !== undefined) changes.status = projectStatus(req.body.status); if (Object.keys(changes).length === 0) throw badRequest("Provide at least one editable project field"); const project = await projects.updateOwnedById(req.params.projectId, req.auth.sub, changes); if (!project) throw notFound("Project"); res.json({ data: projectResponse(project) }); }),
  remove: asyncHandler(async (req, res) => { if (!(await projects.deleteOwnedById(req.params.projectId, req.auth.sub))) throw notFound("Project"); res.status(204).send(); }),
}; }
