import 'package:flutter_test/flutter_test.dart';

import 'package:kitchenapp/models/batch_cooking/batch_cooking_snapshot.dart';

void main() {
  test('batch cooking snapshot parses API payload', () {
    final snapshot = BatchCookingSnapshot.fromJson({
      'section': 'All',
      'lastSyncedAt': '2026-06-06T12:00:00.000',
      'sections': ['All', 'Tandoor'],
      'batches': [
        {
          'id': 'BCH-001',
          'name': 'Butter naan batch · 18 pcs',
          'section': 'Tandoor',
          'quantity': 18,
          'remainingQuantity': 18,
          'unit': 'pcs',
          'status': 'cooking',
          'statusLabel': 'Cooking',
          'timerSeconds': 540,
          'timerLabel': '09:00',
          'expiryMinutes': 45,
          'reuseCount': 0,
          'progress': 0.62,
          'availableActions': ['extend_timing', 'mark_ready'],
        },
      ],
      'forecasts': [
        {
          'id': 'FC-001',
          'section': 'Tandoor',
          'label': 'Naan rush window',
          'forecastCovers': 32,
          'recommendedBatchSize': 24,
          'startInMinutes': 22,
          'confidence': 0.87,
          'updatedAt': '2026-06-06T11:38:00.000',
        },
      ],
      'stats': {
        'totalBatches': 1,
        'cooking': 1,
        'ready': 0,
        'expiring': 0,
        'reused': 0,
        'forecastWindows': 1,
      },
      'batchFeatures': {
        'bulkPreparationTracking': true,
        'batchTiming': true,
        'batchExpiryTracking': false,
        'batchReuseTracking': false,
        'productionForecasting': true,
      },
    });

    expect(snapshot.batches.length, 1);
    expect(snapshot.batches.first.status, 'cooking');
    expect(snapshot.forecasts.first.recommendedBatchSize, 24);
    expect(snapshot.batchFeatures.productionForecasting, isTrue);
  });
}
