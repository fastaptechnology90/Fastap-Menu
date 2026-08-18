import 'mock_section_registry.dart';

class MockPanicEmergencyRegistry {
  MockPanicEmergencyRegistry._();

  static final List<Map<String, dynamic>> _incidents = _seedIncidents();
  static final List<Map<String, dynamic>> _evacuations = _seedEvacuations();
  static final List<Map<String, dynamic>> _broadcasts = _seedBroadcasts();
  static int _panicTriggersToday = 1;
  static int _resolvedToday = 2;
  static int _broadcastsToday = 3;

  static List<Map<String, dynamic>> incidentsFor(String section) {
    if (section == 'All') {
      return _incidents.map(_serializeIncident).toList();
    }
    return _incidents
        .where((item) => item['section'] == section)
        .map(_serializeIncident)
        .toList();
  }

  static List<Map<String, dynamic>> evacuationsFor(String section) {
    if (section == 'All') {
      return _evacuations.map(_serializeEvacuation).toList();
    }
    return _evacuations
        .where((item) => item['section'] == section)
        .map(_serializeEvacuation)
        .toList();
  }

  static List<Map<String, dynamic>> broadcastsFor(String section) {
    if (section == 'All') {
      return _broadcasts.map(Map<String, dynamic>.from).toList();
    }
    return _broadcasts
        .where((item) => item['section'] == section)
        .map(Map<String, dynamic>.from)
        .toList();
  }

  static Map<String, dynamic> triggerPanic({
    String? emergencyType,
    String? section,
  }) {
    _panicTriggersToday++;
    final type = emergencyType ?? 'general';
    final targetSection = section ?? 'Main';
    _incidents.insert(0, {
      'id': 'EMG-${_incidents.length + 1}'.padLeft(7, '0'),
      'emergencyType': type,
      'title': 'PANIC BUTTON · ${_typeLabel(type)}',
      'section': targetSection,
      'severity': 'critical',
      'reportedAt': 'Just now',
      'reportedBy': 'Kitchen panic button',
      'message': 'Manual panic trigger activated · all stations notified',
      'status': 'active',
    });
    _broadcasts.insert(0, {
      'id': 'BCST-${_broadcasts.length + 1}'.padLeft(8, '0'),
      'broadcastType': 'panic',
      'message': 'PANIC activated · $targetSection · ${_typeLabel(type)}',
      'sentAt': 'Just now',
      'status': 'sent',
      'section': targetSection,
    });
    _broadcastsToday++;
    return {
      'success': true,
      'message': 'Panic button triggered · ${_typeLabel(type)} · $targetSection',
    };
  }

  static Map<String, dynamic> performIncidentAction({
    required String incidentId,
    required String action,
  }) {
    final incident = _findIncident(incidentId);
    if (incident == null) {
      throw ArgumentError('Emergency incident not found');
    }

    final title = incident['title'] as String;

    switch (action) {
      case 'acknowledge_incident':
        incident['status'] = 'acknowledged';
        return {
          'success': true,
          'message': 'Incident acknowledged · $title',
        };
      case 'escalate_incident':
        incident['status'] = 'escalated';
        incident['severity'] = 'critical';
        _broadcasts.insert(0, {
          'id': 'BCST-${_broadcasts.length + 1}'.padLeft(8, '0'),
          'broadcastType': 'escalation',
          'message': 'Incident escalated · $title',
          'sentAt': 'Just now',
          'status': 'sent',
          'section': incident['section'],
        });
        _broadcastsToday++;
        return {
          'success': true,
          'message': 'Incident escalated · $title',
        };
      case 'resolve_incident':
        incident['status'] = 'resolved';
        _resolvedToday++;
        return {
          'success': true,
          'message': 'Incident resolved · $title',
        };
      case 'activate_evacuation':
        _evacuations.add({
          'id': 'EVC-${_evacuations.length + 1}'.padLeft(7, '0'),
          'zone': incident['section'],
          'section': incident['section'],
          'message': 'Evacuation activated · ${incident['title']}',
          'status': 'active',
        });
        incident['status'] = 'evacuation';
        return {
          'success': true,
          'message': 'Evacuation activated · $title',
        };
      case 'broadcast_emergency':
        _broadcasts.insert(0, {
          'id': 'BCST-${_broadcasts.length + 1}'.padLeft(8, '0'),
          'broadcastType': incident['emergencyType'],
          'message': 'Emergency broadcast · $title',
          'sentAt': 'Just now',
          'status': 'sent',
          'section': incident['section'],
        });
        _broadcastsToday++;
        return {
          'success': true,
          'message': 'Emergency broadcast sent · $title',
        };
      default:
        throw ArgumentError('Unknown incident action: $action');
    }
  }

