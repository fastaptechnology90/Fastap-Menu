class SmartEnergyEndpoints {
  const SmartEnergyEndpoints._();

  static const board = '/energy/board';
  static const triggerShutdown = '/energy/shutdown/trigger';

  static String alertAction(String alertId) => '/energy/alerts/$alertId/action';
}
