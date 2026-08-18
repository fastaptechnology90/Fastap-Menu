class ChefTaskEndpoints {
  const ChefTaskEndpoints._();

  static const board = '/chef-tasks/board';
  static const balance = '/chef-tasks/balance';
  static String taskAction(String taskId) => '/chef-tasks/$taskId/action';
}
