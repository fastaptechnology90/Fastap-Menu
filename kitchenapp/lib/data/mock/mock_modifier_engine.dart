import 'mock_modifier_registry.dart';
import 'mock_section_registry.dart';

class MockModifierEngine {
  const MockModifierEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final orders = MockModifierRegistry.ordersFor(section);
    final totalModifiers = orders.fold<int>(
      0,
      (sum, order) => sum + ((order['stats'] as Map)['totalModifiers'] as int),
    );
    final pendingAck = orders.fold<int>(
      0,
      (sum, order) =>
          sum + ((order['stats'] as Map)['pendingAcknowledgment'] as int),
    );
    final pendingChef = orders.fold<int>(
      0,
      (sum, order) =>
          sum + ((order['stats'] as Map)['pendingChefConfirm'] as int),
    );
    final flashAlerts = orders.fold<int>(
      0,
      (sum, order) => sum + ((order['stats'] as Map)['flashAlerts'] as int),
    );
    final allergyOrders = orders.where((order) => order['allergy'] == true).length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'orders': orders,
      'catalog': MockModifierRegistry.modifierCatalog
          .map(
            (label) => {
              'label': label,
              'type': _catalogType(label),
            },
          )
          .toList(),
      'stats': {
        'ordersWithModifiers': orders.length,
        'totalModifiers': totalModifiers,
        'pendingAcknowledgment': pendingAck,
        'pendingChefConfirm': pendingChef,
        'flashAlerts': flashAlerts,
        'allergyOrders': allergyOrders,
      },
      'smartAlerts': {
        'allergyFlashingAlerts': flashAlerts > 0,
        'priorityModifiers': pendingChef > 0,
        'chefConfirmationRequired': pendingChef > 0,
        'acknowledgmentTracking': pendingAck > 0,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static Map<String, dynamic> performAction(
    String orderId,
    String action, {
    String? modifierId,
    String? modifierType,
    String? itemName,
    String? replacement,
  }) {
    var resolvedAction = action;
    String? resolvedModifierId = modifierId;

    if (action.startsWith('acknowledge:')) {
      resolvedAction = 'acknowledge';
      resolvedModifierId = action.split(':').last;
    } else if (action.startsWith('confirm_chef:')) {
      resolvedAction = 'confirm_chef';
      resolvedModifierId = action.split(':').last;
    }

    final updated = MockModifierRegistry.performAction(
      orderId,
      resolvedAction,
      modifierId: resolvedModifierId,
      modifierType: modifierType,
      itemName: itemName,
      replacement: replacement,
    );
    return {
      'success': true,
      'order': updated,
    };
  }

  static String _catalogType(String label) {
    final lower = label.toLowerCase();
    if (lower.contains('allergy')) {
      return 'allergy';
    }
    if (lower.contains('jain') ||
        lower.contains('no onion') ||
        lower.contains('no garlic')) {
      return 'dietary';
    }
    if (lower.contains('half') || lower.contains('side')) {
      return 'customization';
    }
    return 'preference';
  }
}
