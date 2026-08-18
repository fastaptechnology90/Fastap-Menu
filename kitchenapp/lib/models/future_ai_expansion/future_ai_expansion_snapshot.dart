class FutureAiExpansionSnapshot {
  const FutureAiExpansionSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.cookingAssistants,
    required this.roboticKitchens,
    required this.platingSuggestions,
    required this.wasteReductions,
    required this.prepAutomations,
    required this.stats,
    required this.futureFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<AiCookingAssistantEntry> cookingAssistants;
  final List<AiRoboticKitchenEntry> roboticKitchens;
  final List<AiPlatingSuggestionEntry> platingSuggestions;
  final List<AiWasteReductionEntry> wasteReductions;
  final List<AiPrepAutomationEntry> prepAutomations;
  final FutureAiExpansionStats stats;
  final FutureAiExpansionFeatureFlags futureFeatures;
  final List<String> sections;

  factory FutureAiExpansionSnapshot.fromJson(Map<String, dynamic> json) {
    return FutureAiExpansionSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      cookingAssistants: (json['cookingAssistants'] as List<dynamic>)
          .map(
            (item) =>
                AiCookingAssistantEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      roboticKitchens: (json['roboticKitchens'] as List<dynamic>)
          .map(
            (item) =>
                AiRoboticKitchenEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      platingSuggestions: (json['platingSuggestions'] as List<dynamic>)
          .map(
            (item) => AiPlatingSuggestionEntry.fromJson(
              item as Map<String, dynamic>,
            ),
          )
          .toList(),
      wasteReductions: (json['wasteReductions'] as List<dynamic>)
          .map(
            (item) =>
                AiWasteReductionEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      prepAutomations: (json['prepAutomations'] as List<dynamic>)
          .map(
            (item) =>
                AiPrepAutomationEntry.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: FutureAiExpansionStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      futureFeatures: FutureAiExpansionFeatureFlags.fromJson(
        json['futureFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiCookingAssistantEntry {
  const AiCookingAssistantEntry({
    required this.id,
    required this.assistantName,
    required this.section,
    required this.dishFocus,
    required this.confidenceLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String assistantName;
  final String section;
  final String dishFocus;
  final String confidenceLabel;
  final String status;
  final List<String> availableActions;

  factory AiCookingAssistantEntry.fromJson(Map<String, dynamic> json) {
    return AiCookingAssistantEntry(
      id: json['id'] as String,
      assistantName: json['assistantName'] as String,
      section: json['section'] as String,
      dishFocus: json['dishFocus'] as String? ?? 'General',
      confidenceLabel: json['confidenceLabel'] as String? ?? '92%',
      status: json['status'] as String? ?? 'standby',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiRoboticKitchenEntry {
  const AiRoboticKitchenEntry({
    required this.id,
    required this.robotName,
    required this.section,
    required this.stationLabel,
    required this.taskQueue,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String robotName;
  final String section;
  final String stationLabel;
  final int taskQueue;
  final String status;
  final List<String> availableActions;

  factory AiRoboticKitchenEntry.fromJson(Map<String, dynamic> json) {
    return AiRoboticKitchenEntry(
      id: json['id'] as String,
      robotName: json['robotName'] as String,
      section: json['section'] as String,
      stationLabel: json['stationLabel'] as String? ?? 'Prep line',
      taskQueue: json['taskQueue'] as int? ?? 0,
      status: json['status'] as String? ?? 'offline',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiPlatingSuggestionEntry {
  const AiPlatingSuggestionEntry({
    required this.id,
    required this.suggestionName,
    required this.section,
    required this.dishName,
    required this.styleLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String suggestionName;
  final String section;
  final String dishName;
  final String styleLabel;
  final String status;
  final List<String> availableActions;

  factory AiPlatingSuggestionEntry.fromJson(Map<String, dynamic> json) {
    return AiPlatingSuggestionEntry(
      id: json['id'] as String,
      suggestionName: json['suggestionName'] as String,
      section: json['section'] as String,
      dishName: json['dishName'] as String? ?? 'Chef special',
      styleLabel: json['styleLabel'] as String? ?? 'Modern',
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiWasteReductionEntry {
  const AiWasteReductionEntry({
    required this.id,
    required this.insightName,
    required this.section,
    required this.wastePercent,
    required this.savingsLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String insightName;
  final String section;
  final double wastePercent;
  final String savingsLabel;
  final String status;
  final List<String> availableActions;

  factory AiWasteReductionEntry.fromJson(Map<String, dynamic> json) {
    return AiWasteReductionEntry(
      id: json['id'] as String,
      insightName: json['insightName'] as String,
      section: json['section'] as String,
      wastePercent: (json['wastePercent'] as num?)?.toDouble() ?? 0,
      savingsLabel: json['savingsLabel'] as String? ?? '₹0 saved',
      status: json['status'] as String? ?? 'analyzing',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiPrepAutomationEntry {
  const AiPrepAutomationEntry({
    required this.id,
    required this.automationName,
    required this.section,
    required this.batchSize,
    required this.scheduleLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String automationName;
  final String section;
  final int batchSize;
  final String scheduleLabel;
  final String status;
  final List<String> availableActions;

  factory AiPrepAutomationEntry.fromJson(Map<String, dynamic> json) {
    return AiPrepAutomationEntry(
      id: json['id'] as String,
      automationName: json['automationName'] as String,
      section: json['section'] as String,
      batchSize: json['batchSize'] as int? ?? 0,
      scheduleLabel: json['scheduleLabel'] as String? ?? 'Next shift',
      status: json['status'] as String? ?? 'scheduled',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class FutureAiExpansionStats {
  const FutureAiExpansionStats({
    required this.activeAssistants,
    required this.roboticIntegrations,
    required this.platingSuggestions,
    required this.wasteInsights,
    required this.prepAutomations,
    required this.aiTasksRunning,
  });

  final int activeAssistants;
  final int roboticIntegrations;
  final int platingSuggestions;
  final int wasteInsights;
  final int prepAutomations;
  final int aiTasksRunning;

  factory FutureAiExpansionStats.fromJson(Map<String, dynamic> json) {
    return FutureAiExpansionStats(
      activeAssistants: json['activeAssistants'] as int? ?? 0,
      roboticIntegrations: json['roboticIntegrations'] as int? ?? 0,
      platingSuggestions: json['platingSuggestions'] as int? ?? 0,
      wasteInsights: json['wasteInsights'] as int? ?? 0,
      prepAutomations: json['prepAutomations'] as int? ?? 0,
      aiTasksRunning: json['aiTasksRunning'] as int? ?? 0,
    );
  }
}

class FutureAiExpansionFeatureFlags {
  const FutureAiExpansionFeatureFlags({
    required this.aiCookingAssistant,
    required this.aiRoboticKitchenIntegration,
    required this.aiPlatingSuggestions,
    required this.aiWasteReductionEngine,
    required this.aiPreparationAutomation,
  });

  final bool aiCookingAssistant;
  final bool aiRoboticKitchenIntegration;
  final bool aiPlatingSuggestions;
  final bool aiWasteReductionEngine;
  final bool aiPreparationAutomation;

  factory FutureAiExpansionFeatureFlags.fromJson(Map<String, dynamic> json) {
    return FutureAiExpansionFeatureFlags(
      aiCookingAssistant: json['aiCookingAssistant'] as bool? ?? false,
      aiRoboticKitchenIntegration:
          json['aiRoboticKitchenIntegration'] as bool? ?? false,
      aiPlatingSuggestions: json['aiPlatingSuggestions'] as bool? ?? false,
      aiWasteReductionEngine: json['aiWasteReductionEngine'] as bool? ?? false,
      aiPreparationAutomation:
          json['aiPreparationAutomation'] as bool? ?? false,
    );
  }
}

class FutureAiExpansionActionResult {
  const FutureAiExpansionActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory FutureAiExpansionActionResult.fromJson(Map<String, dynamic> json) {
    return FutureAiExpansionActionResult(
      success: json['success'] as bool? ?? true,
      message: json['message'] as String? ?? 'Action completed',
    );
  }
}
