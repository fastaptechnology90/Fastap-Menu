class AllergySafetyEndpoints {
  const AllergySafetyEndpoints._();

  static const board = '/safety/board';
  static String caseAction(String caseId) => '/safety/cases/$caseId/action';
}
