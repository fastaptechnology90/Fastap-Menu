class AuditComplianceEndpoints {
  const AuditComplianceEndpoints._();

  static const board = '/audit-compliance/board';
  static const exportAll = '/audit-compliance/export-all';

  static String actionLogAction(String logId) =>
      '/audit-compliance/actions/$logId/action';

  static String foodSafetyLogAction(String logId) =>
      '/audit-compliance/food-safety/$logId/action';

  static String hygieneLogAction(String logId) =>
      '/audit-compliance/hygiene/$logId/action';

  static String staffActivityLogAction(String logId) =>
      '/audit-compliance/staff/$logId/action';

  static String incidentLogAction(String incidentId) =>
      '/audit-compliance/incidents/$incidentId/action';
}
