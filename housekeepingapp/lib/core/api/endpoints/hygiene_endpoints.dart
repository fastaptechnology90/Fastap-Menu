class HygieneEndpoints {
  const HygieneEndpoints._();

  static const board = '/hygiene/board';
  static const startAudit = '/hygiene/audit/start';

  static String taskAction(String taskId) => '/hygiene/tasks/$taskId/action';
}
