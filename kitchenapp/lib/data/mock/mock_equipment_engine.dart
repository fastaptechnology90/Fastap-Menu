import 'mock_section_registry.dart';

class MockEquipmentRegistry {
  MockEquipmentRegistry._();

  static final List<Map<String, dynamic>> _assets = _seedAssets();
  static final List<Map<String, dynamic>> _amcReminders = _seedAmcReminders();
  static final List<Map<String, dynamic>> _tickets = _seedTickets();
  static final List<Map<String, dynamic>> _breakdowns = _seedBreakdowns();
  static final List<Map<String, dynamic>> _usage = _seedUsage();
  static int _resolvedToday = 5;

  static List<Map<String, dynamic>> assetsFor(String section) {
    if (section == 'All') {
      return _assets.map(_serializeAsset).toList();
    }
    return _assets
        .where((asset) => asset['section'] == section)
        .map(_serializeAsset)
        .toList();
  }

  static List<Map<String, dynamic>> amcFor(String section) {
    if (section == 'All') {
      return _amcReminders.map(Map<String, dynamic>.from).toList();
    }
    return _amcReminders
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static List<Map<String, dynamic>> ticketsFor(String section) {
    if (section == 'All') {
      return _tickets.map(_serializeTicket).toList();
    }
    return _tickets
        .where((item) => item['section'] == section)
        .map(_serializeTicket)
        .toList();
  }

  static List<Map<String, dynamic>> breakdownsFor(String section) {
    if (section == 'All') {
      return _breakdowns.map(_serializeBreakdown).toList();
    }
    return _breakdowns
        .where((item) => item['section'] == section)
        .map(_serializeBreakdown)
        .toList();
  }

  static List<Map<String, dynamic>> usageFor(String section) {
    if (section == 'All') {
      return _usage.map(Map<String, dynamic>.from).toList();
    }
    return _usage
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic> performAction({
    required String assetId,
    required String action,
    String? issueSummary,
  }) {
    final asset = _findAsset(assetId);
    if (asset == null) {
      throw ArgumentError('Equipment asset not found');
    }

    final assetName = asset['assetName'] as String;
    final breakdown = _findBreakdownByAsset(assetId);
    final ticket = _findOpenTicket(assetId);

    switch (action) {
      case 'acknowledge_breakdown':
        breakdown?['status'] = 'acknowledged';
        asset['status'] = 'under_repair';
        return {
          'success': true,
          'message': 'Breakdown acknowledged · $assetName',
        };
      case 'raise_maintenance':
        _tickets.insert(0, {
          'id': 'MT-${DateTime.now().millisecondsSinceEpoch}',
          'assetId': assetId,
          'assetName': assetName,
          'section': asset['section'],
          'issueSummary': issueSummary ?? 'Maintenance required',
          'priority': 'normal',
          'status': 'open',
        });
        asset['status'] = 'maintenance';
        return {
          'success': true,
          'message': 'Maintenance ticket raised · $assetName',
        };
      case 'resolve_ticket':
        ticket?['status'] = 'resolved';
        asset['status'] = 'operational';
        asset['healthPercent'] = ((asset['healthPercent'] as int) + 8).clamp(0, 100);
        asset['lastService'] = 'Today';
        _resolvedToday++;
        if (breakdown != null) {
          breakdown['status'] = 'resolved';
        }
        return {
          'success': true,
          'message': 'Ticket resolved · $assetName',
        };
      case 'schedule_amc':
        final amc = _amcReminders.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['assetName'] == assetName,
              orElse: () => null,
            );
        if (amc != null) {
          amc['status'] = 'scheduled';
          amc['dueInDays'] = 30;
        }
        return {
          'success': true,
          'message': 'AMC scheduled · $assetName',
        };
      case 'log_usage':
        final usage = _usage.cast<Map<String, dynamic>?>().firstWhere(
              (item) => item?['assetName'] == assetName,
              orElse: () => null,
            );
        if (usage != null) {
          usage['usageHours'] = (usage['usageHours'] as num) + 1.5;
        }
        return {
          'success': true,
          'message': 'Usage logged · $assetName',
        };
      case 'mark_operational':
        asset['status'] = 'operational';
        return {
          'success': true,
          'message': 'Asset marked operational · $assetName',
        };
      case 'hold_asset':
        asset['status'] = 'on_hold';
        return {
          'success': true,
          'message': 'Asset held · $assetName',
        };
      default:
        throw ArgumentError('Unknown equipment action: $action');
    }
  }

  static Map<String, dynamic> raiseMaintenance({
    String? assetId,
    String? issueSummary,
  }) {
    if (assetId != null) {
      return performAction(
        assetId: assetId,
        action: 'raise_maintenance',
        issueSummary: issueSummary,
      );
    }

    final asset = _assets.firstWhere(
      (item) => item['status'] == 'operational',
      orElse: () => _assets.first,
    );
    return performAction(
      assetId: asset['id'] as String,
      action: 'raise_maintenance',
      issueSummary: issueSummary ?? 'Preventive maintenance',
    );
  }

  static Map<String, dynamic>? _findAsset(String assetId) {
    for (final asset in _assets) {
      if (asset['id'] == assetId) {
        return asset;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findBreakdownByAsset(String assetId) {
    for (final alert in _breakdowns) {
      if (alert['assetId'] == assetId && alert['status'] != 'resolved') {
        return alert;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findOpenTicket(String assetId) {
    for (final ticket in _tickets) {
      if (ticket['assetId'] == assetId && ticket['status'] == 'open') {
        return ticket;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeAsset(Map<String, dynamic> asset) {
    return {
      'id': asset['id'],
      'assetName': asset['assetName'],
      'equipmentType': asset['equipmentType'],
      'section': asset['section'],
      'healthPercent': asset['healthPercent'],
      'status': asset['status'],
      'lastService': asset['lastService'],
      'availableActions': _assetActions(asset),
    };
  }

  static Map<String, dynamic> _serializeTicket(Map<String, dynamic> ticket) {
    return {
      'id': ticket['id'],
      'assetId': ticket['assetId'],
      'assetName': ticket['assetName'],
      'section': ticket['section'],
      'issueSummary': ticket['issueSummary'],
      'priority': ticket['priority'],
      'status': ticket['status'],
      'availableActions': _ticketActions(ticket),
    };
  }

  static Map<String, dynamic> _serializeBreakdown(Map<String, dynamic> alert) {
    return {
      'id': alert['id'],
      'assetId': alert['assetId'],
      'assetName': alert['assetName'],
      'section': alert['section'],
      'alertType': alert['alertType'],
      'severity': alert['severity'],
      'status': alert['status'],
      'availableActions': _breakdownActions(alert),
    };
  }

  static List<String> _assetActions(Map<String, dynamic> asset) {
    final actions = <String>[
      'raise_maintenance',
      'schedule_amc',
      'log_usage',
      'mark_operational',
    ];
    if (asset['status'] != 'operational') {
      actions.insert(0, 'resolve_ticket');
    }
    actions.add('hold_asset');
    return actions;
  }

  static List<String> _ticketActions(Map<String, dynamic> ticket) {
    if (ticket['status'] == 'resolved') {
      return const [];
    }
    return ['resolve_ticket', 'hold_asset'];
  }

  static List<String> _breakdownActions(Map<String, dynamic> alert) {
    if (alert['status'] == 'resolved') {
      return const [];
    }
    return ['acknowledge_breakdown', 'raise_maintenance', 'resolve_ticket'];
  }

  static List<Map<String, dynamic>> _seedAssets() {
    return [
      {
        'id': 'EQ-001',
        'assetName': 'Tandoor oven chamber',
        'equipmentType': 'Oven',
        'section': 'Tandoor',
        'healthPercent': 72,
        'status': 'operational',
        'lastService': '12 days ago',
      },
      {
        'id': 'EQ-002',
        'assetName': 'Walk-in chiller',
        'equipmentType': 'Refrigerator',
        'section': 'Continental',
        'healthPercent': 91,
        'status': 'operational',
        'lastService': '5 days ago',
      },
      {
        'id': 'EQ-003',
        'assetName': 'Deep fryer #2',
        'equipmentType': 'Fryer',
        'section': 'Main',
        'healthPercent': 38,
        'status': 'breakdown',
        'lastService': '45 days ago',
      },
      {
        'id': 'EQ-004',
        'assetName': 'Espresso machine',
        'equipmentType': 'Coffee machine',
        'section': 'Beverage',
        'healthPercent': 64,
        'status': 'maintenance',
        'lastService': '20 days ago',
      },
      {
        'id': 'EQ-005',
        'assetName': 'Grill station',
        'equipmentType': 'Grill',
        'section': 'Grill',
        'healthPercent': 78,
        'status': 'operational',
        'lastService': '8 days ago',
      },
      {
        'id': 'EQ-006',
        'assetName': 'Industrial dishwasher',
        'equipmentType': 'Dishwasher',
        'section': 'Main',
        'healthPercent': 83,
        'status': 'operational',
        'lastService': '18 days ago',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedAmcReminders() {
    return [
      {
        'id': 'AMC-001',
        'assetName': 'Tandoor oven chamber',
        'section': 'Tandoor',
        'provider': 'KitchenCare AMC',
        'dueInDays': 14,
        'status': 'upcoming',
      },
      {
        'id': 'AMC-002',
        'assetName': 'Industrial dishwasher',
        'section': 'Main',
        'provider': 'CleanTech Services',
        'dueInDays': 28,
        'status': 'upcoming',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedTickets() {
    return [
      {
        'id': 'MT-001',
        'assetId': 'EQ-004',
        'assetName': 'Espresso machine',
        'section': 'Beverage',
        'issueSummary': 'Steam pressure fluctuation',
        'priority': 'high',
        'status': 'open',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedBreakdowns() {
    return [
      {
        'id': 'BRK-001',
        'assetId': 'EQ-003',
        'assetName': 'Deep fryer #2',
        'section': 'Main',
        'alertType': 'Heating element failure',
        'severity': 'critical',
        'status': 'active',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedUsage() {
    return [
      {
        'id': 'USG-001',
        'assetName': 'Grill station',
        'section': 'Grill',
        'usageHours': 9.5,
        'peakWindow': '19:00-22:00',
        'utilizationPercent': 88,
      },
      {
        'id': 'USG-002',
        'assetName': 'Tandoor oven chamber',
        'section': 'Tandoor',
        'usageHours': 11.2,
        'peakWindow': '18:00-21:00',
        'utilizationPercent': 92,
      },
      {
        'id': 'USG-003',
        'assetName': 'Industrial dishwasher',
        'section': 'Main',
        'usageHours': 6.4,
        'peakWindow': '21:00-23:00',
        'utilizationPercent': 61,
      },
    ];
  }

  static int get resolvedToday => _resolvedToday;
}

class MockEquipmentEngine {
  const MockEquipmentEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final equipmentAssets = MockEquipmentRegistry.assetsFor(section);
    final amcReminders = MockEquipmentRegistry.amcFor(section);
    final maintenanceTickets = MockEquipmentRegistry.ticketsFor(section);
    final breakdownAlerts = MockEquipmentRegistry.breakdownsFor(section);
    final usageAnalytics = MockEquipmentRegistry.usageFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'equipmentAssets': equipmentAssets,
      'amcReminders': amcReminders,
      'maintenanceTickets': maintenanceTickets,
      'breakdownAlerts': breakdownAlerts,
      'usageAnalytics': usageAnalytics,
      'stats': {
        'totalAssets': equipmentAssets.length,
        'operationalAssets': equipmentAssets
            .where((asset) => asset['status'] == 'operational')
            .length,
        'openTickets': maintenanceTickets
            .where((ticket) => ticket['status'] == 'open')
            .length,
        'activeBreakdowns': breakdownAlerts
            .where((alert) => alert['status'] != 'resolved')
            .length,
        'amcDueSoon':
            amcReminders.where((item) => (item['dueInDays'] as int) <= 14).length,
        'highUtilization': usageAnalytics
            .where((item) => (item['utilizationPercent'] as int) >= 85)
            .length,
        'resolvedToday': MockEquipmentRegistry.resolvedToday,
      },
      'equipmentFeatures': {
        'equipmentHealthTracking': equipmentAssets.isNotEmpty,
        'amcReminders': amcReminders.isNotEmpty,
        'maintenanceTickets': maintenanceTickets.isNotEmpty,
        'breakdownAlerts': breakdownAlerts.isNotEmpty,
        'usageAnalytics': usageAnalytics.isNotEmpty,
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
