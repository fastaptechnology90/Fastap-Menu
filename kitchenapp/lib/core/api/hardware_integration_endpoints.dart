class HardwareIntegrationEndpoints {
  const HardwareIntegrationEndpoints._();

  static const board = '/hardware-integration/board';
  static const syncAll = '/hardware-integration/sync-all';

  static String displayAction(String displayId) =>
      '/hardware-integration/displays/$displayId/action';

  static String tabletAction(String tabletId) =>
      '/hardware-integration/tablets/$tabletId/action';

  static String printerAction(String printerId) =>
      '/hardware-integration/printers/$printerId/action';

  static String smartwatchAction(String watchId) =>
      '/hardware-integration/smartwatches/$watchId/action';

  static String nfcAction(String nfcId) =>
      '/hardware-integration/nfc/$nfcId/action';

  static String scannerAction(String scannerId) =>
      '/hardware-integration/scanners/$scannerId/action';
}
