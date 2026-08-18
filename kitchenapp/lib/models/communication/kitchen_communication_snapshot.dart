class KitchenCommunicationSnapshot {
  const KitchenCommunicationSnapshot({
    required this.section,
    required this.lastSyncedAt,
    required this.threads,
    required this.announcements,
    required this.broadcasts,
    required this.smartAlerts,
    required this.stats,
    required this.communicationFeatures,
    required this.sections,
  });

  final String section;
  final DateTime lastSyncedAt;
  final List<CommunicationThread> threads;
  final List<ChefAnnouncement> announcements;
  final List<KitchenBroadcast> broadcasts;
  final List<CommunicationAlert> smartAlerts;
  final CommunicationStats stats;
  final CommunicationFeatureFlags communicationFeatures;
  final List<String> sections;

  factory KitchenCommunicationSnapshot.fromJson(Map<String, dynamic> json) {
    return KitchenCommunicationSnapshot(
      section: json['section'] as String? ?? 'All',
      lastSyncedAt: DateTime.parse(json['lastSyncedAt'] as String),
      threads: (json['threads'] as List<dynamic>)
          .map(
            (item) =>
                CommunicationThread.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      announcements: (json['announcements'] as List<dynamic>)
          .map(
            (item) => ChefAnnouncement.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      broadcasts: (json['broadcasts'] as List<dynamic>)
          .map(
            (item) => KitchenBroadcast.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      smartAlerts: (json['smartAlerts'] as List<dynamic>)
          .map(
            (item) => CommunicationAlert.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
      stats: CommunicationStats.fromJson(json['stats'] as Map<String, dynamic>),
      communicationFeatures: CommunicationFeatureFlags.fromJson(
        json['communicationFeatures'] as Map<String, dynamic>,
      ),
      sections: (json['sections'] as List<dynamic>)
          .map((item) => item.toString())
          .toList(),
    );
  }
}

class CommunicationThread {
  const CommunicationThread({
    required this.id,
    required this.orderId,
    required this.kotNumber,
    required this.waiterName,
    required this.section,
    required this.location,
    required this.unreadCount,
    required this.lastMessageAt,
    required this.messages,
  });

  final String id;
  final String orderId;
  final String kotNumber;
  final String waiterName;
  final String section;
  final String location;
  final int unreadCount;
  final DateTime lastMessageAt;
  final List<CommunicationMessage> messages;

  factory CommunicationThread.fromJson(Map<String, dynamic> json) {
    return CommunicationThread(
      id: json['id'] as String,
      orderId: json['orderId'] as String,
      kotNumber: json['kotNumber'] as String,
      waiterName: json['waiterName'] as String,
      section: json['section'] as String,
      location: json['location'] as String,
      unreadCount: json['unreadCount'] as int? ?? 0,
      lastMessageAt: DateTime.parse(json['lastMessageAt'] as String),
      messages: (json['messages'] as List<dynamic>)
          .map(
            (item) =>
                CommunicationMessage.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }
}

class CommunicationMessage {
  const CommunicationMessage({
    required this.id,
    required this.sender,
    required this.senderRole,
    required this.body,
    required this.type,
    required this.sentAt,
  });

  final String id;
  final String sender;
  final String senderRole;
  final String body;
  final String type;
  final DateTime sentAt;

  factory CommunicationMessage.fromJson(Map<String, dynamic> json) {
    return CommunicationMessage(
      id: json['id'] as String,
      sender: json['sender'] as String,
      senderRole: json['senderRole'] as String,
      body: json['body'] as String,
      type: json['type'] as String,
      sentAt: DateTime.parse(json['sentAt'] as String),
    );
  }
}

class ChefAnnouncement {
  const ChefAnnouncement({
    required this.id,
    required this.title,
    required this.body,
    required this.author,
    required this.scope,
    required this.postedAt,
  });

  final String id;
  final String title;
  final String body;
  final String author;
  final String scope;
  final DateTime postedAt;

  factory ChefAnnouncement.fromJson(Map<String, dynamic> json) {
    return ChefAnnouncement(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      author: json['author'] as String,
      scope: json['scope'] as String,
      postedAt: DateTime.parse(json['postedAt'] as String),
    );
  }
}

class KitchenBroadcast {
  const KitchenBroadcast({
    required this.id,
    required this.message,
    required this.author,
    required this.scope,
    required this.sentAt,
  });

  final String id;
  final String message;
  final String author;
  final String scope;
  final DateTime sentAt;

  factory KitchenBroadcast.fromJson(Map<String, dynamic> json) {
    return KitchenBroadcast(
      id: json['id'] as String,
      message: json['message'] as String,
      author: json['author'] as String,
      scope: json['scope'] as String,
      sentAt: DateTime.parse(json['sentAt'] as String),
    );
  }
}

class CommunicationAlert {
  const CommunicationAlert({
    required this.id,
    required this.type,
    required this.title,
    required this.detail,
    required this.orderId,
    required this.section,
    required this.severity,
    required this.status,
    required this.availableActions,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String detail;
  final String orderId;
  final String section;
  final String severity;
  final String status;
  final List<String> availableActions;
  final DateTime createdAt;

  factory CommunicationAlert.fromJson(Map<String, dynamic> json) {
    return CommunicationAlert(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      detail: json['detail'] as String,
      orderId: json['orderId'] as String,
      section: json['section'] as String,
      severity: json['severity'] as String,
      status: json['status'] as String,
      availableActions:
          (json['availableActions'] as List<dynamic>? ?? const [])
              .map((item) => item.toString())
              .toList(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class CommunicationStats {
  const CommunicationStats({
    required this.threads,
    required this.unreadMessages,
    required this.announcements,
    required this.broadcasts,
    required this.openAlerts,
    required this.voiceNotes,
  });

  final int threads;
  final int unreadMessages;
  final int announcements;
  final int broadcasts;
  final int openAlerts;
  final int voiceNotes;

  factory CommunicationStats.fromJson(Map<String, dynamic> json) {
    return CommunicationStats(
      threads: json['threads'] as int? ?? 0,
      unreadMessages: json['unreadMessages'] as int? ?? 0,
      announcements: json['announcements'] as int? ?? 0,
      broadcasts: json['broadcasts'] as int? ?? 0,
      openAlerts: json['openAlerts'] as int? ?? 0,
      voiceNotes: json['voiceNotes'] as int? ?? 0,
    );
  }
}

class CommunicationFeatureFlags {
  const CommunicationFeatureFlags({
    required this.waiterKitchenChat,
    required this.voiceNotes,
    required this.delayUpdates,
    required this.itemAvailabilityAlerts,
    required this.chefAnnouncements,
    required this.broadcastMessages,
    required this.outOfStockAlerts,
    required this.delayWarnings,
    required this.urgentOrderAlerts,
    required this.modificationRequests,
    required this.refireRequests,
  });

  final bool waiterKitchenChat;
  final bool voiceNotes;
  final bool delayUpdates;
  final bool itemAvailabilityAlerts;
  final bool chefAnnouncements;
  final bool broadcastMessages;
  final bool outOfStockAlerts;
  final bool delayWarnings;
  final bool urgentOrderAlerts;
  final bool modificationRequests;
  final bool refireRequests;

  factory CommunicationFeatureFlags.fromJson(Map<String, dynamic> json) {
    return CommunicationFeatureFlags(
      waiterKitchenChat: json['waiterKitchenChat'] as bool? ?? false,
      voiceNotes: json['voiceNotes'] as bool? ?? false,
      delayUpdates: json['delayUpdates'] as bool? ?? false,
      itemAvailabilityAlerts: json['itemAvailabilityAlerts'] as bool? ?? false,
      chefAnnouncements: json['chefAnnouncements'] as bool? ?? false,
      broadcastMessages: json['broadcastMessages'] as bool? ?? false,
      outOfStockAlerts: json['outOfStockAlerts'] as bool? ?? false,
      delayWarnings: json['delayWarnings'] as bool? ?? false,
      urgentOrderAlerts: json['urgentOrderAlerts'] as bool? ?? false,
      modificationRequests: json['modificationRequests'] as bool? ?? false,
      refireRequests: json['refireRequests'] as bool? ?? false,
    );
  }
}

class CommunicationActionResult {
  const CommunicationActionResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;

  factory CommunicationActionResult.fromJson(Map<String, dynamic> json) {
    return CommunicationActionResult(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String? ?? 'Communication action applied',
    );
  }
}
