const createError = require("http-errors");
const Resource = require("../models/Resource");

async function listResources(_req, res, next) {
  try {
    const items = await Resource.find().sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function createResource(req, res, next) {
  try {
    const { name, type, capacity, metadata, isAvailable } = req.body;
    const resource = await Resource.create({ name, type, capacity, metadata, isAvailable });
    res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
}

async function getResource(req, res, next) {
  try {
    const resource = await Resource.findById(req.params.id).lean();
    if (!resource) throw createError(404, "Resource not found");
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
    res.json(resource);
  } catch (err) {
    next(err);
  }
}

async function deleteResource(req, res, next) {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) throw createError(404, "Resource not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listResources, createResource, getResource, updateResource, deleteResource };

