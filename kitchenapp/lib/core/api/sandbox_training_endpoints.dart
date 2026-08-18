class SandboxTrainingEndpoints {
  const SandboxTrainingEndpoints._();

  static const board = '/sandbox-training/board';
  static const launchAll = '/sandbox-training/launch-all';

  static String demoKitchenAction(String demoId) =>
      '/sandbox-training/demo/$demoId/action';

  static String practiceSessionAction(String sessionId) =>
      '/sandbox-training/practice/$sessionId/action';

  static String sopTrainingAction(String sopId) =>
      '/sandbox-training/sop/$sopId/action';

  static String simulationAction(String simulationId) =>
      '/sandbox-training/simulations/$simulationId/action';
}
