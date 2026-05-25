## Access Management

SmartStock Pro uses role-based access control.

Each authenticated user has one role.  
Each role contains a set of permissions.  
Permissions control what the user can see and what actions the user can perform.

The MVP uses 4 main roles:

1. Admin
2. Warehouse Manager
3. Warehouse Staff
4. Viewer

The access model must be simple enough for MVP development, but still clear enough to support future scaling.

## Access Principles

**Least Privilege**  
Users only receive access required for their responsibility.

**Traceable Actions**  
Important actions must create audit logs, especially login, product changes, stock movement, transfer, import, export, and user management.

**No Direct Stock Editing**  
No role should directly edit stock quantity as a plain number.  
Stock changes must happen through stock-in, stock-out, adjustment, transfer, or import.

**Permission-Based UI**  
Menus and buttons must be shown or hidden based on user permission.

**Permission-Based API**  
Backend API must validate permission again.  
Frontend hiding is not enough for security.

**Read Access Is Different From Write Access**  
A user may be allowed to view data without being allowed to create, update, delete, export, or import it.

## Admin

Admin is responsible for system-wide control and operational supervision.

### Main Responsibilities

- Manage users.
- Manage roles and access.
- Manage all master data.
- Monitor system activity.
- Review audit logs.
- Review error logs.
- Monitor server and worker health.
- Run or review data import.
- Generate reports.
- Review stock and transfer activity.
- Handle system-level troubleshooting.

### Allowed Access

Admin can access:

- Dashboard
- Products
- Categories
- Suppliers
- Warehouses
- Stock Movements
- Stock In
- Stock Out
- Stock Adjustment
- Transfers
- Imports
- Reports
- Notifications
- Audit Logs
- Error Logs
- Monitoring
- Users
- Settings

### Allowed Actions

Admin can:

- Create, read, update, and delete product data.
- Create, read, update, and delete category data.
- Create, read, update, and delete supplier data.
- Create, read, update, and delete warehouse data.
- Create stock-in transactions.
- Create stock-out transactions.
- Create stock adjustment transactions.
- Create and complete warehouse transfers.
- Upload import files.
- Start import jobs.
- Generate PDF reports.
- View and manage notifications.
- View audit logs.
- View error logs.
- Mark error logs as resolved.
- View monitoring status.
- Manage users and roles.

### Restrictions

Admin should not:

- Directly edit stock quantity from the product table.
- Delete stock movement history.
- Delete audit logs.
- Delete completed transfer history.
- Modify generated historical reports.

### Reason

Admin needs broad access because this role is responsible for system operations, assessment demo, troubleshooting, and data supervision.

## Warehouse Manager

Warehouse Manager supervises inventory and warehouse operations.

### Main Responsibilities

- Monitor inventory condition.
- Manage product, category, supplier, and warehouse data.
- Review stock movement history.
- Handle warehouse transfers.
- Monitor low-stock alerts.
- Generate operational reports.
- Validate warehouse stock accuracy.

### Allowed Access

Warehouse Manager can access:

- Dashboard
- Products
- Categories
- Suppliers
- Warehouses
- Stock Movements
- Stock In
- Stock Out
- Stock Adjustment
- Transfers
- Imports
- Reports
- Notifications

### Limited Access

Warehouse Manager may access:

- Audit Logs, read-only and limited to inventory-related actions.
- Monitoring summary, read-only.

### Allowed Actions

Warehouse Manager can:

- Create, read, update product data.
- Create, read, update category data.
- Create, read, update supplier data.
- Create, read, update warehouse data.
- Create stock-in transactions.
- Create stock-out transactions.
- Create stock adjustment transactions.
- Create warehouse transfers.
- Complete warehouse transfers.
- View stock availability per warehouse.
- View FIFO batch information.
- View low-stock alerts.
- Generate inventory reports.
- Export reports to PDF.
- Import product or stock data if allowed by Admin.

### Restrictions

Warehouse Manager cannot:

- Manage users.
- Change role permissions.
- Delete audit logs.
- Delete error logs.
- Access full system settings.
- Access sensitive system configuration.
- Delete completed stock movement records.

### Reason

Warehouse Manager needs strong operational access, but should not control technical administration or user access.

## Warehouse Staff

Warehouse Staff handles daily warehouse transactions.

### Main Responsibilities

- Record incoming stock.
- Record outgoing stock.
- Request warehouse transfers.
- Check product and warehouse stock.
- Monitor operational notifications.
- Support stock accuracy in daily activities.

### Allowed Access

Warehouse Staff can access:

- Dashboard, limited view
- Products, read-only
- Warehouses, read-only
- Stock Movements
- Stock In
- Stock Out
- Transfers
- Notifications

### Allowed Actions

Warehouse Staff can:

- View product list.
- View product detail.
- View warehouse list.
- View warehouse stock.
- Create stock-in transactions.
- Create stock-out transactions.
- Create transfer requests.
- View transfer status.
- View stock movement history.
- View low-stock notifications.

### Restrictions

Warehouse Staff cannot:

- Create, update, or delete products.
- Create, update, or delete categories.
- Create, update, or delete suppliers.
- Create, update, or delete warehouses.
- Create stock adjustment unless explicitly allowed.
- Complete or approve transfer if approval flow is enabled.
- Import CSV or Excel files.
- Generate official PDF reports.
- Manage users.
- View audit logs.
- View error logs.
- Access monitoring.
- Access settings.

### Reason

Warehouse Staff should only handle daily operational input.  
This prevents accidental changes to master data, system configuration, and historical records.

## Viewer

Viewer is a read-only monitoring user.

### Main Responsibilities

- View dashboard summary.
- Monitor inventory condition.
- View product data.
- View warehouse stock.
- View reports.
- View stock movement history.

### Allowed Access

Viewer can access:

- Dashboard
- Products, read-only
- Warehouses, read-only
- Stock Movements, read-only
- Reports, read-only
- Notifications, read-only

### Allowed Actions

Viewer can:

- View dashboard cards.
- View inventory summary.
- View product list.
- View product detail.
- View warehouse list.
- View warehouse stock.
- View stock movement history.
- View generated reports.
- View low-stock notifications.

### Restrictions

Viewer cannot:

- Create data.
- Update data.
- Delete data.
- Import files.
- Export new reports.
- Create stock-in.
- Create stock-out.
- Create stock adjustment.
- Create transfer.
- Manage users.
- View audit logs.
- View error logs.
- Access monitoring.
- Access settings.

### Reason

Viewer is intended for management or observer users who need visibility without operational control.