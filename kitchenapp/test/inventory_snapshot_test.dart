import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/inventory/inventory_snapshot.dart';

void main() {
  test('inventory snapshot parses API payload', () {
    final snapshot = InventorySnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Main'],
      'items': [
        {
          'id': 'ING-002',
          'name': 'Fresh basil',
          'section': 'Salad',
          'unit': 'kg',
          'onHand': 0.8,
          'reserved': 0,
          'minLevel': 1.5,
          'batchId': 'BATCH-BAS-0601',
          'expiryDays': 2,
          'deductedToday': 0,
          'status': 'low',
        },
      ],
      'batches': [
        {
          'id': 'BATCH-BAS-0601',
          'itemId': 'ING-002',
          'itemName': 'Fresh basil',
          'section': 'Salad',
          'quantity': 0.8,
          'unit': 'kg',
          'expiryAt': '2026-06-08T12:00:00.000',
          'expiryDays': 2,
          'status': 'expiring_soon',
        },
      ],
      'alerts': [
        {
          'id': 'ING-002-ALERT',
          'type': 'ingredient',
          'title': 'Ingredient alert',
          'detail': 'Fresh basil below par',
          'itemId': 'ING-002',
          'section': 'Salad',
          'severity': 'high',
          'status': 'open',
          'availableActions': ['acknowledge', 'resolve'],
          'createdAt': '2026-06-06T11:20:00.000',
        },
      ],
      'substitutions': [
        {
          'id': 'SUB-001',
          'itemId': 'ING-002',
          'itemName': 'Fresh basil',
          'substituteId': 'ING-006',
          'substituteName': 'Spinach garnish',
          'section': 'Salad',
          'reason': 'Basil shortage',
          'confidence': 0.86,
        },
      ],
      'deductions': [],
      'shortagePredictions': [
        {
          'itemId': 'ING-002',
          'itemName': 'Fresh basil',
          'predictedShortageHours': 4,
          'confidence': 0.91,
        },
      ],
      'stats': {
        'totalItems': 1,
        'lowStock': 1,
        'expiringBatches': 1,
        'openAlerts': 1,
        'deductionsToday': 0,
      },
      'inventoryFeatures': {
        'liveIngredientDeduction': true,
        'stockValidation': true,
        'ingredientAlerts': true,
        'lowStockAlerts': true,
        'batchTracking': true,
        'expiryTracking': true,
        'autoStockSynchronization': true,
        'aiShortagePrediction': true,
        'ingredientSubstitutionSuggestions': true,
        'recipeStockValidation': true,
      },
    });

    expect(snapshot.items.first.status, 'low');
    expect(snapshot.stats.lowStock, 1);
    expect(snapshot.inventoryFeatures.batchTracking, isTrue);
    expect(snapshot.substitutions.first.substituteName, 'Spinach garnish');
  });
}
