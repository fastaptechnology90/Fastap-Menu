import 'mock_chef_task_registry.dart';
import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockAiAssistantEngine {
  const MockAiAssistantEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final orders = MockOrderStore.activeOrders(section);
    final delayed = orders.where((o) => o['status'] == 'delayed').length;
    final rush = orders.where((o) {
      return o['status'] == 'delayed' ||
          o['priority'] == 'express' ||
          (o['timerSeconds'] as int) > 600;
    }).length;
    final tasks = MockChefTaskRegistry.tasksFor(section);
    final overloadedChef = _busiestChef(tasks);

    final suggestions = _suggestions(orders, tasks, section);
    final insights = _insights(orders, delayed, rush, overloadedChef);
    final voiceCommands = _voiceCommands();

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'predictions': {
        'rushInMinutes': rush > 0 ? 18 : 32,
        'delayRiskOrders': delayed + (rush > 2 ? 1 : 0),
        'recommendedChef': overloadedChef ?? 'Chef Arjun Mehta',
        'prepOptimizationScore': 0.84,
      },
      'suggestions': suggestions,
      'insights': insights,
      'voiceCommands': voiceCommands,
      'stats': {
        'activeSuggestions': suggestions.length,
        'highImpact': suggestions.where((s) => s['impact'] == 'high').length,
        'insights': insights.length,
        'voiceCommands': voiceCommands.length,
      },
      'featureFlags': {
        'smartPreparationSuggestions': true,
        'delayPrediction': delayed > 0,
        'rushPrediction': rush > 0,
        'smartCookingSequence': true,
        'smartChefAllocation': overloadedChef != null,
        'ingredientOptimization': true,
        'aiWorkloadBalancing': tasks.length > 3,
        'preparationOptimization': true,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> applySuggestion(String suggestionId) {
    return switch (suggestionId) {
      'SUG-BATCH-NAAN' => _message('Batch cooking plan applied · 18 naan grouped'),
      'SUG-CHEF-MEI' => _applyChefBalance(),
      'SUG-QUEUE-VIP' => _applyQueueOptimize(),
      'SUG-PREP-MAIN' => _message('Preparation sequence optimized for Main section'),
      'SUG-INGREDIENT' => _message('Ingredient prep list updated · reduce 12% waste'),
      _ => _message('AI suggestion applied'),
    };
  }

  static Map<String, dynamic> executeVoiceCommand(
    String command, {
    String? orderId,
  }) {
    final resolvedOrder = orderId ?? _firstActiveOrderId();
    if (resolvedOrder == null) {
      return {
        'success': false,
        'message': 'No active order found for voice command',
      };
    }

    switch (command) {
      case 'mark_ready':
        MockOrderStore.processAction(resolvedOrder, 'ready');
        return {
          'success': true,
          'message': 'Voice · marked $resolvedOrder ready',
        };
      case 'delay_5':
        MockOrderStore.processAction(resolvedOrder, 'delay');
        return {
          'success': true,
          'message': 'Voice · $resolvedOrder delayed 5 minutes',
        };
      case 'out_of_stock':
        return {
          'success': true,
          'message': 'Voice · out-of-stock alert sent to FOH',
        };
      case 'need_assistance':
        return {
          'success': true,
          'message': 'Voice · supervisor assistance requested',
        };
      case 'refire':
        MockOrderStore.processAction(resolvedOrder, 'refire');
        return {
          'success': true,
          'message': 'Voice · re-fire requested for $resolvedOrder',
        };
      default:
        throw ArgumentError('Unknown voice command: $command');
    }
  }

  static Map<String, dynamic> _applyChefBalance() {
    final result = MockChefTaskRegistry.balanceWorkload();
    return {
      'success': true,
      'message': result['message'] as String,
    };
  }

  static Map<String, dynamic> _applyQueueOptimize() {
    MockOrderStore.autoSortQueue();
    return {
      'success': true,
      'message': 'AI reprioritized VIP and rush orders in queue',
    };
  }

  static Map<String, dynamic> _message(String message) {
    return {'success': true, 'message': message};
  }

  static String? _firstActiveOrderId() {
    final orders = MockOrderStore.activeOrders('All');
    if (orders.isEmpty) {
      return null;
    }
    return orders.first['id'] as String;
  }

  static String? _busiestChef(List<Map<String, dynamic>> tasks) {
    final counts = <String, int>{};
    for (final task in tasks) {
      final chef = task['assignedChef'] as String;
      counts[chef] = (counts[chef] ?? 0) + 1;
    }
    if (counts.isEmpty) {
      return null;
    }
    return counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
  }

  static List<Map<String, dynamic>> _suggestions(
    List<Map<String, dynamic>> orders,
    List<Map<String, dynamic>> tasks,
    String section,
  ) {
    final list = <Map<String, dynamic>>[
      {
        'id': 'SUG-BATCH-NAAN',
        'category': 'preparation',
        'title': 'Batch 18 butter naan together',
        'detail': 'Tandoor section · reduce fire cycles by 22%',
        'impact': 'high',
        'confidence': 0.91,
      },
      {
        'id': 'SUG-PREP-MAIN',
        'category': 'sequence',
        'title': 'Optimize Main course prep sequence',
        'detail': 'Fire dal before rice · align VIP room 804',
        'impact': 'medium',
        'confidence': 0.86,
      },
      {
        'id': 'SUG-INGREDIENT',
        'category': 'ingredient',
        'title': 'Pre-chop salad greens for rush',
        'detail': 'Salad section · 14 orders forecast in 30m',
        'impact': 'medium',
        'confidence': 0.79,
      },
    ];

    if (tasks.length > 3) {
      list.insert(1, {
        'id': 'SUG-CHEF-MEI',
        'category': 'chef_allocation',
        'title': 'Move 1 task from Mei Lin to lighter chef',
        'detail': 'Chinese section at 94% load · balance workload',
        'impact': 'high',
        'confidence': 0.88,
      });
    }

    if (orders.any((o) => o['vip'] == true)) {
      list.insert(0, {
        'id': 'SUG-QUEUE-VIP',
        'category': 'priority',
        'title': 'Reprioritize VIP lane',
        'detail': 'Room 804 VIP dal · allergy protocol active',
        'impact': 'high',
        'confidence': 0.93,
      });
    }

    if (section != 'All') {
      return list
          .where((item) => item['detail'].toString().contains(section) ||
              item['category'] == 'priority')
          .take(4)
          .toList();
    }

    return list.take(5).toList();
  }

  static List<Map<String, dynamic>> _insights(
    List<Map<String, dynamic>> orders,
    int delayed,
    int rush,
    String? busiestChef,
  ) {
    final insights = <Map<String, dynamic>>[
      {
        'id': 'INS-RUSH',
        'type': 'rush_prediction',
        'title': 'Rush load peak in 18 minutes',
        'detail': 'Main + Chinese sections · prepare backup line cooks',
        'confidence': 0.87,
        'severity': rush > 0 ? 'high' : 'medium',
      },
      {
        'id': 'INS-DELAY',
        'type': 'delay_prediction',
        'title': '$delayed orders at delay risk',
        'detail': 'Express delivery and banquet batch need recovery',
        'confidence': 0.82,
        'severity': delayed > 0 ? 'critical' : 'low',
      },
    ];

    if (busiestChef != null) {
      insights.add({
        'id': 'INS-CHEF',
        'type': 'chef_allocation',
        'title': 'Reallocate $busiestChef workload',
        'detail': 'Smart chef allocation · transfer 1 prep task',
        'confidence': 0.85,
        'severity': 'medium',
      });
    }

    if (orders.any((o) => o['section'] == 'Dessert')) {
      insights.add({
        'id': 'INS-SEQ',
        'type': 'cooking_sequence',
        'title': 'Batch dessert service sequence ready',
        'detail': 'Banquet A · simultaneous fire in 12m',
        'confidence': 0.9,
        'severity': 'medium',
      });
    }

    return insights;
  }

  static List<Map<String, dynamic>> _voiceCommands() {
    return [
      {
        'command': 'mark_ready',
        'label': 'Mark ready',
        'phrase': 'Mark ready',
      },
      {
        'command': 'delay_5',
        'label': 'Delay 5 minutes',
        'phrase': 'Delay 5 minutes',
      },
      {
        'command': 'out_of_stock',
        'label': 'Out of stock',
        'phrase': 'Out of stock',
      },
      {
        'command': 'need_assistance',
        'label': 'Need assistance',
        'phrase': 'Need assistance',
      },
      {
        'command': 'refire',
        'label': 'Re-fire item',
        'phrase': 'Re-fire item',
      },
    ];
  }
}
