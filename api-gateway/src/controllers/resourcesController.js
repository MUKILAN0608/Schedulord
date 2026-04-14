const createError = require("http-errors");
const Resource = require("../models/Resource");
const { cacheGet, cacheSet, cacheDel } = require("../config/redis");

async function listResources(_req, res, next) {
  try {
    // Try cache first
    const cached = await cacheGet("resources:all");
    if (cached) {
      return res.json({ items: cached, fromCache: true });
    }

    const items = await Resource.find().sort({ createdAt: -1 }).lean();

    // Cache for 30 seconds
    await cacheSet("resources:all", items, 30);

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function createResource(req, res, next) {
  try {
    const { name, type, capacity, metadata, isAvailable } = req.body;
    const resource = await Resource.create({ name, type, capacity, metadata, isAvailable });

    // Invalidate cache
    await cacheDel("resources:all");

    res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
}

async function getResource(req, res, next) {
  try {
    const cached = await cacheGet(`resource:${req.params.id}`);
    if (cached) {
      return res.json(cached);
    }

    const resource = await Resource.findById(req.params.id).lean();
    if (!resource) throw createError(404, "Resource not found");

    await cacheSet(`resource:${req.params.id}`, resource, 60);

    res.json(resource);
  } catch (err) {
    next(err);
  }
}

async function updateResource(req, res, next) {
  try {
    const resource = await Resource.findById(req.params.id);
    if (!resource) throw createError(404, "Resource not found");

    const { name, type, capacity, metadata, isAvailable } = req.body;
    if (name !== undefined) resource.name = name;
    if (type !== undefined) resource.type = type;
    if (capacity !== undefined) resource.capacity = capacity;
    if (metadata !== undefined) resource.metadata = metadata;
    if (typeof isAvailable === "boolean") resource.isAvailable = isAvailable;

    await resource.save();

    // Invalidate caches
    await cacheDel("resources:all");
    await cacheDel(`resource:${req.params.id}`);

    res.json(resource);
  } catch (err) {
    next(err);
  }
}

async function deleteResource(req, res, next) {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) throw createError(404, "Resource not found");

    await cacheDel("resources:all");
    await cacheDel(`resource:${req.params.id}`);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listResources, createResource, getResource, updateResource, deleteResource };
