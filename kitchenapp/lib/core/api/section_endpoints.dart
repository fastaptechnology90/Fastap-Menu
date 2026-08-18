class SectionEndpoints {
  const SectionEndpoints._();

  static const overview = '/sections/overview';
  static const routing = '/sections/routing';
  static const optimize = '/sections/optimize';
  static String reroute(String orderId) => '/sections/orders/$orderId/reroute';
  static String assignChef(String sectionId) =>
      '/sections/$sectionId/assign-chef';
}
