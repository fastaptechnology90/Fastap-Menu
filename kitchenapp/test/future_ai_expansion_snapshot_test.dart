import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/future_ai_expansion/future_ai_expansion_snapshot.dart';

void main() {
  test('future ai expansion snapshot parses API payload', () {
    final snapshot = FutureAiExpansionSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'cookingAssistants': [
        {
          'id': 'FAI-CA-001',
          'assistantName': 'Sous chef copilot · Main line',
          'section': 'Main',
          'dishFocus': 'Curries & gravies',
          'confidenceLabel': '94%',
          'status': 'standby',
          'availableActions': ['start_assistant'],
        },
      ],
      'roboticKitchens': [
        {
          'id': 'FAI-RB-001',
          'robotName': 'Automated saucing arm',
          'section': 'Main',
          'stationLabel': 'Sauce pass',
          'taskQueue': 5,
          'status': 'connected',
          'availableActions': ['connect_robot'],
        },
      ],
      'platingSuggestions': [
        {
          'id': 'FAI-PL-001',
          'suggestionName': 'Fine dining arc layout',
          'section': 'Main',
          'dishName': 'Herb crusted salmon',
          'styleLabel': 'Modern fine',
          'status': 'ready',
          'availableActions': ['apply_suggestion'],
        },
      ],
      'wasteReductions': [
        {
          'id': 'FAI-WS-001',
          'insightName': 'Trim waste · protein station',
          'section': 'Main',
          'wastePercent': 6.4,
          'savingsLabel': '₹3,800 saved',
          'status': 'monitoring',
          'availableActions': ['apply_reduction'],
        },
      ],
      'prepAutomations': [
        {
          'id': 'FAI-PA-001',
          'automationName': 'Batch chop schedule · onions',
          'section': 'Prep',
          'batchSize': 18,
          'scheduleLabel': '06:00 AM',
          'status': 'running',
          'availableActions': ['start_automation'],
        },
      ],
      'stats': {
        'activeAssistants': 0,
        'roboticIntegrations': 1,
        'platingSuggestions': 1,
        'wasteInsights': 1,
        'prepAutomations': 1,
        'aiTasksRunning': 2,
      },
      'futureFeatures': {
        'aiCookingAssistant': true,
        'aiRoboticKitchenIntegration': true,
        'aiPlatingSuggestions': true,
        'aiWasteReductionEngine': true,
        'aiPreparationAutomation': true,
      },
    });

    expect(snapshot.cookingAssistants.first.assistantName,
        'Sous chef copilot · Main line');
    expect(snapshot.futureFeatures.aiPreparationAutomation, isTrue);
    expect(snapshot.stats.roboticIntegrations, 1);
  });
}
