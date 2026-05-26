import { Categories } from "./categories";
import { Products } from "./products";
import { Stock } from "./stock";
import { Suppliers } from "./suppliers";
import { Warehouses } from "./warehouses";

/**
 * Inventory business logic module.
 */
export class Inventory {
  static Categories = Categories;
  static Products = Products;
  static Stock = Stock;
  static Suppliers = Suppliers;
  static Warehouses = Warehouses;
}
