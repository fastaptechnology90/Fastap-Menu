import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/recipes/recipe_costing_snapshot.dart';

void main() {
  test('recipe costing snapshot parses API payload', () {
    final snapshot = RecipeCostingSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'recipes': [
        {
          'id': 'RCP-001',
          'name': 'Dal makhani · standard',
          'section': 'Main',
          'portionStandard': '250g bowl + 150g rice',
          'sellPrice': 420,
          'prepVideoUrl': 'sop://main/dal-makhani-prep',
          'ingredients': [
            {'name': 'Dal makhani base', 'quantity': '180g', 'cost': 62},
          ],
          'sopSteps': ['Temper dal base · 8 min'],
          'ingredientCost': 92,
          'plateCost': 92,
          'foodCostPercent': 21.9,
          'profitPerPlate': 328,
          'costFluctuation': 0,
          'wastePlates': 0,
          'wasteCost': 0,
        },
      ],
      'wasteLog': [],
      'stats': {
        'recipes': 1,
        'avgFoodCostPercent': 21.9,
        'highCostRecipes': 0,
        'wasteEvents': 0,
        'profitableRecipes': 1,
      },
      'recipeFeatures': {
        'standardRecipes': true,
        'ingredientQuantities': true,
        'portionStandards': true,
        'preparationVideos': true,
        'cookingSops': true,
        'ingredientCosting': true,
        'perPlateCosting': true,
        'wasteTracking': true,
        'profitAnalysis': true,
        'costFluctuationTracking': false,
      },
    });

    expect(snapshot.recipes.length, 1);
    expect(snapshot.recipes.first.plateCost, 92);
    expect(snapshot.recipeFeatures.cookingSops, isTrue);
    expect(snapshot.stats.profitableRecipes, 1);
  });
}