  static Map<String, dynamic> performEvacuationAction({
    required String evacuationId,
    required String action,
  }) {
    final evacuation = _findEvacuation(evacuationId);
    if (evacuation == null) {
      throw ArgumentError('Evacuation alert not found');
    }

    final zone = evacuation['zone'] as String;

    switch (action) {
      case 'confirm_evacuation':
        evacuation['status'] = 'confirmed';
        return {
          'success': true,
          'message': 'Evacuation confirmed · $zone',
        };
      case 'cancel_evacuation':
        evacuation['status'] = 'cancelled';
        return {
          'success': true,
          'message': 'Evacuation cancelled · $zone',
        };
      case 'complete_evacuation':
        evacuation['status'] = 'completed';
        _resolvedToday++;
        return {
          'success': true,
          'message': 'Evacuation completed · $zone',
        };
      default:
        throw ArgumentError('Unknown evacuation action: $action');
    }
  }

  static Map<String, dynamic> syncAll() {
    return {
      'success': true,
      'message':
          'Emergency system synced · ${_incidents.length} incidents tracked',
    };
  }

  static Map<String, dynamic>? _findIncident(String incidentId) {
    for (final incident in _incidents) {
      if (incident['id'] == incidentId) {
        return incident;
      }
    }
    return null;
  }

  static Map<String, dynamic>? _findEvacuation(String evacuationId) {
    for (final evacuation in _evacuations) {
      if (evacuation['id'] == evacuationId) {
        return evacuation;
      }
    }
    return null;
  }

  static Map<String, dynamic> _serializeIncident(Map<String, dynamic> incident) {
    return {
      'id': incident['id'],
      'emergencyType': incident['emergencyType'],
      'title': incident['title'],
      'section': incident['section'],
      'severity': incident['severity'],
      'reportedAt': incident['reportedAt'],
      'reportedBy': incident['reportedBy'],
      'message': incident['message'],
      'status': incident['status'],
      'availableActions': incident['status'] == 'resolved'
          ? <String>[]
          : _incidentActions(incident),
    };
  }

  static List<String> _incidentActions(Map<String, dynamic> incident) {
    return [
      'acknowledge_incident',
      'escalate_incident',
      'resolve_incident',
      'activate_evacuation',
      'broadcast_emergency',
    ];
  }

  static Map<String, dynamic> _serializeEvacuation(
    Map<String, dynamic> evacuation,
  ) {
    return {
      'id': evacuation['id'],
      'zone': evacuation['zone'],
      'section': evacuation['section'],
      'message': evacuation['message'],
      'status': evacuation['status'],
      'availableActions': evacuation['status'] == 'active' ||
              evacuation['status'] == 'confirmed'
          ? ['confirm_evacuation', 'cancel_evacuation', 'complete_evacuation']
          : <String>[],
    };
  }

  static String _typeLabel(String type) {
    return switch (type) {
      'fire' => 'Fire emergency',
      'gas' => 'Gas leakage',
      'equipment' => 'Equipment blast',
      'injury' => 'Staff injury',
      'contamination' => 'Food contamination',
      _ => 'General emergency',
    };
  }

