class RecipeCostingSnapshot {
  const RecipeCostingSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.recipes,
    required this.wasteLog,
    required this.stats,
    required this.recipeFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<RecipeCostingItem> recipes;
  final List<WasteLogEntry> wasteLog;
  final RecipeCostingStats stats;
  final RecipeFeatureFlags recipeFeatures;
  final List<String> sections;

  factory RecipeCostingSnapshot.fromJson(Map<String, dynamic> json) {
    return RecipeCostingSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      recipes: (json['recipes'] as List<dynamic>)
          .map(
            (item) => RecipeCostingItem.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      wasteLog: (json['wasteLog'] as List<dynamic>)
          .map((item) => WasteLogEntry.fromJson(item as Map<String, dynamic>))
          .toList(),
      stats: RecipeCostingStats.fromJson(json['stats'] as Map<String, dynamic>),
      recipeFeatures: RecipeFeatureFlags.fromJson(
        json['recipeFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class RecipeCostingItem {
  const RecipeCostingItem({
    required this.id,
    required this.name,
    required this.section,
    required this.portionStandard,
    required this.sellPrice,
    required this.prepVideoUrl,
    required this.ingredients,
    required this.sopSteps,
    required this.ingredientCost,
    required this.plateCost,
    required this.foodCostPercent,
    required this.profitPerPlate,
    required this.costFluctuation,
    required this.wastePlates,
    required this.wasteCost,
  });

  final String id;
  final String name;
  final String section;
  final String portionStandard;
  final double sellPrice;
  final String prepVideoUrl;
  final List<RecipeIngredient> ingredients;
  final List<String> sopSteps;
  final double ingredientCost;
  final double plateCost;
  final double foodCostPercent;
  final double profitPerPlate;
  final double costFluctuation;
  final double wastePlates;
  final double wasteCost;

  factory RecipeCostingItem.fromJson(Map<String, dynamic> json) {
    return RecipeCostingItem(
      id: json['id'] as String,
      name: json['name'] as String,
      section: json['section'] as String,
      portionStandard: json['portionStandard'] as String,
      sellPrice: (json['sellPrice'] as num).toDouble(),
      prepVideoUrl: json['prepVideoUrl'] as String,
      ingredients: (json['ingredients'] as List<dynamic>)
          .map(
            (item) => RecipeIngredient.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      sopSteps: (json['sopSteps'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      ingredientCost: (json['ingredientCost'] as num).toDouble(),
      plateCost: (json['plateCost'] as num).toDouble(),
      foodCostPercent: (json['foodCostPercent'] as num).toDouble(),
      profitPerPlate: (json['profitPerPlate'] as num).toDouble(),
      costFluctuation: (json['costFluctuation'] as num?)?.toDouble() ?? 0,
      wastePlates: (json['wastePlates'] as num?)?.toDouble() ?? 0,
      wasteCost: (json['wasteCost'] as num?)?.toDouble() ?? 0,
    );
  }
}

class RecipeIngredient {
  const RecipeIngredient({
    required this.name,
    required this.quantity,
    required this.cost,
  });

  final String name;
  final String quantity;
  final double cost;

  factory RecipeIngredient.fromJson(Map<String, dynamic> json) {
    return RecipeIngredient(
      name: json['name'] as String,
      quantity: json['quantity'] as String,
      cost: (json['cost'] as num).toDouble(),
    );
  }
}

class WasteLogEntry {
  const WasteLogEntry({
    required this.id,
    required this.recipeId,
    required this.recipeName,
    required this.plates,
    required this.cost,
    required this.reason,
    required this.recordedAt,
  });

  final String id;
  final String recipeId;
  final String recipeName;
  final double plates;
  final double cost;
  final String reason;
  final DateTime recordedAt;

  factory WasteLogEntry.fromJson(Map<String, dynamic> json) {
    return WasteLogEntry(
      id: json['id'] as String,
      recipeId: json['recipeId'] as String,
      recipeName: json['recipeName'] as String,
      plates: (json['plates'] as num).toDouble(),
      cost: (json['cost'] as num).toDouble(),
      reason: json['reason'] as String,
      recordedAt: DateTime.parse(json['recordedAt'] as String),
    );
  }
}

class RecipeCostingStats {
  const RecipeCostingStats({
    required this.recipes,
    required this.avgFoodCostPercent,
    required this.highCostRecipes,
    required this.wasteEvents,
    required this.profitableRecipes,
  });

  final int recipes;
  final double avgFoodCostPercent;
  final int highCostRecipes;
  final int wasteEvents;
  final int profitableRecipes;

  factory RecipeCostingStats.fromJson(Map<String, dynamic> json) {
    return RecipeCostingStats(
      recipes: json['recipes'] as int? ?? 0,
      avgFoodCostPercent:
          (json['avgFoodCostPercent'] as num?)?.toDouble() ?? 0,
      highCostRecipes: json['highCostRecipes'] as int? ?? 0,
      wasteEvents: json['wasteEvents'] as int? ?? 0,
      profitableRecipes: json['profitableRecipes'] as int? ?? 0,
    );
  }
}

class RecipeFeatureFlags {
  const RecipeFeatureFlags({
    required this.standardRecipes,
    required this.ingredientQuantities,
    required this.portionStandards,
    required this.preparationVideos,
    required this.cookingSops,
    required this.ingredientCosting,
    required this.perPlateCosting,
    required this.wasteTracking,
    required this.profitAnalysis,
    required this.costFluctuationTracking,
  });

  final bool standardRecipes;
  final bool ingredientQuantities;
  final bool portionStandards;
  final bool preparationVideos;
  final bool cookingSops;
  final bool ingredientCosting;
  final bool perPlateCosting;
  final bool wasteTracking;
  final bool profitAnalysis;
  final bool costFluctuationTracking;

  factory RecipeFeatureFlags.fromJson(Map<String, dynamic> json) {
    return RecipeFeatureFlags(
      standardRecipes: json['standardRecipes'] as bool? ?? false,
      ingredientQuantities: json['ingredientQuantities'] as bool? ?? false,
      portionStandards: json['portionStandards'] as bool? ?? false,
      preparationVideos: json['preparationVideos'] as bool? ?? false,
      cookingSops: json['cookingSops'] as bool? ?? false,
      ingredientCosting: json['ingredientCosting'] as bool? ?? false,
      perPlateCosting: json['perPlateCosting'] as bool? ?? false,
      wasteTracking: json['wasteTracking'] as bool? ?? false,
      profitAnalysis: json['profitAnalysis'] as bool? ?? false,
      costFluctuationTracking:
          json['costFluctuationTracking'] as bool? ?? false,
    );
  }
}

class RecipeCostingActionResult {
  const RecipeCostingActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory RecipeCostingActionResult.fromJson(Map<String, dynamic> json) {
    return RecipeCostingActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Recipe costing action applied',
    );
  }
}
