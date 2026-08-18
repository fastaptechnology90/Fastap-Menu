class MultiBranchEndpoints {
  const MultiBranchEndpoints._();

  static const board = '/multi-branch/board';
  static const syncAll = '/multi-branch/sync-all';

  static String centralKitchenAction(String kitchenId) =>
      '/multi-branch/central/$kitchenId/action';

  static String recipeSyncAction(String syncId) =>
      '/multi-branch/recipes/$syncId/action';

  static String branchKitchenAction(String branchId) =>
      '/multi-branch/branches/$branchId/action';

  static String sharedInventoryAction(String inventoryId) =>
      '/multi-branch/inventory/$inventoryId/action';

  static String demandForecastAction(String forecastId) =>
      '/multi-branch/forecasts/$forecastId/action';
}
