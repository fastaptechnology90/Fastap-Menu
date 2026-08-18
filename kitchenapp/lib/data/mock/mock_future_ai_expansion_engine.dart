import 'mock_section_registry.dart';

class MockFutureAiExpansionRegistry {
  MockFutureAiExpansionRegistry._();

  static final List<Map<String, dynamic>> _assistants = _seedAssistants();
  static final List<Map<String, dynamic>> _robotic = _seedRobotic();
  static final List<Map<String, dynamic>> _plating = _seedPlating();
  static final List<Map<String, dynamic>> _waste = _seedWaste();
  static final List<Map<String, dynamic>> _prep = _seedPrep();
  static int _aiTasksRunning = 6;

  static List<Map<String, dynamic>> assistantsFor(String section) {
    return _filterSection(_assistants, section).map(_serializeAssistant).toList();
  }

  static List<Map<String, dynamic>> roboticFor(String section) {
    return _filterSection(_robotic, section).map(_serializeRobotic).toList();
  }

  static List<Map<String, dynamic>> platingFor(String section) {
    return _filterSection(_plating, section).map(_serializePlating).toList();
  }

  static List<Map<String, dynamic>> wasteFor(String section) {
    return _filterSection(_waste, section).map(_serializeWaste).toList();
  }

  static List<Map<String, dynamic>> prepFor(String section) {
    return _filterSection(_prep, section).map(_serializePrep).toList();
  }

  static Map<String, dynamic> performCookingAssistantAction({
    required String entryId,
    required String action,
  }) {
    final entry = _find(_assistants, entryId);
    if (entry == null) {
      throw ArgumentError('Cooking assistant not found');
    }

    final name = entry['assistantName'] as String;

    switch (action) {
      case 'start_assistant':
        entry['status'] = 'active';
        _aiTasksRunning++;
        return {'success': true, 'message': 'AI cooking assistant started · $name'};
      case 'refine_recipe':
        entry['confidenceLabel'] = '97%';
        entry['status'] = 'refining';
        return {'success': true, 'message': 'Recipe refinement running · $name'};
      case 'pause_assistant':
        entry['status'] = 'paused';
        return {'success': true, 'message': 'Assistant paused · $name'};
      default:
        throw ArgumentError('Unknown cooking assistant action: $action');
    }
  }

  static Map<String, dynamic> performRoboticKitchenAction({
    required String entryId,
    required String action,
  }) {
    final entry = _find(_robotic, entryId);
    if (entry == null) {
      throw ArgumentError('Robotic kitchen entry not found');
    }

    final name = entry['robotName'] as String;

    switch (action) {
      case 'connect_robot':
        entry['status'] = 'connected';
        _aiTasksRunning++;
        return {'success': true, 'message': 'Robotic station connected · $name'};
      case 'calibrate_station':
        entry['status'] = 'calibrating';
        return {'success': true, 'message': 'Station calibration started · $name'};
      case 'run_sequence':
        entry['status'] = 'running';
        entry['taskQueue'] = (entry['taskQueue'] as int) + 3;
        _aiTasksRunning++;
        return {'success': true, 'message': 'Robotic sequence running · $name'};
      default:
        throw ArgumentError('Unknown robotic kitchen action: $action');
    }
  }

  static Map<String, dynamic> performPlatingSuggestionAction({
    required String entryId,
    required String action,
  }) {
    final entry = _find(_plating, entryId);
    if (entry == null) {
      throw ArgumentError('Plating suggestion not found');
    }

    final name = entry['suggestionName'] as String;

    switch (action) {
      case 'apply_suggestion':
        entry['status'] = 'applied';
        _aiTasksRunning++;
        return {'success': true, 'message': 'Plating suggestion applied · $name'};
      case 'preview_plate':
        entry['status'] = 'previewing';
        return {'success': true, 'message': 'Plate preview ready · $name'};
      case 'reject_suggestion':
        entry['status'] = 'rejected';
        return {'success': true, 'message': 'Suggestion rejected · $name'};
      default:
        throw ArgumentError('Unknown plating suggestion action: $action');
    }
  }

