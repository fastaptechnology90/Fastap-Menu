import 'mock_section_registry.dart';

class MockSandboxTrainingRegistry {
  MockSandboxTrainingRegistry._();

  static final List<Map<String, dynamic>> _demos = _seedDemos();
  static final List<Map<String, dynamic>> _practice = _seedPractice();
  static final List<Map<String, dynamic>> _sop = _seedSop();
  static final List<Map<String, dynamic>> _simulations = _seedSimulations();
  static int _sessionsToday = 14;

  static List<Map<String, dynamic>> demosFor(String section) {
    return _filterSection(_demos, section).map(_serializeDemo).toList();
  }

  static List<Map<String, dynamic>> practiceFor(String section) {
    return _filterSection(_practice, section).map(_serializePractice).toList();
  }

  static List<Map<String, dynamic>> sopFor(String section) {
    return _filterSection(_sop, section).map(_serializeSop).toList();
  }

  static List<Map<String, dynamic>> simulationsFor(String section) {
    return _filterSection(_simulations, section)
        .map(_serializeSimulation)
        .toList();
  }

  static Map<String, dynamic> performDemoAction({
    required String demoId,
    required String action,
  }) {
    final demo = _find(_demos, demoId);
    if (demo == null) {
      throw ArgumentError('Demo kitchen not found');
    }

    final name = demo['environmentName'] as String;

    switch (action) {
      case 'launch_demo':
        demo['status'] = 'active';
        demo['simulatedOrders'] = (demo['simulatedOrders'] as int) + 6;
        _sessionsToday++;
        return {'success': true, 'message': 'Demo kitchen launched · $name'};
      case 'reset_demo':
        demo['status'] = 'idle';
        demo['simulatedOrders'] = 0;
        return {'success': true, 'message': 'Demo environment reset · $name'};
      case 'extend_demo':
        demo['simulatedOrders'] = (demo['simulatedOrders'] as int) + 4;
        demo['status'] = 'extended';
        return {'success': true, 'message': 'Demo extended · $name'};
      default:
        throw ArgumentError('Unknown demo kitchen action: $action');
    }
  }

  static Map<String, dynamic> performPracticeAction({
    required String sessionId,
    required String action,
  }) {
    final session = _find(_practice, sessionId);
    if (session == null) {
      throw ArgumentError('Practice session not found');
    }

    final name = session['sessionName'] as String;

    switch (action) {
      case 'start_practice':
        session['status'] = 'in_progress';
        _sessionsToday++;
        return {'success': true, 'message': 'Practice session started · $name'};
      case 'pause_practice':
        session['status'] = 'paused';
        return {'success': true, 'message': 'Practice session paused · $name'};
      case 'complete_practice':
        session['status'] = 'completed';
        _sessionsToday++;
        return {'success': true, 'message': 'Practice completed · $name'};
      default:
        throw ArgumentError('Unknown practice session action: $action');
    }
  }

  static Map<String, dynamic> performSopAction({
    required String sopId,
    required String action,
  }) {
    final module = _find(_sop, sopId);
    if (module == null) {
      throw ArgumentError('SOP training module not found');
    }

    final name = module['moduleName'] as String;

    switch (action) {
      case 'start_training':
        module['status'] = 'in_progress';
        module['completionPercent'] =
            (module['completionPercent'] as int) + 10;
        _sessionsToday++;
        return {'success': true, 'message': 'SOP training started · $name'};
      case 'assign_staff':
        module['assigneeCount'] = (module['assigneeCount'] as int) + 1;
        module['status'] = 'assigned';
        return {'success': true, 'message': 'Staff assigned · $name'};
      case 'mark_complete':
        module['status'] = 'completed';
        module['completionPercent'] = 100;
        _sessionsToday++;
        return {'success': true, 'message': 'SOP module completed · $name'};
      default:
        throw ArgumentError('Unknown SOP training action: $action');
    }
  }

  static Map<String, dynamic> performSimulationAction({
    required String simulationId,
    required String action,
  }) {
    final simulation = _find(_simulations, simulationId);
    if (simulation == null) {
      throw ArgumentError('Kitchen simulation not found');
    }

    final name = simulation['simulationName'] as String;

    switch (action) {
      case 'run_simulation':
        simulation['status'] = 'running';
        _sessionsToday++;
        return {'success': true, 'message': 'Simulation running · $name'};
      case 'pause_simulation':
        simulation['status'] = 'paused';
        return {'success': true, 'message': 'Simulation paused · $name'};
      case 'reset_simulation':
        simulation['status'] = 'ready';
        return {'success': true, 'message': 'Simulation reset · $name'};
      default:
        throw ArgumentError('Unknown kitchen simulation action: $action');
    }
  }

  static Map<String, dynamic> launchAll() {
    for (final demo in _demos) {
      if (demo['status'] == 'idle') {
        demo['status'] = 'active';
      }
    }
    for (final session in _practice) {
      if (session['status'] == 'scheduled') {
        session['status'] = 'in_progress';
      }
    }
    _sessionsToday += 4;
    return {
      'success': true,
      'message': 'Sandbox training launched · all modes activated',
    };
  }

  static int get sessionsToday => _sessionsToday;

