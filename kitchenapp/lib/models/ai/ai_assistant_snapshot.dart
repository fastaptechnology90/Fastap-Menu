class AiAssistantSnapshot {
  const AiAssistantSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.predictions,
    required this.suggestions,
    required this.insights,
    required this.voiceCommands,
    required this.stats,
    required this.featureFlags,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final AiPredictions predictions;
  final List<AiSuggestion> suggestions;
  final List<AiInsight> insights;
  final List<AiVoiceCommand> voiceCommands;
  final AiAssistantStats stats;
  final AiFeatureFlags featureFlags;
  final List<String> sections;

  factory AiAssistantSnapshot.fromJson(Map<String, dynamic> json) {
    return AiAssistantSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      predictions: AiPredictions.fromJson(
        json['predictions'] as Map<String, dynamic>,
      ),
      suggestions: (json['suggestions'] as List<dynamic>)
          .map((item) => AiSuggestion.fromJson(item as Map<String, dynamic>))
          .toList(),
      insights: (json['insights'] as List<dynamic>)
          .map((item) => AiInsight.fromJson(item as Map<String, dynamic>))
          .toList(),
      voiceCommands: (json['voiceCommands'] as List<dynamic>)
          .map(
            (item) => AiVoiceCommand.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: AiAssistantStats.fromJson(json['stats'] as Map<String, dynamic>),
      featureFlags: AiFeatureFlags.fromJson(
        json['featureFlags'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class AiPredictions {
  const AiPredictions({
    required this.rushInMinutes,
    required this.delayRiskOrders,
    required this.recommendedChef,
    required this.prepOptimizationScore,
  });

  final int rushInMinutes;
  final int delayRiskOrders;
  final String recommendedChef;
  final double prepOptimizationScore;

  factory AiPredictions.fromJson(Map<String, dynamic> json) {
    return AiPredictions(
      rushInMinutes: json['rushInMinutes'] as int? ?? 0,
      delayRiskOrders: json['delayRiskOrders'] as int? ?? 0,
      recommendedChef: json['recommendedChef'] as String? ?? '',
      prepOptimizationScore:
          (json['prepOptimizationScore'] as num?)?.toDouble() ?? 0,
    );
  }
}

class AiSuggestion {
  const AiSuggestion({
    required this.id,
    required this.category,
    required this.title,
    required this.detail,
    required this.impact,
    required this.confidence,
  });

  final String id;
  final String category;
  final String title;
  final String detail;
  final String impact;
  final double confidence;

  factory AiSuggestion.fromJson(Map<String, dynamic> json) {
    return AiSuggestion(
      id: json['id'] as String,
      category: json['category'] as String,
      title: json['title'] as String,
      detail: json['detail'] as String,
      impact: json['impact'] as String,
      confidence: (json['confidence'] as num).toDouble(),
    );
  }
}

class AiInsight {
  const AiInsight({
    required this.id,
    required this.type,
    required this.title,
    required this.detail,
    required this.confidence,
    required this.severity,
  });

  final String id;
  final String type;
  final String title;
  final String detail;
  final double confidence;
  final String severity;

  factory AiInsight.fromJson(Map<String, dynamic> json) {
    return AiInsight(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      detail: json['detail'] as String,
      confidence: (json['confidence'] as num).toDouble(),
      severity: json['severity'] as String,
    );
  }
}

class AiVoiceCommand {
  const AiVoiceCommand({
    required this.command,
    required this.label,
    required this.phrase,
  });

  final String command;
  final String label;
  final String phrase;

  factory AiVoiceCommand.fromJson(Map<String, dynamic> json) {
    return AiVoiceCommand(
      command: json['command'] as String,
      label: json['label'] as String,
      phrase: json['phrase'] as String,
    );
  }
}

class AiAssistantStats {
  const AiAssistantStats({
    required this.activeSuggestions,
    required this.highImpact,
    required this.insights,
    required this.voiceCommands,
  });

  final int activeSuggestions;
  final int highImpact;
  final int insights;
  final int voiceCommands;

  factory AiAssistantStats.fromJson(Map<String, dynamic> json) {
    return AiAssistantStats(
      activeSuggestions: json['activeSuggestions'] as int? ?? 0,
      highImpact: json['highImpact'] as int? ?? 0,
      insights: json['insights'] as int? ?? 0,
      voiceCommands: json['voiceCommands'] as int? ?? 0,
    );
  }
}

class AiFeatureFlags {
  const AiFeatureFlags({
    required this.smartPreparationSuggestions,
    required this.delayPrediction,
    required this.rushPrediction,
    required this.smartCookingSequence,
    required this.smartChefAllocation,
    required this.ingredientOptimization,
    required this.aiWorkloadBalancing,
    required this.preparationOptimization,
  });

  final bool smartPreparationSuggestions;
  final bool delayPrediction;
  final bool rushPrediction;
  final bool smartCookingSequence;
  final bool smartChefAllocation;
  final bool ingredientOptimization;
  final bool aiWorkloadBalancing;
  final bool preparationOptimization;

  factory AiFeatureFlags.fromJson(Map<String, dynamic> json) {
    return AiFeatureFlags(
      smartPreparationSuggestions:
          json['smartPreparationSuggestions'] as bool? ?? false,
      delayPrediction: json['delayPrediction'] as bool? ?? false,
      rushPrediction: json['rushPrediction'] as bool? ?? false,
      smartCookingSequence: json['smartCookingSequence'] as bool? ?? false,
      smartChefAllocation: json['smartChefAllocation'] as bool? ?? false,
      ingredientOptimization: json['ingredientOptimization'] as bool? ?? false,
      aiWorkloadBalancing: json['aiWorkloadBalancing'] as bool? ?? false,
      preparationOptimization:
          json['preparationOptimization'] as bool? ?? false,
    );
  }
}

class AiActionResult {
  const AiActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory AiActionResult.fromJson(Map<String, dynamic> json) {
    return AiActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Action applied',
    );
  }
}
