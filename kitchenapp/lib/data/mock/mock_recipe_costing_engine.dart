import 'mock_section_registry.dart';

class MockRecipeCostingRegistry {
  MockRecipeCostingRegistry._();

  static final List<Map<String, dynamic>> _recipes = _seedRecipes();
  static final List<Map<String, dynamic>> _wasteLog = <Map<String, dynamic>>[];

  static List<Map<String, dynamic>> recipesFor(String section) {
    if (section == 'All') {
      return _recipes.map(_cloneRecipe).toList();
    }
    return _recipes
        .where((recipe) => recipe['section'] == section)
        .map(_cloneRecipe)
        .toList();
  }

  static Map<String, dynamic>? findById(String recipeId) {
    for (final recipe in _recipes) {
      if (recipe['id'] == recipeId) {
        return recipe;
      }
    }
    return null;
  }

  static Map<String, dynamic> refreshCosting() {
    for (final recipe in _recipes) {
      _recalculate(recipe);
      recipe['lastCostRefreshAt'] = DateTime.now().toIso8601String();
    }
    return {
      'success': true,
      'message': 'Cost fluctuation tracking updated · all recipe costs refreshed',
    };
  }

  static Map<String, dynamic> recordWaste({
    required String recipeId,
    required double plates,
    required String reason,
  }) {
    final recipe = findById(recipeId);
    if (recipe == null) {
      throw ArgumentError('Recipe not found');
    }

    final wasteCost = (recipe['plateCost'] as num).toDouble() * plates;
    recipe['wastePlates'] = (recipe['wastePlates'] as num).toDouble() + plates;
    recipe['wasteCost'] = (recipe['wasteCost'] as num).toDouble() + wasteCost;
    _recalculate(recipe);

    _wasteLog.insert(0, {
      'id': 'WST-${DateTime.now().millisecondsSinceEpoch}',
      'recipeId': recipeId,
      'recipeName': recipe['name'],
      'plates': plates,
      'cost': wasteCost,
      'reason': reason,
      'recordedAt': DateTime.now().toIso8601String(),
    });

    return {
      'success': true,
      'message':
          'Waste tracked · ${recipe['name']} · ${plates.toStringAsFixed(1)} plates',
    };
  }

  static Map<String, dynamic> adjustPortion({
    required String recipeId,
    required String portion,
  }) {
    final recipe = findById(recipeId);
    if (recipe == null) {
      throw ArgumentError('Recipe not found');
    }

    recipe['portionStandard'] = portion;
    _recalculate(recipe);

    return {
      'success': true,
      'message': 'Portion standard updated · $portion',
    };
  }

  static List<Map<String, dynamic>> recentWaste({int limit = 5}) {
    return _wasteLog.take(limit).map(Map<String, dynamic>.from).toList();
  }

  static void _recalculate(Map<String, dynamic> recipe) {
    final ingredients = recipe['ingredients'] as List<dynamic>;
    var ingredientCost = 0.0;
    for (final item in ingredients) {
      ingredientCost += (item['cost'] as num).toDouble();
    }

    final wasteCost = (recipe['wasteCost'] as num?)?.toDouble() ?? 0;
    final plateCost = ingredientCost;
    final sellPrice = (recipe['sellPrice'] as num).toDouble();
    final foodCostPercent = sellPrice == 0 ? 0 : (plateCost / sellPrice) * 100;
    final profit = sellPrice - plateCost - wasteCost * 0.1;
    final fluctuation = (recipe['previousPlateCost'] as num?)?.toDouble() ?? plateCost;
    final delta = plateCost - fluctuation;

    recipe['ingredientCost'] = ingredientCost;
    recipe['plateCost'] = plateCost;
    recipe['foodCostPercent'] = foodCostPercent;
    recipe['profitPerPlate'] = profit;
    recipe['costFluctuation'] = delta;
    recipe['previousPlateCost'] = plateCost;
  }