  static Map<String, dynamic> performWasteReductionAction({
    required String entryId,
    required String action,
  }) {
    final entry = _find(_waste, entryId);
    if (entry == null) {
      throw ArgumentError('Waste reduction insight not found');
    }

    final name = entry['insightName'] as String;

    switch (action) {
      case 'analyze_waste':
        entry['status'] = 'analyzing';
        _aiTasksRunning++;
        return {'success': true, 'message': 'Waste analysis running · $name'};
      case 'apply_reduction':
        entry['status'] = 'applied';
        entry['wastePercent'] = ((entry['wastePercent'] as double) - 1.2)
            .clamp(0, 100);
        entry['savingsLabel'] = '₹${(4200 + _aiTasksRunning * 120)} saved';
        return {'success': true, 'message': 'Reduction plan applied · $name'};
      case 'schedule_audit':
        entry['status'] = 'scheduled';
        return {'success': true, 'message': 'Waste audit scheduled · $name'};
      default:
        throw ArgumentError('Unknown waste reduction action: $action');
    }
  }

  static Map<String, dynamic> performPrepAutomationAction({
    required String entryId,
    required String action,
  }) {
    final entry = _find(_prep, entryId);
    if (entry == null) {
      throw ArgumentError('Prep automation entry not found');
    }

    final name = entry['automationName'] as String;

    switch (action) {
      case 'start_automation':
        entry['status'] = 'running';
        _aiTasksRunning++;
        return {'success': true, 'message': 'Prep automation started · $name'};
      case 'adjust_batch':
        entry['batchSize'] = (entry['batchSize'] as int) + 4;
        entry['status'] = 'adjusted';
        return {'success': true, 'message': 'Batch size adjusted · $name'};
      case 'pause_automation':
        entry['status'] = 'paused';
        return {'success': true, 'message': 'Automation paused · $name'};
      default:
        throw ArgumentError('Unknown prep automation action: $action');
    }
  }

  static Map<String, dynamic> activateAll() {
    for (final entry in _assistants) {
      if (entry['status'] == 'standby') {
        entry['status'] = 'active';
      }
    }
    for (final entry in _robotic) {
      if (entry['status'] == 'offline') {
        entry['status'] = 'connected';
      }
    }
    for (final entry in _plating) {
      if (entry['status'] == 'pending') {
        entry['status'] = 'ready';
      }
    }
    for (final entry in _waste) {
      entry['status'] = 'monitoring';
    }
    for (final entry in _prep) {
      if (entry['status'] == 'scheduled') {
        entry['status'] = 'running';
      }
    }
    _aiTasksRunning += 5;

    return {
      'success': true,
      'message': 'All future AI expansion features activated',
    };
  }

  static Map<String, dynamic>? _find(
    List<Map<String, dynamic>> items,
    String id,
  ) {
    for (final item in items) {
      if (item['id'] == id) {
        return item;
      }
    }
    return null;
  }

  static List<Map<String, dynamic>> _filterSection(
    List<Map<String, dynamic>> items,
    String section,
  ) {
    if (section == 'All') {
      return items;
    }
    return items.where((item) => item['section'] == section).toList();
  }

