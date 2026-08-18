class CourseFiringEndpoints {
  const CourseFiringEndpoints._();

  static const sessions = '/firing/sessions';
  static const syncPacing = '/firing/sync-pacing';
  static String sessionAction(String sessionId) =>
      '/firing/sessions/$sessionId/action';
}
