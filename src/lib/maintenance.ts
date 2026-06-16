export function isMaintenanceReadOnly() {
  return process.env.MAINTENANCE_READ_ONLY === "1";
}
