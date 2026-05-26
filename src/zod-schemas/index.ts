import { Alerts } from "./alerts";
import { AuditLogs } from "./audit-logs";
import { Auth } from "./auth";
import { Inventory } from "./inventory";
import { Users } from "./users";

/**
 * Validation schema entry point.
 */
export class Schema {
  static Alerts = Alerts;
  static AuditLogs = AuditLogs;
  static Auth = Auth;
  static Inventory = Inventory;
  static Users = Users;
}