  static List<Map<String, dynamic>> _filterSection(
    List<Map<String, dynamic>> items,
    String section,
  ) {
    if (section == 'All') {
      return items;
    }
    return items.where((item) => item['section'] == section).toList();
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

  static Map<String, dynamic> _serializeDemo(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'environmentName': item['environmentName'],
      'section': item['section'],
      'simulatedOrders': item['simulatedOrders'],
      'scenarioLabel': item['scenarioLabel'],
      'status': item['status'],
      'availableActions': const ['launch_demo', 'reset_demo', 'extend_demo'],
    };
  }

  static Map<String, dynamic> _serializePractice(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'sessionName': item['sessionName'],
      'section': item['section'],
      'traineeName': item['traineeName'],
      'roleLabel': item['roleLabel'],
      'status': item['status'],
      'availableActions': const [
        'start_practice',
        'pause_practice',
        'complete_practice',
      ],
    };
  }

  static Map<String, dynamic> _serializeSop(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'moduleName': item['moduleName'],
      'section': item['section'],
      'completionPercent': item['completionPercent'],
      'assigneeCount': item['assigneeCount'],
      'status': item['status'],
      'availableActions': const [
        'start_training',
        'assign_staff',
        'mark_complete',
      ],
    };
  }

  static Map<String, dynamic> _serializeSimulation(Map<String, dynamic> item) {
    return {
      'id': item['id'],
      'simulationName': item['simulationName'],
      'section': item['section'],
      'difficulty': item['difficulty'],
      'durationLabel': item['durationLabel'],
      'status': item['status'],
      'availableActions': const [
        'run_simulation',
        'pause_simulation',
        'reset_simulation',
      ],
    };
  }

  static List<Map<String, dynamic>> _seedDemos() {
    return [
      {
        'id': 'SB-DMO-001',
        'environmentName': 'Lunch rush demo kitchen',
        'section': 'Main',
        'simulatedOrders': 14,
        'scenarioLabel': 'Peak lunch · 148 covers',
        'status': 'active',
      },
      {
        'id': 'SB-DMO-002',
        'environmentName': 'Banquet service demo',
        'section': 'Continental',
        'simulatedOrders': 0,
        'scenarioLabel': '86-cover banquet',
        'status': 'idle',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedPractice() {
    return [
      {
        'id': 'SB-PRC-001',
        'sessionName': 'New expeditor onboarding',
        'section': 'Main',
        'traineeName': 'Priya Sharma',
        'roleLabel': 'Expeditor',
        'status': 'in_progress',
      },
      {
        'id': 'SB-PRC-002',
        'sessionName': 'Tandoor station drill',
        'section': 'Tandoor',
        'traineeName': 'Arjun Patel',
        'roleLabel': 'Line cook',
        'status': 'scheduled',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSop() {
    return [
      {
        'id': 'SB-SOP-001',
        'moduleName': 'Allergen handling SOP v3',
        'section': 'Main',
        'completionPercent': 78,
        'assigneeCount': 6,
        'status': 'in_progress',
      },
      {
        'id': 'SB-SOP-002',
        'moduleName': 'Fire safety walkthrough',
        'section': 'Main',
        'completionPercent': 0,
        'assigneeCount': 0,
        'status': 'pending',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSimulations() {
    return [
      {
        'id': 'SB-SIM-001',
        'simulationName': 'Rush hour · 148 covers',
        'section': 'Main',
        'difficulty': 'high',
        'durationLabel': '45 min',
        'status': 'ready',
      },
      {
        'id': 'SB-SIM-002',
        'simulationName': 'Equipment failure drill',
        'section': 'Main',
        'difficulty': 'critical',
        'durationLabel': '20 min',
        'status': 'running',
      },
    ];
  }
}

class MockSandboxTrainingEngine {
  const MockSandboxTrainingEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final demoKitchens = MockSandboxTrainingRegistry.demosFor(section);
    final practiceSessions = MockSandboxTrainingRegistry.practiceFor(section);
    final sopTrainings = MockSandboxTrainingRegistry.sopFor(section);
    final kitchenSimulations =
        MockSandboxTrainingRegistry.simulationsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'demoKitchens': demoKitchens,
      'practiceSessions': practiceSessions,
      'sopTrainings': sopTrainings,
      'kitchenSimulations': kitchenSimulations,
      'stats': {
        'activeDemos':
            demoKitchens.where((item) => item['status'] == 'active').length,
        'practiceInProgress': practiceSessions
            .where((item) => item['status'] == 'in_progress')
            .length,
        'sopModulesPending':
            sopTrainings.where((item) => item['status'] == 'pending').length,
        'simulationsReady': kitchenSimulations
            .where((item) => item['status'] == 'ready')
            .length,
        'traineesActive': practiceSessions
            .where((item) =>
                item['status'] == 'in_progress' ||
                item['status'] == 'scheduled')
            .length,
        'sessionsToday': MockSandboxTrainingRegistry.sessionsToday,
      },
      'trainingFeatures': {
        'demoKitchen': demoKitchens.isNotEmpty,
        'staffPracticeMode': practiceSessions.isNotEmpty,
        'sopTraining': sopTrainings.isNotEmpty,
        'kitchenSimulations': kitchenSimulations.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
