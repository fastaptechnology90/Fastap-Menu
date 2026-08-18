class BarBeverageEndpoints {

  const BarBeverageEndpoints._();



  static const board = '/bar/board';

  static const balanceQueue = '/bar/balance-queue';

  static String drinkAction(String drinkId) => '/bar/drinks/$drinkId/action';

}