  static Map<String, dynamic> _serializeAssistant(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'assistantName': item['assistantName'],
      'section': item['section'],
      'dishFocus': item['dishFocus'],
      'confidenceLabel': item['confidenceLabel'],
      'status': item['status'],
      'availableActions': const [
        'start_assistant',
        'refine_recipe',
        'pause_assistant',
      ],
    };
  }

  static Map<String, dynamic> _serializeRobotic(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'robotName': item['robotName'],
      'section': item['section'],
      'stationLabel': item['stationLabel'],
      'taskQueue': item['taskQueue'],
      'status': item['status'],
      'availableActions': const [
        'connect_robot',
        'calibrate_station',
        'run_sequence',
      ],
    };
  }

  static Map<String, dynamic> _serializePlating(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'suggestionName': item['suggestionName'],
      'section': item['section'],
      'dishName': item['dishName'],
      'styleLabel': item['styleLabel'],
      'status': item['status'],
      'availableActions': const [
        'apply_suggestion',
        'preview_plate',
        'reject_suggestion',
      ],
    };
  }

  static Map<String, dynamic> _serializeWaste(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'insightName': item['insightName'],
      'section': item['section'],
      'wastePercent': item['wastePercent'],
      'savingsLabel': item['savingsLabel'],
      'status': item['status'],
      'availableActions': const [
        'analyze_waste',
        'apply_reduction',
        'schedule_audit',
      ],
    };
  }

  static Map<String, dynamic> _serializePrep(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'automationName': item['automationName'],
      'section': item['section'],
      'batchSize': item['batchSize'],
      'scheduleLabel': item['scheduleLabel'],
      'status': item['status'],
      'availableActions': const [
        'start_automation',
        'adjust_batch',
        'pause_automation',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedAssistants() => [
        {
          'id': 'FAI-CA-001',
          'assistantName': 'Sous chef copilot · Main line',
          'section': 'Main',
          'dishFocus': 'Curries & gravies',
          'confidenceLabel': '94%',
          'status': 'standby',
        },
        {
          'id': 'FAI-CA-002',
          'assistantName': 'Pastry guidance AI',
          'section': 'Pastry',
          'dishFocus': 'Dessert finishing',
          'confidenceLabel': '91%',
          'status': 'active',
        },
      ];

  static List<Map<String, dynamic>> _seedRobotic() => [
        {
          'id': 'FAI-RB-001',
          'robotName': 'Automated saucing arm',
          'section': 'Main',
          'stationLabel': 'Sauce pass',
          'taskQueue': 5,
          'status': 'connected',
        },
        {
          'id': 'FAI-RB-002',
          'robotName': 'Prep dicer unit',
          'section': 'Prep',
          'stationLabel': 'Vegetable prep',
          'taskQueue': 2,
          'status': 'offline',
        },
      ];

  static List<Map<String, dynamic>> _seedPlating() => [
        {
          'id': 'FAI-PL-001',
          'suggestionName': 'Fine dining arc layout',
          'section': 'Main',
          'dishName': 'Herb crusted salmon',
          'styleLabel': 'Modern fine',
          'status': 'ready',
        },
        {
          'id': 'FAI-PL-002',
          'suggestionName': 'Banquet family-style spread',
          'section': 'Banquet',
          'dishName': 'Mixed grill platter',
          'styleLabel': 'Shared service',
          'status': 'pending',
        },
      ];

  static List<Map<String, dynamic>> _seedWaste() => [
        {
          'id': 'FAI-WS-001',
          'insightName': 'Trim waste · protein station',
          'section': 'Main',
          'wastePercent': 6.4,
          'savingsLabel': '₹3,800 saved',
          'status': 'monitoring',
        },
        {
          'id': 'FAI-WS-002',
          'insightName': 'Over-prep forecast · salads',
          'section': 'Cold',
          'wastePercent': 4.1,
          'savingsLabel': '₹1,950 saved',
          'status': 'analyzing',
        },
      ];

  static List<Map<String, dynamic>> _seedPrep() => [
        {
          'id': 'FAI-PA-001',
          'automationName': 'Batch chop schedule · onions',
          'section': 'Prep',
          'batchSize': 18,
          'scheduleLabel': '06:00 AM',
          'status': 'running',
        },
        {
          'id': 'FAI-PA-002',
          'automationName': 'Marinade rotation planner',
          'section': 'Main',
          'batchSize': 12,
          'scheduleLabel': 'Next service',
          'status': 'scheduled',
        },
      ];
}

class MockFutureAiExpansionEngine {
  const MockFutureAiExpansionEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final cookingAssistants =
        MockFutureAiExpansionRegistry.assistantsFor(section);
    final roboticKitchens = MockFutureAiExpansionRegistry.roboticFor(section);
    final platingSuggestions = MockFutureAiExpansionRegistry.platingFor(section);
    final wasteReductions = MockFutureAiExpansionRegistry.wasteFor(section);
    final prepAutomations = MockFutureAiExpansionRegistry.prepFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'cookingAssistants': cookingAssistants,
      'roboticKitchens': roboticKitchens,
      'platingSuggestions': platingSuggestions,
      'wasteReductions': wasteReductions,
      'prepAutomations': prepAutomations,
      'stats': {
        'activeAssistants': cookingAssistants
            .where((item) => item['status'] == 'active')
            .length,
        'roboticIntegrations': roboticKitchens
            .where((item) =>
                item['status'] == 'connected' || item['status'] == 'running')
            .length,
        'platingSuggestions': platingSuggestions
            .where((item) =>
                item['status'] == 'ready' || item['status'] == 'applied')
            .length,
        'wasteInsights': wasteReductions.length,
        'prepAutomations': prepAutomations
            .where((item) => item['status'] == 'running')
            .length,
        'aiTasksRunning': cookingAssistants
                .where((item) => item['status'] == 'active')
                .length +
            roboticKitchens
                .where((item) => item['status'] == 'running')
                .length +
            prepAutomations
                .where((item) => item['status'] == 'running')
                .length,
      },
      'futureFeatures': {
        'aiCookingAssistant': cookingAssistants.isNotEmpty,
        'aiRoboticKitchenIntegration': roboticKitchens.isNotEmpty,
        'aiPlatingSuggestions': platingSuggestions.isNotEmpty,
        'aiWasteReductionEngine': wasteReductions.isNotEmpty,
        'aiPreparationAutomation': prepAutomations.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
