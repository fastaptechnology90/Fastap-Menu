import 'mock_section_registry.dart';

class MockBatchCookingRegistry {
  MockBatchCookingRegistry._();

  static final List<Map<String, dynamic>> _batches = _seedBatches();
  static final List<Map<String, dynamic>> _forecasts = _seedForecasts();

  static List<Map<String, dynamic>> batchesFor(String section) {
    if (section == 'All') {
      return _batches.map(Map<String, dynamic>.from).toList();
    }
    return _batches
        .where((batch) => batch['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> forecastsFor(String section) {
    if (section == 'All') {
      return _forecasts.map(Map<String, dynamic>.from).toList();
    }
    return _forecasts
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic>? findById(String batchId) {
    for (final batch in _batches) {
      if (batch['id'] == batchId) {
        return batch;
      }
    }
    return null;
  }

  static List<String> availableActions(Map<String, dynamic> batch) {
    final status = batch['status'] as String;
    final actions = <String>[];

    if (status == 'planned') {
      actions.add('start_batch');
    }
    if (status == 'cooking') {
      actions.addAll(['extend_timing', 'mark_ready']);
    }
    if (status == 'ready') {
      actions.addAll(['mark_reuse', 'consume_batch']);
    }
    if (status == 'expiring') {
      actions.addAll(['mark_reuse', 'dispose_expired']);
    }
    if ((batch['reuseCount'] as int) > 0) {
      actions.add('log_reuse');
    }

    return actions;
  }

  static Map<String, dynamic> refreshForecast() {
    for (final forecast in _forecasts) {
      forecast['updatedAt'] = DateTime.now().toIso8601String();
      forecast['confidence'] =
          ((forecast['confidence'] as num).toDouble() + 0.02).clamp(0.0, 0.99);
    }
    return {
      'success': true,
      'message': 'Production forecasting refreshed · next batch windows updated',
    };
  }

  static Map<String, dynamic> performAction({
    required String batchId,
    required String action,
  }) {
    final batch = findById(batchId);
    if (batch == null) {
      throw ArgumentError('Batch not found');
    }

    switch (action) {
      case 'start_batch':
        batch['status'] = 'cooking';
        batch['timerSeconds'] = 0;
        batch['startedAt'] = DateTime.now().toIso8601String();
        return {
          'success': true,
          'message': 'Batch started · ${batch['name']}',
        };
      case 'extend_timing':
        batch['expiryMinutes'] = (batch['expiryMinutes'] as int) + 15;
        return {
          'success': true,
          'message': 'Batch timing extended · ${batch['name']} +15 min',
        };
      case 'mark_ready':
        batch['status'] = 'ready';
        batch['progress'] = 1.0;
        return {
          'success': true,
          'message': 'Batch ready · ${batch['name']}',
        };
      case 'mark_reuse':
        batch['reuseCount'] = (batch['reuseCount'] as int) + 1;
        batch['status'] = 'reused';
        return {
          'success': true,
          'message': 'Batch reuse logged · ${batch['name']}',
        };
      case 'consume_batch':
        batch['remainingQuantity'] =
            ((batch['remainingQuantity'] as num).toDouble() - 10).clamp(0, 9999);
        batch['status'] = 'consumed';
        return {
          'success': true,
          'message': 'Batch consumed · ${batch['name']}',
        };
      case 'dispose_expired':
        batch['status'] = 'disposed';
        batch['remainingQuantity'] = 0;
        return {
          'success': true,
          'message': 'Expired batch disposed · ${batch['name']}',
        };
      case 'log_reuse':
        batch['reuseCount'] = (batch['reuseCount'] as int) + 1;
        return {
          'success': true,
          'message': 'Reuse event recorded · ${batch['name']}',
        };
      default:
        throw ArgumentError('Unknown batch action: $action');
    }
  }

  static void tickTimers() {
    for (final batch in _batches) {
      if (batch['status'] == 'cooking') {
        batch['timerSeconds'] = (batch['timerSeconds'] as int) + 1;
        final progress = (batch['progress'] as num).toDouble();
        if (progress < 0.98) {
          batch['progress'] = (progress + 0.01).clamp(0.0, 0.98);
        }
      }

      final expiry = batch['expiryMinutes'] as int;
      if (expiry <= 20 && batch['status'] == 'ready') {
        batch['status'] = 'expiring';
      }
    }
  }

  static List<Map<String, dynamic>> _seedBatches() {
    return [
      _batch(
        id: 'BCH-001',
        name: 'Butter naan batch · 18 pcs',
        section: 'Tandoor',
        quantity: 18,
        unit: 'pcs',
        status: 'cooking',
        timerSeconds: 540,
        expiryMinutes: 45,
        reuseCount: 0,
        progress: 0.62,
      ),
      _batch(
        id: 'BCH-002',
        name: 'Dal makhani bulk · 8 kg',
        section: 'Main',
        quantity: 8,
        unit: 'kg',
        status: 'ready',
        timerSeconds: 0,
        expiryMinutes: 90,
        reuseCount: 1,
        progress: 1.0,
      ),
      _batch(
        id: 'BCH-003',
        name: 'Gulab jamun banquet · 40 pcs',
        section: 'Dessert',
        quantity: 40,
        unit: 'pcs',
        status: 'expiring',
        timerSeconds: 0,
        expiryMinutes: 18,
        reuseCount: 0,
        progress: 1.0,
      ),
      _batch(
        id: 'BCH-004',
        name: 'Hakka noodle prep · 12 portions',
        section: 'Chinese',
        quantity: 12,
        unit: 'portions',
        status: 'planned',
        timerSeconds: 0,
        expiryMinutes: 60,
        reuseCount: 0,
        progress: 0.0,
      ),
      _batch(
        id: 'BCH-005',
        name: 'Caesar salad base · 10 bowls',
        section: 'Salad',
        quantity: 10,
        unit: 'bowls',
        status: 'reused',
        timerSeconds: 0,
        expiryMinutes: 35,
        reuseCount: 2,
        progress: 1.0,
      ),
    ];
  }

  static List<Map<String, dynamic>> _seedForecasts() {
    return [
      {
        'id': 'FC-001',
        'section': 'Tandoor',
        'label': 'Naan rush window',
        'forecastCovers': 32,
        'recommendedBatchSize': 24,
        'startInMinutes': 22,
        'confidence': 0.87,
        'updatedAt': DateTime.now().toIso8601String(),
      },
      {
        'id': 'FC-002',
        'section': 'Dessert',
        'label': 'Banquet dessert service',
        'forecastCovers': 40,
        'recommendedBatchSize': 40,
        'startInMinutes': 12,
        'confidence': 0.91,
        'updatedAt': DateTime.now().toIso8601String(),
      },
      {
        'id': 'FC-003',
        'section': 'Main',
        'label': 'Dal base replenishment',
        'forecastCovers': 18,
        'recommendedBatchSize': 6,
        'startInMinutes': 35,
        'confidence': 0.79,
        'updatedAt': DateTime.now().toIso8601String(),
      },
    ];
  }

  static Map<String, dynamic> _batch({
    required String id,
    required String name,
    required String section,
    required num quantity,
    required String unit,
    required String status,
    required int timerSeconds,
    required int expiryMinutes,
    required int reuseCount,
    required double progress,
  }) {
    return {
      'id': id,
      'name': name,
      'section': section,
      'quantity': quantity,
      'remainingQuantity': quantity,
      'unit': unit,
      'status': status,
      'statusLabel': _statusLabel(status),
      'timerSeconds': timerSeconds,
      'timerLabel': _formatTimer(timerSeconds),
      'expiryMinutes': expiryMinutes,
      'reuseCount': reuseCount,
      'progress': progress,
    };
  }

  static String _statusLabel(String status) {
    return switch (status) {
      'planned' => 'Planned',
      'cooking' => 'Cooking',
      'ready' => 'Ready',
      'expiring' => 'Expiring soon',
      'reused' => 'Reused batch',
      'consumed' => 'Consumed',
      'disposed' => 'Disposed',
      _ => status,
    };
  }

  static String _formatTimer(int seconds) {
    final minutes = seconds ~/ 60;
    final remainder = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  }
}

class MockBatchCookingEngine {
  const MockBatchCookingEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    MockBatchCookingRegistry.tickTimers();
    final batches = MockBatchCookingRegistry.batchesFor(section)
        .map(
          (batch) => {
            ...batch,
            'availableActions':
                MockBatchCookingRegistry.availableActions(batch),
          },
        )
        .toList();
    final forecasts = MockBatchCookingRegistry.forecastsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'batches': batches,
      'forecasts': forecasts,
      'stats': {
        'totalBatches': batches.length,
        'cooking': batches.where((b) => b['status'] == 'cooking').length,
        'ready': batches.where((b) => b['status'] == 'ready').length,
        'expiring': batches.where((b) => b['status'] == 'expiring').length,
        'reused': batches.where((b) => (b['reuseCount'] as int) > 0).length,
        'forecastWindows': forecasts.length,
      },
      'batchFeatures': {
        'bulkPreparationTracking': batches.isNotEmpty,
        'batchTiming': batches.any((b) => b['status'] == 'cooking'),
        'batchExpiryTracking':
            batches.any((b) => b['status'] == 'expiring' || (b['expiryMinutes'] as int) < 30),
        'batchReuseTracking':
            batches.any((b) => (b['reuseCount'] as int) > 0),
        'productionForecasting': forecasts.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
