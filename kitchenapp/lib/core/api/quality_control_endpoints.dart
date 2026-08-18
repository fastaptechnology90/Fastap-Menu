class QualityControlEndpoints {

  const QualityControlEndpoints._();



  static const board = '/qc/board';

  static const randomAudit = '/qc/audit/random';

  static const complaints = '/qc/complaints';

  static String checkAction(String checkId) => '/qc/checks/$checkId/action';

  static String orderAction(String orderId) => '/qc/orders/$orderId/action';

}

