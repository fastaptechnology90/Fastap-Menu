class BarBeverageSnapshot {

  const BarBeverageSnapshot({

    required this.section,

    required this.lastSyncedAt,

    required this.drinkQueue,

    required this.bartenders,

    required this.stats,

    required this.barFeatures,

    required this.sections,

  });



  final String section;

  final DateTime lastSyncedAt;

  final List<BeverageDrink> drinkQueue;

  final List<BartenderAssignment> bartenders;

  final BarBeverageStats stats;

  final BarFeatureFlags barFeatures;

  final List<String> sections;



  factory BarBeverageSnapshot.fromJson(Map<String, dynamic> json) {

    return BarBeverageSnapshot(

      section: json['section'] as String? ?? 'All',

      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),

      drinkQueue: (json['drinkQueue'] as List<dynamic>)

          .map((item) => BeverageDrink.fromJson(item as Map<String, dynamic>))

          .toList(),

      bartenders: (json['bartenders'] as List<dynamic>)

          .map(

            (item) => BartenderAssignment.fromJson(item as Map<String, dynamic>),

          )

          .toList(),

      stats: BarBeverageStats.fromJson(json['stats'] as Map<String, dynamic>),

      barFeatures: BarFeatureFlags.fromJson(

        json['barFeatures'] as Map<String, dynamic>,

      ),

      sections: (json['sections'] as List<dynamic>)

          .map((item) => item.toString())

          .toList(),

    );

  }

}



class BeverageDrink {

  const BeverageDrink({

    required this.id,

    required this.orderId,

    required this.kotNumber,

    required this.section,

    required this.location,

    required this.drinkName,

    required this.customization,

    required this.bartender,

    required this.status,

    required this.timerSeconds,

    required this.timerLabel,

    required this.recipeGuidance,

    required this.availableActions,

  });



  final String id;

  final String orderId;

  final String kotNumber;

  final String section;

  final String location;

  final String drinkName;

  final String customization;

  final String? bartender;

  final String status;

  final int timerSeconds;

  final String timerLabel;

  final List<String> recipeGuidance;

  final List<String> availableActions;



  factory BeverageDrink.fromJson(Map<String, dynamic> json) {

    return BeverageDrink(

      id: json['id'] as String,

      orderId: json['orderId'] as String,

      kotNumber: json['kotNumber'] as String,

      section: json['section'] as String,

      location: json['location'] as String,

      drinkName: json['drinkName'] as String,

      customization: json['customization'] as String? ?? 'Standard',

      bartender: json['bartender'] as String?,

      status: json['status'] as String? ?? 'queued',

      timerSeconds: json['timerSeconds'] as int? ?? 0,

      timerLabel: json['timerLabel'] as String? ?? '00:00',

      recipeGuidance: (json['recipeGuidance'] as List<dynamic>? ?? const [])

          .map((item) => item.toString())

          .toList(),

      availableActions:

          (json['availableActions'] as List<dynamic>? ?? const [])

              .map((item) => item.toString())

              .toList(),

    );

  }

}



class BartenderAssignment {

  const BartenderAssignment({

    required this.name,

    required this.status,

    required this.activeDrinks,

    required this.specialty,

  });



  final String name;

  final String status;

  final int activeDrinks;

  final String specialty;



  factory BartenderAssignment.fromJson(Map<String, dynamic> json) {

    return BartenderAssignment(

      name: json['name'] as String,

      status: json['status'] as String? ?? 'available',

      activeDrinks: json['activeDrinks'] as int? ?? 0,

      specialty: json['specialty'] as String? ?? 'Bar',

    );

  }

}



class BarBeverageStats {

  const BarBeverageStats({

    required this.queuedDrinks,

    required this.inProgress,

    required this.customizedDrinks,

    required this.completedToday,

    required this.availableBartenders,

    required this.avgPrepMinutes,

  });



  final int queuedDrinks;

  final int inProgress;

  final int customizedDrinks;

  final int completedToday;

  final int availableBartenders;

  final int avgPrepMinutes;



  factory BarBeverageStats.fromJson(Map<String, dynamic> json) {

    return BarBeverageStats(

      queuedDrinks: json['queuedDrinks'] as int? ?? 0,

      inProgress: json['inProgress'] as int? ?? 0,

      customizedDrinks: json['customizedDrinks'] as int? ?? 0,

      completedToday: json['completedToday'] as int? ?? 0,

      availableBartenders: json['availableBartenders'] as int? ?? 0,

      avgPrepMinutes: json['avgPrepMinutes'] as int? ?? 0,

    );

  }

}



class BarFeatureFlags {

  const BarFeatureFlags({

    required this.drinkPreparationQueue,

    required this.bartenderAssignment,

    required this.cocktailCustomization,

    required this.beverageTimers,

    required this.recipeGuidance,

  });



  final bool drinkPreparationQueue;

  final bool bartenderAssignment;

  final bool cocktailCustomization;

  final bool beverageTimers;

  final bool recipeGuidance;



  factory BarFeatureFlags.fromJson(Map<String, dynamic> json) {

    return BarFeatureFlags(

      drinkPreparationQueue: json['drinkPreparationQueue'] as bool? ?? false,

      bartenderAssignment: json['bartenderAssignment'] as bool? ?? false,

      cocktailCustomization: json['cocktailCustomization'] as bool? ?? false,

      beverageTimers: json['beverageTimers'] as bool? ?? false,

      recipeGuidance: json['recipeGuidance'] as bool? ?? false,

    );

  }

}



class BarBeverageActionResult {

  const BarBeverageActionResult({

    required this.success,

    required this.message,

  });



  final bool success;

  final String message;



  factory BarBeverageActionResult.fromJson(Map<String, dynamic> json) {

    return BarBeverageActionResult(

      success: json['success'] as bool? ?? false,

      message: json['message'] as String? ?? 'Bar action applied',

    );

  }

}

