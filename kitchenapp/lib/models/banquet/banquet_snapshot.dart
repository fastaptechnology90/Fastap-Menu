class BanquetSnapshot {
  const BanquetSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.bulkPrepJobs,
    required this.buffetStations,
    required this.eventSchedules,
    required this.guestCountPlans,
    required this.counterCoordination,
    required this.stats,
    required this.banquetFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<BulkPrepJob> bulkPrepJobs;
  final List<BuffetStation> buffetStations;
  final List<EventSchedule> eventSchedules;
  final List<GuestCountPlan> guestCountPlans;
  final List<CounterCoordination> counterCoordination;
  final BanquetStats stats;
  final BanquetFeatureFlags banquetFeatures;
  final List<String> sections;

  factory BanquetSnapshot.fromJson(Map<String, dynamic> json) {
    return BanquetSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      bulkPrepJobs: (json['bulkPrepJobs'] as List<dynamic>)
          .map((item) => BulkPrepJob.fromJson(item as Map<String, dynamic>))
          .toList(),
      buffetStations: (json['buffetStations'] as List<dynamic>)
          .map((item) => BuffetStation.fromJson(item as Map<String, dynamic>))
          .toList(),
      eventSchedules: (json['eventSchedules'] as List<dynamic>)
          .map((item) => EventSchedule.fromJson(item as Map<String, dynamic>))
          .toList(),
      guestCountPlans: (json['guestCountPlans'] as List<dynamic>)
          .map((item) => GuestCountPlan.fromJson(item as Map<String, dynamic>))
          .toList(),
      counterCoordination: (json['counterCoordination'] as List<dynamic>)
          .map(
            (item) =>
                CounterCoordination.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: BanquetStats.fromJson(json['stats'] as Map<String, dynamic>),
      banquetFeatures: BanquetFeatureFlags.fromJson(
        json['banquetFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BulkPrepJob {
  const BulkPrepJob({
    required this.id,
    required this.eventId,
    required this.eventName,
    required this.section,
    required this.location,
    required this.menuItems,
    required this.guestCount,
    required this.status,
    required this.timerSeconds,
    required this.timerLabel,
    required this.availableActions,
  });

  final String id;
  final String eventId;
  final String eventName;
  final String section;
  final String location;
  final List<String> menuItems;
  final int guestCount;
  final String status;
  final int timerSeconds;
  final String timerLabel;
  final List<String> availableActions;

  factory BulkPrepJob.fromJson(Map<String, dynamic> json) {
    return BulkPrepJob(
      id: json['id'] as String,
      eventId: json['eventId'] as String,
      eventName: json['eventName'] as String,
      section: json['section'] as String,
      location: json['location'] as String,
      menuItems: (json['menuItems'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      guestCount: json['guestCount'] as int? ?? 0,
      status: json['status'] as String? ?? 'queued',
      timerSeconds: json['timerSeconds'] as int? ?? 0,
      timerLabel: json['timerLabel'] as String? ?? '00:00',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class BuffetStation {
  const BuffetStation({
    required this.id,
    required this.stationName,
    required this.location,
    required this.courses,
    required this.status,
    required this.servingPercent,
  });

  final String id;
  final String stationName;
  final String location;
  final List<String> courses;
  final String status;
  final int servingPercent;

  factory BuffetStation.fromJson(Map<String, dynamic> json) {
    return BuffetStation(
      id: json['id'] as String,
      stationName: json['stationName'] as String,
      location: json['location'] as String,
      courses: (json['courses'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
      status: json['status'] as String? ?? 'standby',
      servingPercent: json['servingPercent'] as int? ?? 0,
    );
  }
}

class EventSchedule {
  const EventSchedule({
    required this.id,
    required this.eventName,
    required this.location,
    required this.startTime,
    required this.mealType,
    required this.guestCount,
    required this.status,
    required this.availableActions,
  });

  final String id;
  final String eventName;
  final String location;
  final String startTime;
  final String mealType;
  final int guestCount;
  final String status;
  final List<String> availableActions;

  factory EventSchedule.fromJson(Map<String, dynamic> json) {
    return EventSchedule(
      id: json['id'] as String,
      eventName: json['eventName'] as String,
      location: json['location'] as String,
      startTime: json['startTime'] as String? ?? '18:00',
      mealType: json['mealType'] as String? ?? 'Dinner',
      guestCount: json['guestCount'] as int? ?? 0,
      status: json['status'] as String? ?? 'scheduled',
      availableActions: (json['availableActions'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class GuestCountPlan {
  const GuestCountPlan({
    required this.id,
    required this.eventName,
    required this.confirmedGuests,
    required this.bufferGuests,
    required this.preparedServings,
    required this.status,
  });

  final String id;
  final String eventName;
  final int confirmedGuests;
  final int bufferGuests;
  final int preparedServings;
  final String status;

  factory GuestCountPlan.fromJson(Map<String, dynamic> json) {
    return GuestCountPlan(
      id: json['id'] as String,
      eventName: json['eventName'] as String,
      confirmedGuests: json['confirmedGuests'] as int? ?? 0,
      bufferGuests: json['bufferGuests'] as int? ?? 0,
      preparedServings: json['preparedServings'] as int? ?? 0,
      status: json['status'] as String? ?? 'planning',
    );
  }
}

class CounterCoordination {
  const CounterCoordination({
    required this.id,
    required this.counterName,
    required this.assignedChef,
    required this.linkedEvent,
    required this.queueDepth,
    required this.status,
  });

  final String id;
  final String counterName;
  final String assignedChef;
  final String linkedEvent;
  final int queueDepth;
  final String status;

  factory CounterCoordination.fromJson(Map<String, dynamic> json) {
    return CounterCoordination(
      id: json['id'] as String,
      counterName: json['counterName'] as String,
      assignedChef: json['assignedChef'] as String? ?? 'Unassigned',
      linkedEvent: json['linkedEvent'] as String? ?? '',
      queueDepth: json['queueDepth'] as int? ?? 0,
      status: json['status'] as String? ?? 'idle',
    );
  }
}

class BanquetStats {
  const BanquetStats({
    required this.activeEvents,
    required this.bulkPrepJobs,
    required this.buffetLive,
    required this.scheduledMeals,
    required this.totalGuests,
    required this.completedToday,
  });

  final int activeEvents;
  final int bulkPrepJobs;
  final int buffetLive;
  final int scheduledMeals;
  final int totalGuests;
  final int completedToday;

  factory BanquetStats.fromJson(Map<String, dynamic> json) {
    return BanquetStats(
      activeEvents: json['activeEvents'] as int? ?? 0,
      bulkPrepJobs: json['bulkPrepJobs'] as int? ?? 0,
      buffetLive: json['buffetLive'] as int? ?? 0,
      scheduledMeals: json['scheduledMeals'] as int? ?? 0,
      totalGuests: json['totalGuests'] as int? ?? 0,
      completedToday: json['completedToday'] as int? ?? 0,
    );
  }
}

class BanquetFeatureFlags {
  const BanquetFeatureFlags({
    required this.bulkMealPreparation,
    required this.buffetCoordination,
    required this.eventMealScheduling,
    required this.guestCountPreparation,
    required this.multiCounterCoordination,
  });

  final bool bulkMealPreparation;
  final bool buffetCoordination;
  final bool eventMealScheduling;
  final bool guestCountPreparation;
  final bool multiCounterCoordination;

  factory BanquetFeatureFlags.fromJson(Map<String, dynamic> json) {
    return BanquetFeatureFlags(
      bulkMealPreparation: json['bulkMealPreparation'] as bool? ?? false,
      buffetCoordination: json['buffetCoordination'] as bool? ?? false,
      eventMealScheduling: json['eventMealScheduling'] as bool? ?? false,
      guestCountPreparation: json['guestCountPreparation'] as bool? ?? false,
      multiCounterCoordination:
          json['multiCounterCoordination'] as bool? ?? false,
    );
  }
}

class BanquetActionResult {
  const BanquetActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory BanquetActionResult.fromJson(Map<String, dynamic> json) {
    return BanquetActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Banquet action applied',
    );
  }
}