  static List<Map<String, dynamic>> _seedIncidents() {
    return [
      {
        'id': 'EMG-001',
        'emergencyType': 'gas',
        'title': 'Gas leakage · Main range',
        'section': 'Main',
        'severity': 'critical',
        'reportedAt': '4 min ago',
        'reportedBy': 'Smart gas sensor',
        'message': 'Gas PPM spike detected · auto shutoff engaged',
        'status': 'active',
      },
      {
        'id': 'EMG-002',
        'emergencyType': 'injury',
        'title': 'Staff injury · Prep area',
        'section': 'Continental',
        'severity': 'high',
        'reportedAt': '18 min ago',
        'reportedBy': 'Kitchen Manager Dev',
        'message': 'Minor cut · first aid applied · station paused',
        'status': 'acknowledged',
      },
      {
        'id': 'EMG-003',
        'emergencyType': 'contamination',
        'title': 'Food contamination risk',
        'section': 'Main',
        'severity': 'high',
        'reportedAt': '32 min ago',
        'reportedBy': 'Quality control',
        'message': 'Cross-contact flagged · sauce batch quarantined',
        'status': 'escalated',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedEvacuations() {
    return [
      {
        'id': 'EVC-001',
        'zone': 'Tandoor section',
        'section': 'Tandoor',
        'message': 'Standby evacuation · tandoor flare-up contained',
        'status': 'standby',
      },
    ];
  }

  static List<Map<String, dynamic>> _seedBroadcasts() {
    return [
      {
        'id': 'BCST-001',
        'broadcastType': 'gas',
        'message': 'Gas alert · Main range · evacuate hot line if alarm persists',
        'sentAt': '4 min ago',
        'status': 'sent',
        'section': 'Main',
      },
      {
        'id': 'BCST-002',
        'broadcastType': 'contamination',
        'message': 'Hold all Main section sauce dispatches · QC review',
        'sentAt': '30 min ago',
        'status': 'sent',
        'section': 'Main',
      },
    ];
  }

  static int get panicTriggersToday => _panicTriggersToday;
  static int get resolvedToday => _resolvedToday;
  static int get broadcastsToday => _broadcastsToday;
}

class MockPanicEmergencyEngine {
  const MockPanicEmergencyEngine._();

  static Map<String, dynamic> buildSnapshot({String section = 'All'}) {
    final incidents = MockPanicEmergencyRegistry.incidentsFor(section);
    final evacuationAlerts = MockPanicEmergencyRegistry.evacuationsFor(section);
    final broadcastLog = MockPanicEmergencyRegistry.broadcastsFor(section);

    return {
      'section': section,
      'lastSyncedAt': DateTime.now().toIso8601String(),
      'incidents': incidents,
      'evacuationAlerts': evacuationAlerts,
      'broadcastLog': broadcastLog,
      'stats': {
        'activeIncidents': incidents
            .where((item) =>
                item['status'] == 'active' ||
                item['status'] == 'escalated' ||
                item['status'] == 'evacuation')
            .length,
        'criticalIncidents': incidents
            .where((item) => item['severity'] == 'critical')
            .length,
        'evacuationsActive': evacuationAlerts
            .where((item) => item['status'] == 'active')
            .length,
        'broadcastsToday': MockPanicEmergencyRegistry.broadcastsToday,
        'panicTriggersToday': MockPanicEmergencyRegistry.panicTriggersToday,
        'resolvedToday': MockPanicEmergencyRegistry.resolvedToday,
      },
      'emergencyFeatures': {
        'fireEmergency':
            incidents.any((item) => item['emergencyType'] == 'fire'),
        'gasLeakage': incidents.any((item) => item['emergencyType'] == 'gas'),
        'equipmentBlast':
            incidents.any((item) => item['emergencyType'] == 'equipment'),
        'staffInjury':
            incidents.any((item) => item['emergencyType'] == 'injury'),
        'foodContamination':
            incidents.any((item) => item['emergencyType'] == 'contamination'),
        'panicButton': true,
        'emergencyBroadcasts': broadcastLog.isNotEmpty,
        'evacuationAlerts': evacuationAlerts.isNotEmpty,
        'incidentEscalation':
            incidents.any((item) => item['status'] == 'escalated'),
      },
      'sections': MockSectionRegistry.filterSections,
    };
  }
}
