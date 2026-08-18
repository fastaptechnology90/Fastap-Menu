import 'mock_order_store.dart';

class MockModifierRegistry {
  MockModifierRegistry._();

  static const modifierCatalog = [
    'Extra spicy',
    'No onion',
    'No garlic',
    'Jain preparation',
    'Allergy modifiers',
    'Extra cheese',
    'Half-half customization',
    'Side replacement',
  ];

  static final Map<String, Map<String, dynamic>> _modifierState = {};

  static List<Map<String, dynamic>> ordersFor(String section) {
    final orders = MockOrderStore.activeOrders(section);
    return orders
        .where(_hasModifierContent)
        .map(_serializeOrder)
        .toList();
  }

  static Map<String, dynamic>? findOrder(String orderId) {
    final order = MockOrderStore.findById(orderId);
    if (order == null || !_hasModifierContent(order)) {
      return null;
    }
    return _serializeOrder(order);
  }

  static Map<String, dynamic> performAction(
    String orderId,
    String action, {
    String? modifierId,
    String? modifierType,
    String? itemName,
    String? replacement,
  }) {
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      throw ArgumentError('Order not found');
    }

    final state = _stateFor(orderId);

    switch (action) {
      case 'acknowledge':
        _acknowledge(orderId, modifierId);
      case 'acknowledge_all':
        _acknowledgeAll(orderId);
      case 'confirm_chef':
        _confirmChef(orderId, modifierId);
      case 'apply_modifier':
        _applyModifier(order, modifierType ?? '');
      case 'replace_side':
        _replaceSide(order, itemName, replacement);
      default:
        throw ArgumentError('Unknown modifier action: $action');
    }

