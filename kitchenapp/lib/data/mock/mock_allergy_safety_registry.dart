import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockAllergySafetyRegistry {
  MockAllergySafetyRegistry._();

  static const allergyTypes = [
    'Nut allergy',
    'Dairy allergy',
    'Gluten allergy',
    'Seafood allergy',
    'Egg allergy',
  ];

  static final Map<String, Map<String, dynamic>> _caseState = {};

  static List<Map<String, dynamic>> casesFor(String section) {
    final orders = MockOrderStore.activeOrders(section);
    return orders
        .where(_isSafetyRelevant)
        .map(_serializeCase)
        .toList();
  }

  static Map<String, dynamic>? findCase(String caseId) {
    final orderId = caseId.replaceFirst('SAFE-', '');
    final order = MockOrderStore.findById(orderId);
    if (order == null || !_isSafetyRelevant(order)) {
      return null;
    }
    return _serializeCase(order);
  }

  static Map<String, dynamic> performAction(String caseId, String action) {
    final orderId = caseId.replaceFirst('SAFE-', '');
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      throw ArgumentError('Safety case not found');
    }

    final state = _stateFor(caseId);
    switch (action) {
      case 'confirm_chef':
        state['chefConfirmed'] = true;
      case 'acknowledge_sop':
        state['sopAcknowledged'] = true;
      case 'mark_contained':
        state['status'] = 'contained';
        state['crossContaminationRisk'] = false;
      case 'clear_case':
        state['status'] = 'cleared';
      case 'escalate':
        state['escalated'] = true;
        state['severity'] = 'critical';
      default:
        throw ArgumentError('Unknown safety action: $action');
    }
    state['updatedAt'] = DateTime.now().toIso8601String();
    return _serializeCase(order);
  }

  static bool _isSafetyRelevant(Map<String, dynamic> order) {
    if (order['allergy'] == true) {
      return true;
    }
    final modifiers = (order['modifiers'] as List<dynamic>)
        .map((item) => item.toString().toLowerCase())
        .join(' ');
    return modifiers.contains('allergy') ||
        modifiers.contains('nut') ||
        modifiers.contains('seafood') ||
        modifiers.contains('dairy') ||
        modifiers.contains('gluten') ||
        modifiers.contains('egg');
  }

  static Map<String, dynamic> _stateFor(String caseId) {
    return _caseState.putIfAbsent(
      caseId,
      () => {
        'chefConfirmed': false,
        'sopAcknowledged': false,
        'status': 'active',
        'crossContaminationRisk': true,
        'escalated': false,
        'severity': 'high',
        'updatedAt': DateTime.now().toIso8601String(),
      },
    );
  }

  static List<String> _detectAllergyTypes(Map<String, dynamic> order) {
    final text = [
      ...(order['modifiers'] as List<dynamic>).map((item) => item.toString()),
      ...(order['cookingNotes'] as List<dynamic>).map((item) => item.toString()),
    ].join(' ').toLowerCase();

    final types = <String>[];
    if (text.contains('nut')) {
      types.add('Nut allergy');
    }
    if (text.contains('dairy') || text.contains('milk')) {
      types.add('Dairy allergy');
    }
    if (text.contains('gluten')) {
      types.add('Gluten allergy');
    }
    if (text.contains('seafood') || text.contains('fish')) {
      types.add('Seafood allergy');
    }
    if (text.contains('egg')) {
      types.add('Egg allergy');
    }
    if (types.isEmpty && order['allergy'] == true) {
      types.add('Nut allergy');
    }
    return types;
  }

  static Map<String, dynamic> _colorForTypes(List<String> types) {
    if (types.contains('Nut allergy') || types.contains('Seafood allergy')) {
      return {'colorCode': 'danger', 'severity': 'critical'};
    }
    if (types.contains('Dairy allergy') || types.contains('Egg allergy')) {
      return {'colorCode': 'warning', 'severity': 'high'};
    }
    return {'colorCode': 'info', 'severity': 'medium'};
  }

  static List<String> _warningsFor(
    Map<String, dynamic> order,
    List<String> types,
    Map<String, dynamic> state,
  ) {
    final warnings = <String>[];
    if (state['crossContaminationRisk'] == true) {
      warnings.add(
        'Cross contamination warning · ${order['section']} shared equipment',
      );
    }
    if (types.isNotEmpty) {
      warnings.add('Dedicated prep lane required · ${types.join(', ')}');
    }
    warnings.add('Safety SOP · allergy kit + supervisor verification');
    if (order['vip'] == true) {
      warnings.add('VIP guest · elevated safety protocol');
    }
    if (state['escalated'] == true) {
      warnings.add('Escalated · head chef notified');
    }
    return warnings.take(4).toList();
  }

  static List<String> _availableActions(Map<String, dynamic> serialized) {
    final actions = <String>[];
    if (serialized['chefConfirmed'] != true) {
      actions.add('confirm_chef');
    }
    if (serialized['sopAcknowledged'] != true) {
      actions.add('acknowledge_sop');
    }
    if (serialized['status'] == 'active') {
      actions.add('mark_contained');
      actions.add('escalate');
    }
    if (serialized['status'] != 'cleared') {
      actions.add('clear_case');
    }
    return actions;
  }

  static Map<String, dynamic> _serializeCase(Map<String, dynamic> order) {
    final caseId = 'SAFE-${order['id']}';
    final state = _stateFor(caseId);
    final types = _detectAllergyTypes(order);
    final colorMeta = _colorForTypes(types);
    if (state['severity'] != 'critical') {
      state['severity'] = colorMeta['severity'];
    }

    final serialized = {
      'id': caseId,
      'orderId': order['id'],
      'kotNumber': order['kotNumber'],
      'location': order['location'],
      'section': order['section'],
      'assignedChef': order['assignedChef'],
      'status': state['status'],
      'statusLabel': _statusLabel(state['status'] as String),
      'allergyTypes': types,
      'severity': state['severity'],
      'colorCode': colorMeta['colorCode'],
      'crossContaminationRisk': state['crossContaminationRisk'],
      'dedicatedPrepRequired': true,
      'chefConfirmed': state['chefConfirmed'],
      'sopAcknowledged': state['sopAcknowledged'],
      'escalated': state['escalated'],
      'vip': order['vip'],
      'items': order['items'],
      'warnings': _warningsFor(order, types, state),
    };
    serialized['availableActions'] = _availableActions(serialized);
    return serialized;
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'active' => 'Active alert',
      'contained' => 'Risk contained',
      'cleared' => 'Cleared',
      _ => status,
    };
  }
}

