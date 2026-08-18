class CustomerReturnEndpoints {

  const CustomerReturnEndpoints._();



  static const board = '/returns/board';

  static const create = '/returns/create';

  static String action(String returnId) => '/returns/$returnId/action';

}

