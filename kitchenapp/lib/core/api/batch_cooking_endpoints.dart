class BatchCookingEndpoints {
  const BatchCookingEndpoints._();

  static const board = '/batch/cooking';
  static const forecast = '/batch/cooking/forecast';
  static String action(String batchId) => '/batch/cooking/$batchId/action';
}
