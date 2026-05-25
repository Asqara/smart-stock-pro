import { Admin } from "./admin";
import { ApiKey } from "./api-key";
import { Auth } from "./auth";
import { Merchant } from "./merchant";
import { Order } from "./order";
import { Payment } from "./payment";
import { Product } from "./product";
import { Upload } from "./upload";
import { Webhook } from "./webhook";

/**
 * Validation schemas grouped by domain. Sub-domain schemas attach as
 * `static` references on this class.
 */
export class Schema {
  static Admin = Admin;
  static ApiKey = ApiKey;
  static Auth = Auth;
  static Merchant = Merchant;
  static Order = Order;
  static Payment = Payment;
  static Product = Product;
  static Upload = Upload;
  static Webhook = Webhook;
}

export * from "./admin";
export * from "./api-key";
export * from "./auth";
export * from "./merchant";
export * from "./order";
export * from "./payment";
export * from "./product";
export * from "./upload";
export * from "./webhook";
