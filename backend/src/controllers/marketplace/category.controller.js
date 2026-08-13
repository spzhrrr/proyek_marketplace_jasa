import categoryModel from "../../models/marketplace/categoryModel.js";
import { getErrorMessage } from "../../utils/errorMessage.js";

async function categories(req, res) {
  try {
    const data = await categoryModel.getCategoryTree();
    res.json({ ok: true, roots: data.roots, tree: data.tree });
  } catch (error) {
    res.status(500).json({ ok: false, error: getErrorMessage(error) });
  }
}

export default {
  categories,
};