    state['updatedAt'] = DateTime.now().toIso8601String();
    return _serializeOrder(order);
  }

  static bool _hasModifierContent(Map<String, dynamic> order) {
    final modifiers = order['modifiers'] as List<dynamic>;
    final modified = order['modifiedItems'] as Map<String, dynamic>? ?? {};
    return order['allergy'] == true ||
        modifiers.isNotEmpty ||
        modified.isNotEmpty;
  }

  static Map<String, dynamic> _stateFor(String orderId) {
    return _modifierState.putIfAbsent(
      orderId,
      () => {
        'acknowledged': <String>[],
        'chefConfirmed': <String>[],
        'updatedAt': DateTime.now().toIso8601String(),
      },
    );
  }

  static void _acknowledge(String orderId, String? modifierId) {
    final state = _stateFor(orderId);
    final acknowledged = List<String>.from(state['acknowledged'] as List);
    if (modifierId != null && !acknowledged.contains(modifierId)) {
      acknowledged.add(modifierId);
    }
    state['acknowledged'] = acknowledged;
  }

  static void _acknowledgeAll(String orderId) {
    final order = MockOrderStore.findById(orderId);
    if (order == null) {
      return;
    }
    final entries = _entriesFor(order);
    final state = _stateFor(orderId);
    state['acknowledged'] = entries.map((entry) => entry['id'] as String).toList();
  }

  static void _confirmChef(String orderId, String? modifierId) {
    final state = _stateFor(orderId);
    final confirmed = List<String>.from(state['chefConfirmed'] as List);
    if (modifierId != null && !confirmed.contains(modifierId)) {
      confirmed.add(modifierId);
    }
    state['chefConfirmed'] = confirmed;
    _acknowledge(orderId, modifierId);
  }

  static void _applyModifier(Map<String, dynamic> order, String modifierType) {
    if (modifierType.isEmpty) {
      throw ArgumentError('Modifier type required');
    }
    final label = _labelForType(modifierType);
    final modifiers = List<String>.from(order['modifiers'] as List<dynamic>);
    if (!modifiers.contains(label)) {
      modifiers.add(label);
    }
    order['modifiers'] = modifiers;
    if (modifierType == 'allergy_modifiers') {
      order['allergy'] = true;
    }
  }

  static void _replaceSide(
    Map<String, dynamic> order,
    String? itemName,
    String? replacement,
  ) {
    if (itemName == null || replacement == null || itemName.isEmpty) {
      throw ArgumentError('Item and replacement required');
    }
    final modified = Map<String, dynamic>.from(
      order['modifiedItems'] as Map<String, dynamic>? ?? {},
    );
    modified[itemName] = 'Side replaced · $replacement';
    order['modifiedItems'] = modified;
  }

  static String _labelForType(String type) {
    return switch (type) {
      'extra_spicy' => 'Extra spicy',
      'no_onion' => 'No onion',
      'no_garlic' => 'No garlic',
      'jain_preparation' => 'Jain preparation',
      'allergy_modifiers' => 'Allergy modifiers',
      'extra_cheese' => 'Extra cheese',
      'half_half' => 'Half-half customization',
      'side_replacement' => 'Side replacement',
      _ => type,
    };
  }

  static List<Map<String, dynamic>> _entriesFor(Map<String, dynamic> order) {
    final orderId = order['id'] as String;
    final state = _stateFor(orderId);
    final acknowledged = (state['acknowledged'] as List).cast<String>();
    final chefConfirmed = (state['chefConfirmed'] as List).cast<String>();

    final entries = <Map<String, dynamic>>[];
    var index = 0;
    for (final raw in order['modifiers'] as List<dynamic>) {
      final label = raw.toString();
      final meta = _classifyModifier(label, order['allergy'] == true);
      final id = 'MOD-$orderId-$index';
      entries.add({
        'id': id,
        'label': label,
        'type': meta['type'],
        'category': meta['category'],
        'priority': meta['priority'],
        'flashAlert': meta['flashAlert'],
        'requiresChefConfirm': meta['requiresChefConfirm'],
        'acknowledged': acknowledged.contains(id),
        'chefConfirmed': chefConfirmed.contains(id),
      });
      index++;
    }

    if (order['allergy'] == true &&
        !entries.any((entry) => entry['type'] == 'allergy')) {
      final id = 'MOD-$orderId-ALLERGY';
      entries.insert(0, {
        'id': id,
        'label': 'Allergy protocol active',
        'type': 'allergy',
        'category': 'Allergy modifiers',
        'priority': 'critical',
        'flashAlert': true,
        'requiresChefConfirm': true,
        'acknowledged': acknowledged.contains(id),
        'chefConfirmed': chefConfirmed.contains(id),
      });
    }

    return entries;
  }

  static Map<String, dynamic> _classifyModifier(String label, bool orderAllergy) {
    final lower = label.toLowerCase();
    if (orderAllergy ||
        lower.contains('allergy') ||
        lower.contains('nut') ||
        lower.contains('seafood')) {
      return {
        'type': 'allergy',
        'category': 'Allergy modifiers',
        'priority': 'critical',
        'flashAlert': true,
        'requiresChefConfirm': true,
      };
    }
    if (lower.contains('jain') ||
        lower.contains('no onion') ||
        lower.contains('no garlic')) {
      return {
        'type': 'dietary',
        'category': 'Dietary customization',
        'priority': 'high',
        'flashAlert': false,
        'requiresChefConfirm': true,
      };
    }
    if (lower.contains('extra spicy') || lower.contains('extra cheese')) {
      return {
        'type': 'preference',
        'category': 'Preference modifier',
        'priority': 'normal',
        'flashAlert': false,
        'requiresChefConfirm': false,
      };
    }
    if (lower.contains('half') || lower.contains('side')) {
      return {
        'type': 'customization',
        'category': 'Customization',
        'priority': 'high',
        'flashAlert': false,
        'requiresChefConfirm': false,
      };
    }
    return {
      'type': 'general',
      'category': 'Modifier',
      'priority': 'normal',
      'flashAlert': false,
      'requiresChefConfirm': false,
    };
  }

  static List<Map<String, dynamic>> _customizationsFor(
    Map<String, dynamic> order,
  ) {
    final modified = order['modifiedItems'] as Map<String, dynamic>? ?? {};
    return modified.entries
        .map(
          (entry) => {
            'item': entry.key,
            'label': entry.value,
            'type': 'item_modification',
          },
        )
        .toList();
  }

  static List<String> _availableActions(Map<String, dynamic> serialized) {
    final entries = serialized['modifiers'] as List<dynamic>;
    final actions = <String>['apply_modifier'];

    final pendingAck = entries.any(
      (entry) => (entry as Map)['acknowledged'] != true,
    );
    if (pendingAck) {
      actions.add('acknowledge_all');
    }

    for (final raw in entries) {
      final entry = raw as Map<String, dynamic>;
      if (entry['acknowledged'] != true) {
        actions.add('acknowledge:${entry['id']}');
      }
      if (entry['requiresChefConfirm'] == true && entry['chefConfirmed'] != true) {
        actions.add('confirm_chef:${entry['id']}');
      }
    }

    if ((serialized['customizations'] as List).isNotEmpty) {
      actions.add('replace_side');
    }

    return actions.toSet().toList();
  }

  static Map<String, dynamic> _serializeOrder(Map<String, dynamic> order) {
    final entries = _entriesFor(order);
    final customizations = _customizationsFor(order);
    final pendingChef = entries
        .where(
          (entry) =>
              entry['requiresChefConfirm'] == true &&
              entry['chefConfirmed'] != true,
        )
        .length;
    final pendingAck = entries.where((entry) => entry['acknowledged'] != true).length;
    final flashAlerts = entries.where((entry) => entry['flashAlert'] == true).length;

    final serialized = {
      'orderId': order['id'],
      'kotNumber': order['kotNumber'],
      'location': order['location'],
      'section': order['section'],
      'category': order['category'],
      'status': order['status'],
      'vip': order['vip'],
      'allergy': order['allergy'],
      'items': order['items'],
      'modifiers': entries,
      'customizations': customizations,
      'stats': {
        'totalModifiers': entries.length,
        'pendingAcknowledgment': pendingAck,
        'pendingChefConfirm': pendingChef,
        'flashAlerts': flashAlerts,
      },
    };
    serialized['availableActions'] = _availableActions(serialized);
    return serialized;
  }
}
