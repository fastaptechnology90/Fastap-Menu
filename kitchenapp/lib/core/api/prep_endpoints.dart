class PrepEndpoints {
  const PrepEndpoints._();

  static const board = '/prep/board';
  static String taskAction(String taskId) => '/prep/tasks/$taskId/action';
}