  static Map<String, dynamic> _cloneRecipe(Map<String, dynamic> recipe) {
    return {
      ...recipe,
      'ingredients': (recipe['ingredients'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
      'sopSteps': (recipe['sopSteps'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    };
  }

  static List<Map<String, dynamic>> _seedRecipes() {
    final recipes = [
      _recipe(
        id: 'RCP-001',
        name: 'Dal makhani · standard',
        section: 'Main',
        portionStandard: '250g bowl + 150g rice',
        sellPrice: 420,
        prepVideoUrl: 'sop://main/dal-makhani-prep',
        ingredients: [
          _ingredient('Dal makhani base', '180g', 62),
          _ingredient('Steamed rice', '150g', 18),
          _ingredient('Butter finish', '15g', 12),
        ],
        sopSteps: [
          'Temper dal base · 8 min',
          'Simmer with butter finish',
          'Portion 250g · QC temperature 74°C',
        ],
      ),
      _recipe(
        id: 'RCP-002',
        name: 'Butter naan · tandoor',
        section: 'Tandoor',
        portionStandard: '1 naan · 90g dough',
        sellPrice: 65,
        prepVideoUrl: 'sop://tandoor/naan-batch',
        ingredients: [
          _ingredient('Naan dough', '90g', 14),
          _ingredient('Butter brush', '8g', 6),
        ],
        sopSteps: [
          'Proof dough batch',
          'Slap tandoor · 90 sec',
          'Butter brush · serve hot',
        ],
      ),
      _recipe(
        id: 'RCP-003',
        name: 'Hakka noodles · express',
        section: 'Chinese',
        portionStandard: '320g wok portion',
        sellPrice: 280,
        prepVideoUrl: 'sop://chinese/hakka-noodles',
        ingredients: [
          _ingredient('Noodle packs', '180g', 32),
          _ingredient('Vegetable mix', '90g', 22),
          _ingredient('Sauce base', '50g', 18),
        ],
        sopSteps: [
          'Blanch noodles · 90 sec',
          'High-heat wok toss',
          'Finish with sauce · 320g portion',
        ],
      ),
      _recipe(
        id: 'RCP-004',
        name: 'Caesar salad · family',
        section: 'Salad',
        portionStandard: '220g plated salad',
        sellPrice: 320,
        prepVideoUrl: 'sop://salad/caesar-plating',
        ingredients: [
          _ingredient('Romaine mix', '140g', 28),
          _ingredient('Fresh basil', '8g', 16),
          _ingredient('Dressing', '45g', 14),
        ],
        sopSteps: [
          'Chill plate · 5 min',
          'Toss greens with dressing',
          'Garnish · allergy check if requested',
        ],
      ),
      _recipe(
        id: 'RCP-005',
        name: 'Gulab jamun · banquet',
        section: 'Dessert',
        portionStandard: '2 pcs · 80g',
        sellPrice: 180,
        prepVideoUrl: 'sop://dessert/gulab-jamun-batch',
        ingredients: [
          _ingredient('Gulab jamun mix', '60g', 24),
          _ingredient('Sugar syrup', '40ml', 10),
        ],
        sopSteps: [
          'Warm syrup batch',
          'Soak jamun · 12 min',
          'Batch service · 40 covers',
        ],
      ),
    ];

    for (final recipe in recipes) {
      recipe['wastePlates'] = 0.0;
      recipe['wasteCost'] = 0.0;
      _recalculate(recipe);
    }

    return recipes;
  }

  static Map<String, dynamic> _recipe({
    required String id,
    required String name,
    required String section,
    required String portionStandard,
    required num sellPrice,
    required String prepVideoUrl,
    required List<Map<String, dynamic>> ingredients,
    required List<String> sopSteps,
  }) {
    return {
      'id': id,
      'name': name,
      'section': section,
      'portionStandard': portionStandard,
      'sellPrice': sellPrice,
      'prepVideoUrl': prepVideoUrl,
      'ingredients': ingredients,
      'sopSteps': sopSteps,
      'lastCostRefreshAt': DateTime.now().toIso8601String(),
    };
  }

  static Map<String, dynamic> _ingredient(
    String name,
    String quantity,
    num cost,
  ) {
    return {
      'name': name,
      'quantity': quantity,
      'cost': cost,
    };
  }
}

class MockRecipeCostingEngine {
  const MockRecipeCostingEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final recipes = MockRecipeCostingRegistry.recipesFor(section);
    final wasteLog = MockRecipeCostingRegistry.recentWaste();
    final avgFoodCost = recipes.isEmpty
        ? 0.0
        : recipes
                .map((r) => (r['foodCostPercent'] as num).toDouble())
                .reduce((a, b) => a + b) /
            recipes.length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'recipes': recipes,
      'wasteLog': wasteLog,
      'stats': {
        'recipes': recipes.length,
        'avgFoodCostPercent': avgFoodCost,
        'highCostRecipes': recipes
            .where((r) => (r['foodCostPercent'] as num) > 32)
            .length,
        'wasteEvents': wasteLog.length,
        'profitableRecipes': recipes
            .where((r) => (r['profitPerPlate'] as num) > 0)
            .length,
      },
      'recipeFeatures': {
        'standardRecipes': recipes.isNotEmpty,
        'ingredientQuantities': true,
        'portionStandards': true,
        'preparationVideos': recipes.any((r) => r['prepVideoUrl'] != null),
        'cookingSops': recipes.any(
          (r) => (r['sopSteps'] as List).isNotEmpty,
        ),
        'ingredientCosting': true,
        'perPlateCosting': true,
        'wasteTracking': wasteLog.isNotEmpty || recipes.isNotEmpty,
        'profitAnalysis': true,
        'costFluctuationTracking': recipes.any(
          (r) => (r['costFluctuation'] as num).abs() > 0,
        ),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
