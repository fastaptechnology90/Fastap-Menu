class PanicEmergencyEndpoints {
  const PanicEmergencyEndpoints._();

  static const board = '/panic-emergency/board';
  static const triggerPanic = '/panic-emergency/trigger-panic';
  static const syncAll = '/panic-emergency/sync/all';

  static String incidentAction(String incidentId) =>
      '/panic-emergency/incidents/$incidentId/action';

  static String evacuationAction(String evacuationId) =>
      '/panic-emergency/evacuations/$evacuationId/action';
}
