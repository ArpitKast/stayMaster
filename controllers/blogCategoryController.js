const asyncHandler = require("express-async-handler");
const BlogCategory = require("../models/blogCategoryModel");
const BlogCategoryModel = new BlogCategory();
const Response = require("../helpers/responseHelper");

const getCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await BlogCategoryModel.getAll();
    return Response.success(res, categories, 200);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to fetch categories: " + error.message, 500);
  }
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, active } = req.body;
  if (!name || !slug) {
    return Response.error(res, "ERROR", "Name and slug are required.", 400);
  }
  try {
    const categoryId = await BlogCategoryModel.create({ name, slug, active: active !== undefined ? active : 1 });
    const category = await BlogCategoryModel.getById(categoryId);
    return Response.success(res, category, 201);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to create category: " + error.message, 500);
  }
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, slug, active } = req.body;
  try {
    const existing = await BlogCategoryModel.getById(id);
    if (!existing) {
      return Response.error(res, "ERROR", "Category not found.", 404);
    }
    await BlogCategoryModel.update(id, { name, slug, active });
    const updated = await BlogCategoryModel.getById(id);
    return Response.success(res, updated, 200);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to update category: " + error.message, 500);
  }
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await BlogCategoryModel.getById(id);
    if (!existing) {
      return Response.error(res, "ERROR", "Category not found.", 404);
    }
    await BlogCategoryModel.delete({ id });
    return Response.success(res, { message: "Category deleted successfully." }, 200);
  } catch (error) {
    return Response.error(res, "ERROR", "Failed to delete category: " + error.message, 500);
  }
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
