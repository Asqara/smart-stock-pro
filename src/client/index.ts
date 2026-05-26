import { AuditLogs } from "./audit-logs";
import { Auth } from "./auth";
import { EmailNotifications } from "./email";
import { ErrorLogs } from "./error-logs";
import { Inventory } from "./inventory";
import { Jobs } from "./jobs/enqueue";
import { Monitoring } from "./monitoring";
import { Notifications } from "./notifications";
import { Users } from "./users";

/**
 * Business logic SDK entry point.
 *
 * Domain modules should be exposed as static class references from here.
 */
export class Client {
  static AuditLogs = AuditLogs;
  static Auth = Auth;
  static EmailNotifications = EmailNotifications;
  static ErrorLogs = ErrorLogs;
  static Inventory = Inventory;
  static Jobs = Jobs;
  static Monitoring = Monitoring;
  static Notifications = Notifications;
  static Users = Users;
}
