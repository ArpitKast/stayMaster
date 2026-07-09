const asyncHandler = require("express-async-handler");
const BlogTag = require("../models/blogTagModel");
const BlogTagModel = new BlogTag();
const Response = require("../helpers/responseHelper");

const getTags = asyncHandler(async (req, res) => {
  try {
    const tags = await BlogTagModel.getAll();
    return Response.success(res, tags, 200);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to fetch tags: " + error.message, 500);
  }
});

const createTag = asyncHandler(async (req, res) => {
  const { name, slug, active } = req.body;
  if (!name || !slug) {
    return Response.error(res, "ERROR", "Name and slug are required.", 400);
  }
  try {
    const tagId = await BlogTagModel.create({ name, slug, active: active !== undefined ? active : 1 });
    const tag = await BlogTagModel.getById(tagId);
    return Response.success(res, tag, 201);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to create tag: " + error.message, 500);
  }
});

const updateTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, slug, active } = req.body;
  try {
    const existing = await BlogTagModel.getById(id);
    if (!existing) {
      return Response.error(res, "ERROR", "Tag not found.", 404);
    }
    await BlogTagModel.update(id, { name, slug, active });
    const updated = await BlogTagModel.getById(id);
    return Response.success(res, updated, 200);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to update tag: " + error.message, 500);
  }
});

const deleteTag = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await BlogTagModel.getById(id);
    if (!existing) {
      return Response.error(res, "ERROR", "Tag not found.", 404);
    }
    await BlogTagModel.delete({ id });
    return Response.success(res, { message: "Tag deleted successfully." }, 200);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to delete tag: " + error.message, 500);
  }
});

module.exports = { getTags, createTag, updateTag, deleteTag };
