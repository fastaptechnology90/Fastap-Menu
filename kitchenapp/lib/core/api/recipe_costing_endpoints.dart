class RecipeCostingEndpoints {
  const RecipeCostingEndpoints._();

  static const board = '/recipes/costing';
  static const refresh = '/recipes/costing/refresh';
  static const waste = '/recipes/costing/waste';
  static String recipe(String recipeId) => '/recipes/$recipeId/costing';
}
