import { Alerts } from "./alerts";
import { AuditLogs } from "./audit-logs";
import { Auth } from "./auth";
import { Dashboard } from "./dashboard";
import { Import } from "./import";
import { Inventory } from "./inventory";
import { Jobs } from "./jobs";
import { Profile } from "./profile";
import { Report } from "./report";
import { Transfer } from "./transfer";
import { Users } from "./users";

/**
 * Validation schema entry point.
 */
export class Schema {
  static Alerts = Alerts;
  static AuditLogs = AuditLogs;
  static Auth = Auth;
  static Dashboard = Dashboard;
  static Import = Import;
  static Inventory = Inventory;
  static Jobs = Jobs;
  static Profile = Profile;
  static Report = Report;
  static Transfer = Transfer;
  static Users = Users;
}
