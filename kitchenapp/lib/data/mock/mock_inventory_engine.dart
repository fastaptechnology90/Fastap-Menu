import 'mock_order_store.dart';
import 'mock_section_registry.dart';

class MockInventoryRegistry {
  MockInventoryRegistry._();

  static final List<Map<String, dynamic>> _items = _seedItems();
  static final List<Map<String, dynamic>> _batches = _seedBatches();
  static final List<Map<String, dynamic>> _alerts = _seedAlerts();
  static final List<Map<String, dynamic>> _substitutions = _seedSubstitutions();
  static final List<Map<String, dynamic>> _deductions = <Map<String, dynamic>>[];

  static List<Map<String, dynamic>> itemsFor(String section) {
    if (section == 'All') {
      return _items.map(Map<String, dynamic>.from).toList();
    }
    return _items
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> batchesFor(String section) {
    if (section == 'All') {
      return _batches.map(Map<String, dynamic>.from).toList();
    }
    return _batches
        .where((batch) => batch['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> alertsFor(String section) {
    _refreshAlerts();
    final alerts = section == 'All'
        ? _alerts
        : _alerts.where((alert) => alert['section'] == section);
    return alerts.map(Map<String, dynamic>.from).toList();
  }

  static List<Map<String, dynamic>> substitutionsFor(String section) {
    if (section == 'All') {
      return _substitutions.map(Map<String, dynamic>.from).toList();
    }
    return _substitutions
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> recentDeductions({int limit = 6}) {
    return _deductions
        .take(limit)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic> syncStock() {
    for (final item in _items) {
      item['lastSyncedAt'] = DateTime.now().toIso8601String();
    }
    return {
      'success': true,
      'message': 'Auto stock synchronization complete · ledger updated',
    };
  }

  static Map<String, dynamic> deductIngredient({
    required String itemId,
    required double quantity,
    String? orderId,
  }) {
    final item = _findItem(itemId);
    if (item == null) {
      throw ArgumentError('Ingredient not found');
    }

    final onHand = (item['onHand'] as num).toDouble();
    if (quantity <= 0 || quantity > onHand) {
      throw ArgumentError('Invalid deduction quantity');
    }

    item['onHand'] = onHand - quantity;
    item['deductedToday'] = (item['deductedToday'] as num).toDouble() + quantity;
    item['status'] =
        (item['onHand'] as num).toDouble() <= (item['minLevel'] as num).toDouble()
            ? 'low'
            : 'healthy';
    _deductions.insert(0, {
      'id': 'DED-${DateTime.now().millisecondsSinceEpoch}',
      'itemId': itemId,
      'itemName': item['name'],
      'quantity': quantity,
      'unit': item['unit'],
      'orderId': orderId,
      'section': item['section'],
      'deductedAt': DateTime.now().toIso8601String(),
    });
    _refreshAlerts();

    return {
      'success': true,
      'message':
          'Live deduction · ${item['name']} -${quantity.toStringAsFixed(1)} ${item['unit']}',
    };
  }

  static Map<String, dynamic> validateRecipeStock({String? orderId}) {
    Map<String, dynamic>? order;
    if (orderId == null) {
      final active = MockOrderStore.activeOrders('All');
      if (active.isEmpty) {
        throw ArgumentError('No active order for validation');
      }
      order = active.first;
    } else {
      order = MockOrderStore.findById(orderId);
    }
    if (order == null) {
      throw ArgumentError('Order not found for validation');
    }

    final section = order['section'] as String;
    final lowItems = _items.where((item) {
      return item['section'] == section &&
          (item['onHand'] as num).toDouble() <= (item['minLevel'] as num).toDouble();
    }).toList();

    if (lowItems.isEmpty) {
      return {
        'success': true,
        'valid': true,
        'message': 'Recipe stock validation passed · ${order['kotNumber']}',
      };
    }

    return {
      'success': true,
      'valid': false,
      'message':
          'Recipe stock validation failed · ${lowItems.first['name']} below minimum',
    };
  }

  static Map<String, dynamic> applySubstitution({
    required String itemId,
    required String substituteId,
  }) {
    final item = _findItem(itemId);
    final substitute = _findItem(substituteId);
    if (item == null || substitute == null) {
      throw ArgumentError('Substitution items not found');
    }

    substitute['onHand'] =
        (substitute['onHand'] as num).toDouble() - 0.5;
    item['substitutionApplied'] = substitute['name'];

    return {
      'success': true,
      'message':
          'Substitution applied · ${item['name']} → ${substitute['name']}',
    };
  }

  static Map<String, dynamic> performAlertAction({
    required String alertId,
    required String action,
  }) {
    final alert = _alerts.cast<Map<String, dynamic>?>().firstWhere(
          (item) => item?['id'] == alertId,
          orElse: () => null,
        );
    if (alert == null) {
      throw ArgumentError('Inventory alert not found');
    }

    switch (action) {
      case 'acknowledge':
        alert['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Alert acknowledged · ${alert['title']}',
        };
      case 'resolve':
        _alerts.remove(alert);
        return {
          'success': true,
          'message': 'Alert resolved · ${alert['title']}',
        };
      default:
        throw ArgumentError('Unknown inventory alert action: $action');
    }
  }

  static Map<String, dynamic>? _findItem(String itemId) {
    for (final item in _items) {
      if (item['id'] == itemId) {
        return item;
      }
    }
    return null;
  }

  static void _refreshAlerts() {
    for (final item in _items) {
      final onHand = (item['onHand'] as num).toDouble();
      final minLevel = (item['minLevel'] as num).toDouble();
      if (onHand <= minLevel && !_hasAlert('LOW-${item['id']}')) {
        _alerts.insert(0, {
          'id': 'LOW-${item['id']}',
          'type': 'low_stock',
          'title': 'Low stock alert',
          'detail':
              '${item['name']} at ${onHand.toStringAsFixed(1)} ${item['unit']} · min ${minLevel.toStringAsFixed(1)}',
          'itemId': item['id'],
          'section': item['section'],
          'severity': onHand <= minLevel * 0.5 ? 'critical' : 'high',
          'status': 'open',
          'availableActions': ['acknowledge', 'resolve'],
          'createdAt': DateTime.now().toIso8601String(),
        });
      }
    }
  }

  static bool _hasAlert(String alertId) {
    return _alerts.any((alert) => alert['id'] == alertId);
  }

  static List<Map<String, dynamic>> _seedItems() {
    return [
      _item(
        id: 'ING-001',
        name: 'Butter',
        section: 'Bakery',
        unit: 'kg',
        onHand: 8.4,
        minLevel: 3.0,
        batchId: 'BATCH-BTR-0426',
        expiryDays: 12,
      ),
      _item(
        id: 'ING-002',
        name: 'Fresh basil',
        section: 'Salad',
        unit: 'kg',
        onHand: 0.8,
        minLevel: 1.5,
        batchId: 'BATCH-BAS-0601',
        expiryDays: 2,
      ),
      _item(
        id: 'ING-003',
        name: 'Dal makhani base',
        section: 'Main',
        unit: 'kg',
        onHand: 14.2,
        minLevel: 6.0,
        batchId: 'BATCH-DAL-0528',
        expiryDays: 4,
      ),
      _item(
        id: 'ING-004',
        name: 'Naan dough',
        section: 'Tandoor',
        unit: 'kg',
        onHand: 22.0,
        minLevel: 10.0,
        batchId: 'BATCH-NAAN-0603',
        expiryDays: 1,
      ),
      _item(
        id: 'ING-005',
        name: 'Hakka noodle packs',
        section: 'Chinese',
        unit: 'pcs',
        onHand: 46,
        minLevel: 20,
        batchId: 'BATCH-NOOD-0510',
        expiryDays: 45,
      ),
      _item(
        id: 'ING-006',
        name: 'Spinach garnish',
        section: 'Salad',
        unit: 'kg',
        onHand: 2.4,
        minLevel: 1.0,
        batchId: 'BATCH-SPN-0602',
        expiryDays: 5,
      ),
      _item(
        id: 'ING-007',
        name: 'Gulab jamun mix',
        section: 'Dessert',
        unit: 'kg',
        onHand: 5.6,
        minLevel: 2.0,
        batchId: 'BATCH-GJ-0520',
        expiryDays: 20,
      ),
    ];
  }

  static List<Map<String, dynamic>> _seedBatches() {
    return _items.map((item) {
      final expiryDays = item['expiryDays'] as int;
      return {
        'id': item['batchId'],
        'itemId': item['id'],
        'itemName': item['name'],
        'section': item['section'],
        'quantity': item['onHand'],
        'unit': item['unit'],
        'expiryAt': DateTime.now()
            .add(Duration(days: expiryDays))
            .toIso8601String(),
        'expiryDays': expiryDays,
        'status': expiryDays <= 2 ? 'expiring_soon' : 'active',
      };
    }).toList();
  }

  static List<Map<String, dynamic>> _seedAlerts() {
    return [
      {
        'id': 'EXP-004',
        'type': 'expiry',
        'title': 'Expiry tracking alert',
        'detail': 'Naan dough batch expires in 24h · prioritize tandoor service',
        'itemId': 'ING-004',
        'section': 'Tandoor',
        'severity': 'critical',
        'status': 'open',
        'availableActions': ['acknowledge', 'resolve'],
        'createdAt': DateTime.now()
            .subtract(const Duration(hours: 1))
            .toIso8601String(),
      },
      {
        'id': 'ING-002-ALERT',
        'type': 'ingredient',
        'title': 'Ingredient alert',
        'detail': 'Fresh basil below par · substitution suggested',
        'itemId': 'ING-002',
        'section': 'Salad',
        'severity': 'high',
        'status': 'open',
        'availableActions': ['acknowledge', 'resolve'],
        'createdAt': DateTime.now()
            .subtract(const Duration(minutes: 40))
            .toIso8601String(),
      },
    ];
  }

  static List<Map<String, dynamic>> _seedSubstitutions() {
    return [
      {
        'id': 'SUB-001',
        'itemId': 'ING-002',
        'itemName': 'Fresh basil',
        'substituteId': 'ING-006',
        'substituteName': 'Spinach garnish',
        'section': 'Salad',
        'reason': 'Basil shortage · maintain salad service',
        'confidence': 0.86,
      },
      {
        'id': 'SUB-002',
        'itemId': 'ING-004',
        'itemName': 'Naan dough',
        'substituteId': 'ING-001',
        'substituteName': 'Butter',
        'section': 'Tandoor',
        'reason': 'Batch expiry · adjust finish for rush naan',
        'confidence': 0.72,
      },
    ];
  }

  static Map<String, dynamic> _item({
    required String id,
    required String name,
    required String section,
    required String unit,
    required num onHand,
    required num minLevel,
    required String batchId,
    required int expiryDays,
  }) {
    return {
      'id': id,
      'name': name,
      'section': section,
      'unit': unit,
      'onHand': onHand,
      'reserved': 0,
      'minLevel': minLevel,
      'batchId': batchId,
      'expiryDays': expiryDays,
      'deductedToday': 0,
      'substitutionApplied': null,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'status': onHand <= minLevel ? 'low' : 'healthy',
    };
  }
}

class MockInventoryEngine {
  const MockInventoryEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final items = MockInventoryRegistry.itemsFor(section);
    final batches = MockInventoryRegistry.batchesFor(section);
    final alerts = MockInventoryRegistry.alertsFor(section);
    final substitutions = MockInventoryRegistry.substitutionsFor(section);
    final deductions = MockInventoryRegistry.recentDeductions();
    final lowStock = items.where((item) => item['status'] == 'low').length;
    final expiring = batches.where((b) => b['status'] == 'expiring_soon').length;

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'items': items,
      'batches': batches,
      'alerts': alerts,
      'substitutions': substitutions,
      'deductions': deductions,
      'shortagePredictions': _shortagePredictions(items),
      'stats': {
        'totalItems': items.length,
        'lowStock': lowStock,
        'expiringBatches': expiring,
        'openAlerts': alerts.where((a) => a['status'] == 'open').length,
        'deductionsToday': deductions.length,
      },
      'inventoryFeatures': {
        'liveIngredientDeduction': true,
        'stockValidation': true,
        'ingredientAlerts': alerts.any((a) => a['type'] == 'ingredient'),
        'lowStockAlerts': lowStock > 0,
        'batchTracking': batches.isNotEmpty,
        'expiryTracking': expiring > 0,
        'autoStockSynchronization': true,
        'aiShortagePrediction': items.any(
          (item) => (item['onHand'] as num) <= (item['minLevel'] as num) * 1.2,
        ),
        'ingredientSubstitutionSuggestions': substitutions.isNotEmpty,
        'recipeStockValidation': true,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }

  static List<Map<String, dynamic>> _shortagePredictions(
    List<Map<String, dynamic>> items,
  ) {
    return items
        .where(
          (item) =>
              (item['onHand'] as num).toDouble() <=
              (item['minLevel'] as num).toDouble() * 1.5,
        )
        .map(
          (item) => {
            'itemId': item['id'],
            'itemName': item['name'],
            'predictedShortageHours': item['status'] == 'low' ? 4 : 12,
            'confidence': item['status'] == 'low' ? 0.91 : 0.78,
          },
        )
        .take(4)
        .toList();
  }
}
