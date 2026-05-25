import { Admin } from "./admin";
import { ApiKey } from "./api-key";
import { Auth } from "./auth";
import { Merchant } from "./merchant";
import { Order } from "./order";
import { Payment } from "./payment";
import { Product } from "./product";
import { Transaction } from "./transaction";
import { Upload } from "./upload";
import { Webhook } from "./webhook";

/**
 * Business logic SDK entry point.
 *
 * @example
 *   import { Client } from "@/client";
 *   await Client.Auth.login({ email, password });
 *   await Client.Merchant.list();
 */
export class Client {
  static Admin = Admin;
  static ApiKey = ApiKey;
  static Auth = Auth;
  static Merchant = Merchant;
  static Order = Order;
  static Payment = Payment;
  static Product = Product;
  static Transaction = Transaction;
  static Upload = Upload;
  static Webhook = Webhook;
}
