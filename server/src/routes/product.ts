import { Router } from "express";
import {
  deleteProduct,
  deleteProductImage,
  getLatestProduct,
  getListings,
  getProductDetail,
  getProductsByCategory,
  listNewProduct,
  searchProducts,
  updateProduct,
} from "src/controllers/product";
import { isAuth } from "src/middleware/auth";
import fileParser from "src/middleware/fileParser";
import validate from "src/middleware/validator";
import { newProductSchema } from "src/utils/validationSchema";

const productRouter = Router();

productRouter.post(
  "/list",
  isAuth,
  fileParser,
  validate(newProductSchema),
  listNewProduct
);
productRouter.patch(
  "/:id",
  isAuth,
  fileParser,
  validate(newProductSchema),
  updateProduct
);
productRouter.delete("/:id", isAuth, deleteProduct);
productRouter.delete("/image/:productId/:imageId", isAuth, deleteProductImage);
productRouter.get("/detail/:id", isAuth, getProductDetail);
productRouter.get("/by-category/:category", isAuth, getProductsByCategory);
productRouter.get("/latest", getLatestProduct);
productRouter.get("/listings", isAuth, getListings);
productRouter.get("/search",isAuth, searchProducts);

export default productRouter;
