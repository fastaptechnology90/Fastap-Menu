import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/ai/ai_assistant_snapshot.dart';

void main() {
  test('ai assistant snapshot parses API payload', () {
    final snapshot = AiAssistantSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'predictions': {
        'rushInMinutes': 18,
        'delayRiskOrders': 2,
        'recommendedChef': 'Chef Arjun Mehta',
        'prepOptimizationScore': 0.84,
      },
      'suggestions': [
        {
          'id': 'SUG-QUEUE-VIP',
          'category': 'priority',
          'title': 'Reprioritize VIP lane',
          'detail': 'Room 804 VIP dal · allergy protocol active',
          'impact': 'high',
          'confidence': 0.93,
        },
      ],
      'insights': [
        {
          'id': 'INS-RUSH',
          'type': 'rush_prediction',
          'title': 'Rush load peak in 18 minutes',
          'detail': 'Main + Chinese sections · prepare backup line cooks',
          'confidence': 0.87,
          'severity': 'high',
        },
      ],
      'voiceCommands': [
        {
          'command': 'mark_ready',
          'label': 'Mark ready',
          'phrase': 'Mark ready',
        },
      ],
      'stats': {
        'activeSuggestions': 1,
        'highImpact': 1,
        'insights': 1,
        'voiceCommands': 1,
      },
      'featureFlags': {
        'smartPreparationSuggestions': true,
        'delayPrediction': true,
        'rushPrediction': true,
        'smartCookingSequence': true,
        'smartChefAllocation': true,
        'ingredientOptimization': true,
        'aiWorkloadBalancing': true,
        'preparationOptimization': true,
      },
    });

    expect(snapshot.suggestions.length, 1);
    expect(snapshot.predictions.rushInMinutes, 18);
    expect(snapshot.featureFlags.smartPreparationSuggestions, isTrue);
    expect(snapshot.voiceCommands.first.command, 'mark_ready');
  });
}
