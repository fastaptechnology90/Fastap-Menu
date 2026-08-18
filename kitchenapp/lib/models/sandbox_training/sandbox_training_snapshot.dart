class SandboxTrainingSnapshot {
  const SandboxTrainingSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.demoKitchens,
    required this.practiceSessions,
    required this.sopTrainings,
    required this.kitchenSimulations,
    required this.stats,
    required this.trainingFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<DemoKitchenEnvironment> demoKitchens;
  final List<PracticeSession> practiceSessions;
  final List<SopTrainingModule> sopTrainings;
  final List<KitchenSimulation> kitchenSimulations;
  final SandboxTrainingStats stats;
  final SandboxTrainingFeatureFlags trainingFeatures;
  final List<String> sections;

  factory SandboxTrainingSnapshot.fromJson(Map<String, dynamic> json) {
    return SandboxTrainingSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      demoKitchens: (json['demoKitchens'] as List<dynamic>)
          .map(
            (item) =>
                DemoKitchenEnvironment.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      practiceSessions: (json['practiceSessions'] as List<dynamic>)
          .map((item) => PracticeSession.fromJson(item as Map<String, dynamic>))
          .toList(),
      sopTrainings: (json['sopTrainings'] as List<dynamic>)
          .map((item) => SopTrainingModule.fromJson(item as Map<String, dynamic>))
          .toList(),
      kitchenSimulations: (json['kitchenSimulations'] as List<dynamic>)
          .map(
            (item) => KitchenSimulation.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: SandboxTrainingStats.fromJson(
        json['stats'] as Map<String, dynamic>,
      ),
      trainingFeatures: SandboxTrainingFeatureFlags.fromJson(
        json['trainingFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class DemoKitchenEnvironment {
  const DemoKitchenEnvironment({
    required this.id,
    required this.environmentName,
    required this.section,
    required this.simulatedOrders,
    required this.scenarioLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String environmentName;
  final String section;
  final int simulatedOrders;
  final String scenarioLabel;
  final String status;
  final List<String> availableActions;

  factory DemoKitchenEnvironment.fromJson(Map<String, dynamic> json) {
    return DemoKitchenEnvironment(
      id: json['id'] as String,
      environmentName: json['environmentName'] as String,
      section: json['section'] as String,
      simulatedOrders: json['simulatedOrders'] as int? ?? 0,
      scenarioLabel: json['scenarioLabel'] as String? ?? 'Standard',
      status: json['status'] as String? ?? 'idle',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class PracticeSession {
  const PracticeSession({
    required this.id,
    required this.sessionName,
    required this.section,
    required this.traineeName,
    required this.roleLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String sessionName;
  final String section;
  final String traineeName;
  final String roleLabel;
  final String status;
  final List<String> availableActions;

  factory PracticeSession.fromJson(Map<String, dynamic> json) {
    return PracticeSession(
      id: json['id'] as String,
      sessionName: json['sessionName'] as String,
      section: json['section'] as String,
      traineeName: json['traineeName'] as String? ?? 'Trainee',
      roleLabel: json['roleLabel'] as String? ?? 'Station',
      status: json['status'] as String? ?? 'scheduled',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SopTrainingModule {
  const SopTrainingModule({
    required this.id,
    required this.moduleName,
    required this.section,
    required this.completionPercent,
    required this.assigneeCount,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String moduleName;
  final String section;
  final int completionPercent;
  final int assigneeCount;
  final String status;
  final List<String> availableActions;

  factory SopTrainingModule.fromJson(Map<String, dynamic> json) {
    return SopTrainingModule(
      id: json['id'] as String,
      moduleName: json['moduleName'] as String,
      section: json['section'] as String,
      completionPercent: json['completionPercent'] as int? ?? 0,
      assigneeCount: json['assigneeCount'] as int? ?? 0,
      status: json['status'] as String? ?? 'pending',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class KitchenSimulation {
  const KitchenSimulation({
    required this.id,
    required this.simulationName,
    required this.section,
    required this.difficulty,
    required this.durationLabel,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String simulationName;
  final String section;
  final String difficulty;
  final String durationLabel;
  final String status;
  final List<String> availableActions;

  factory KitchenSimulation.fromJson(Map<String, dynamic> json) {
    return KitchenSimulation(
      id: json['id'] as String,
      simulationName: json['simulationName'] as String,
      section: json['section'] as String,
      difficulty: json['difficulty'] as String? ?? 'medium',
      durationLabel: json['durationLabel'] as String? ?? '30 min',
      status: json['status'] as String? ?? 'ready',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class SandboxTrainingStats {
  const SandboxTrainingStats({
    required this.activeDemos,
    required this.practiceInProgress,
    required this.sopModulesPending,
    required this.simulationsReady,
    required this.traineesActive,
    required this.sessionsToday,
  });

  final int activeDemos;
  final int practiceInProgress;
  final int sopModulesPending;
  final int simulationsReady;
  final int traineesActive;
  final int sessionsToday;

  factory SandboxTrainingStats.fromJson(Map<String, dynamic> json) {
    return SandboxTrainingStats(
      activeDemos: json['activeDemos'] as int? ?? 0,
      practiceInProgress: json['practiceInProgress'] as int? ?? 0,
      sopModulesPending: json['sopModulesPending'] as int? ?? 0,
      simulationsReady: json['simulationsReady'] as int? ?? 0,
      traineesActive: json['traineesActive'] as int? ?? 0,
      sessionsToday: json['sessionsToday'] as int? ?? 0,
    );
  }
}

class SandboxTrainingFeatureFlags {
  const SandboxTrainingFeatureFlags({
    required this.demoKitchen,
    required this.staffPracticeMode,
    required this.sopTraining,
    required this.kitchenSimulations,
  });

  final bool demoKitchen;
  final bool staffPracticeMode;
  final bool sopTraining;
  final bool kitchenSimulations;

  factory SandboxTrainingFeatureFlags.fromJson(Map<String, dynamic> json) {
    return SandboxTrainingFeatureFlags(
      demoKitchen: json['demoKitchen'] as bool? ?? false,
      staffPracticeMode: json['staffPracticeMode'] as bool? ?? false,
      sopTraining: json['sopTraining'] as bool? ?? false,
      kitchenSimulations: json['kitchenSimulations'] as bool? ?? false,
    );
  }
}

class SandboxTrainingActionResult {
  const SandboxTrainingActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory SandboxTrainingActionResult.fromJson(Map<String, dynamic> json) {
    return SandboxTrainingActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Training action applied',
    );
  }
}
