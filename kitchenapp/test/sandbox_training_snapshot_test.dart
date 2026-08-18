import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/sandbox_training/sandbox_training_snapshot.dart';

void main() {
  test('sandbox training snapshot parses API payload', () {
    final snapshot = SandboxTrainingSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'demoKitchens': [
        {
          'id': 'SB-DMO-001',
          'environmentName': 'Lunch rush demo kitchen',
          'section': 'Main',
          'simulatedOrders': 14,
          'scenarioLabel': 'Peak lunch · 148 covers',
          'status': 'active',
          'availableActions': ['launch_demo'],
        },
      ],
      'practiceSessions': [
        {
          'id': 'SB-PRC-001',
          'sessionName': 'New expeditor onboarding',
          'section': 'Main',
          'traineeName': 'Priya Sharma',
          'roleLabel': 'Expeditor',
          'status': 'in_progress',
          'availableActions': ['start_practice'],
        },
      ],
      'sopTrainings': [
        {
          'id': 'SB-SOP-001',
          'moduleName': 'Allergen handling SOP v3',
          'section': 'Main',
          'completionPercent': 78,
          'assigneeCount': 6,
          'status': 'in_progress',
          'availableActions': ['mark_complete'],
        },
      ],
      'kitchenSimulations': [
        {
          'id': 'SB-SIM-001',
          'simulationName': 'Rush hour · 148 covers',
          'section': 'Main',
          'difficulty': 'high',
          'durationLabel': '45 min',
          'status': 'ready',
          'availableActions': ['run_simulation'],
        },
      ],
      'stats': {
        'activeDemos': 1,
        'practiceInProgress': 1,
        'sopModulesPending': 0,
        'simulationsReady': 1,
        'traineesActive': 1,
        'sessionsToday': 14,
      },
      'trainingFeatures': {
        'demoKitchen': true,
        'staffPracticeMode': true,
        'sopTraining': true,
        'kitchenSimulations': true,
      },
    });

    expect(snapshot.demoKitchens.first.simulatedOrders, 14);
    expect(snapshot.sopTrainings.first.completionPercent, 78);
    expect(snapshot.trainingFeatures.kitchenSimulations, isTrue);
    expect(snapshot.stats.sessionsToday, 14);
  });
}
