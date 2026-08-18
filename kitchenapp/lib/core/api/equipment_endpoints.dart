class EquipmentEndpoints {
  const EquipmentEndpoints._();

  static const board = '/equipment/board';
  static const raiseMaintenance = '/equipment/maintenance/raise';

  static String assetAction(String assetId) => '/equipment/assets/$assetId/action';
}
