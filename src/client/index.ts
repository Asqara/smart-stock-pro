import { AuditLogs } from "./audit-logs";
import { Auth } from "./auth";
import { Dashboard } from "./dashboard";
import { EmailNotifications } from "./email";
import { ErrorLogs } from "./error-logs";
import { Import } from "./import";
import { Inventory } from "./inventory";
import { JobTracking } from "./job-tracking";
import { Jobs } from "./jobs/enqueue";
import { Monitoring } from "./monitoring";
import { Notifications } from "./notifications";
import { Profile } from "./profile";
import { ProductMedia } from "./product-media";
import { Report } from "./report";
import { WarehouseSync } from "./sync";
import { Transfer } from "./transfer";
import { Users } from "./users";

/**
 * Business logic SDK entry point.
 *
 * Domain modules should be exposed as static class references from here.
 */
export class Client {
  static AuditLogs = AuditLogs;
  static Auth = Auth;
  static Dashboard = Dashboard;
  static EmailNotifications = EmailNotifications;
  static ErrorLogs = ErrorLogs;
  static Import = Import;
  static Inventory = Inventory;
  static JobTracking = JobTracking;
  static Jobs = Jobs;
  static Monitoring = Monitoring;
  static Notifications = Notifications;
  static Profile = Profile;
  static ProductMedia = ProductMedia;
  static Report = Report;
  static Transfer = Transfer;
  static Users = Users;
  static WarehouseSync = WarehouseSync;
}