class MockAllergySafetyEngine {
  const MockAllergySafetyEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final cases = MockAllergySafetyRegistry.casesFor(section);
    final active = cases.where((item) => item['status'] == 'active').length;
    final pendingChef =
        cases.where((item) => item['chefConfirmed'] != true).length;
    final pendingSop =
        cases.where((item) => item['sopAcknowledged'] != true).length;
    final crossRisk = cases
        .where((item) => item['crossContaminationRisk'] == true)
        .length;
    final critical =
        cases.where((item) => item['severity'] == 'critical').length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'cases': cases,
      'allergyTypes': MockAllergySafetyRegistry.allergyTypes,
      'stats': {
        'totalCases': cases.length,
        'activeCases': active,
        'pendingChefConfirm': pendingChef,
        'pendingSopAck': pendingSop,
        'crossContaminationAlerts': crossRisk,
        'criticalCases': critical,
      },
      'safetyFeatures': {
        'allergyColorCoding': true,
        'mandatoryChefConfirmation': pendingChef > 0,
        'crossContaminationWarnings': crossRisk > 0,
        'dedicatedPrepWarnings': cases.isNotEmpty,
        'safetySopReminders': pendingSop > 0,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> performAction(String caseId, String action) {
    final updated = MockAllergySafetyRegistry.performAction(caseId, action);
    return {
      'success': true,
      'case': updated,
    };
  }
}
