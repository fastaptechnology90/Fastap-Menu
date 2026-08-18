import 'package:flutter/material.dart';

import '../../core/constants/app_colors.dart';
import '../../models/communication/kitchen_communication_snapshot.dart';
import '../../state/kitchen_command_controller.dart';
import '../../widgets/communication/communication_widgets.dart';

class KitchenCommunicationView extends StatefulWidget {
  const KitchenCommunicationView({
    super.key,
    required this.controller,
    this.embedded = false,
  });

  final KitchenCommandController controller;
  final bool embedded;

  @override
  State<KitchenCommunicationView> createState() =>
      _KitchenCommunicationViewState();
}

class _KitchenCommunicationViewState extends State<KitchenCommunicationView> {
  String? _selectedThreadId;
  final _messageController = TextEditingController();
  final _announcementTitleController = TextEditingController();
  final _announcementBodyController = TextEditingController();
  final _broadcastController = TextEditingController();

  KitchenCommandController get controller => widget.controller;

  @override
  void dispose() {
    _messageController.dispose();
    _announcementTitleController.dispose();
    _announcementBodyController.dispose();
    _broadcastController.dispose();
    super.dispose();
  }

  CommunicationThread? _selectedThread(KitchenCommunicationSnapshot snapshot) {
    if (snapshot.threads.isEmpty) {
      return null;
    }
    final id = _selectedThreadId ?? snapshot.threads.first.id;
    return snapshot.threads.firstWhere(
      (thread) => thread.id == id,
      orElse: () => snapshot.threads.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (controller.communicationLoading &&
        controller.kitchenCommunication == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    final snapshot = controller.kitchenCommunication;
    if (snapshot == null) {
      return _EmptyState(
        message: controller.communicationErrorMessage ??
            'Kitchen communication unavailable',
        onRetry: () => controller.refreshKitchenCommunication(),
      );
    }

    final selectedThread = _selectedThread(snapshot);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!widget.embedded)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'System 13 · Kitchen Communication System',
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Waiter chat · voice notes · alerts · broadcasts',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                OutlinedButton.icon(
                  onPressed: controller.communicationLoading
                      ? null
                      : () => controller.refreshKitchenCommunication(),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Refresh'),
                ),
              ],
            ),
          ),
        if (controller.communicationActionMessage != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
            ),
            child: Text(
              controller.communicationActionMessage!,
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 960;
            final chat = _ChatPanel(
              snapshot: snapshot,
              selectedThread: selectedThread,
              messageController: _messageController,
              onSelectThread: (id) => setState(() => _selectedThreadId = id),
              onSendMessage: () {
                if (selectedThread == null ||
                    _messageController.text.trim().isEmpty) {
                  return;
                }
                controller.sendKitchenMessage(
                  threadId: selectedThread.id,
                  message: _messageController.text.trim(),
                );
                _messageController.clear();
              },
              onVoiceNote: selectedThread == null
                  ? null
                  : () => controller.sendKitchenVoiceNote(
                        threadId: selectedThread.id,
                      ),
              onDelayUpdate: selectedThread == null
                  ? null
                  : () => controller.sendKitchenDelayUpdate(
                        orderId: selectedThread.orderId,
                        minutes: 5,
                      ),
            );
            final side = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CommunicationStatsPanel(
                  stats: snapshot.stats,
                  flags: snapshot.communicationFeatures,
                ),
                const SizedBox(height: 12),
                _ComposerPanel(
                  announcementTitleController: _announcementTitleController,
                  announcementBodyController: _announcementBodyController,
                  broadcastController: _broadcastController,
                  onPostAnnouncement: () {
                    controller.postChefAnnouncement(
                      title: _announcementTitleController.text.trim(),
                      body: _announcementBodyController.text.trim(),
                    );
                    _announcementTitleController.clear();
                    _announcementBodyController.clear();
                  },
                  onSendBroadcast: () {
                    controller.sendKitchenBroadcast(
                      message: _broadcastController.text.trim(),
                    );
                    _broadcastController.clear();
                  },
                ),
                const SizedBox(height: 12),
                const Text(
                  'Smart alerts',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                ...snapshot.smartAlerts.map(
                  (alert) => CommunicationAlertCard(
                    alert: alert,
                    onAction: (action) =>
                        controller.performCommunicationAlertAction(
                      alertId: alert.id,
                      action: action,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Chef announcements',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                AnnouncementList(announcements: snapshot.announcements),
                const SizedBox(height: 12),
                const Text(
                  'Broadcast messages',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 12),
                BroadcastList(broadcasts: snapshot.broadcasts),
              ],
            );

            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 3, child: chat),
                  const SizedBox(width: 16),
                  Expanded(flex: 2, child: side),
                ],
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                chat,
                const SizedBox(height: 16),
                side,
              ],
            );
          },
        ),
      ],
    );
  }
}

class _ChatPanel extends StatelessWidget {
  const _ChatPanel({
    required this.snapshot,
    required this.selectedThread,
    required this.messageController,
    required this.onSelectThread,
    required this.onSendMessage,
    required this.onVoiceNote,
    required this.onDelayUpdate,
  });

  final KitchenCommunicationSnapshot snapshot;
  final CommunicationThread? selectedThread;
  final TextEditingController messageController;
  final ValueChanged<String> onSelectThread;
  final VoidCallback onSendMessage;
  final VoidCallback? onVoiceNote;
  final VoidCallback? onDelayUpdate;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Waiter ↔ kitchen chat',
          style: TextStyle(
            color: AppColors.primaryText,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        const SizedBox(height: 12),
        ...snapshot.threads.map(
          (thread) => CommunicationThreadCard(
            thread: thread,
            selected: selectedThread?.id == thread.id,
            onTap: () => onSelectThread(thread.id),
          ),
        ),
        if (selectedThread != null) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.panelBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${selectedThread!.waiterName} · ${selectedThread!.kotNumber}',
                  style: const TextStyle(
                    color: AppColors.primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                CommunicationMessageList(messages: selectedThread!.messages),
                const SizedBox(height: 12),
                TextField(
                  controller: messageController,
                  decoration: const InputDecoration(
                    labelText: 'Reply to waiter',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => onSendMessage(),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton(
                      onPressed: onSendMessage,
                      child: const Text('Send message'),
                    ),
                    OutlinedButton.icon(
                      onPressed: onVoiceNote,
                      icon: const Icon(Icons.mic_outlined, size: 18),
                      label: const Text('Voice note'),
                    ),
                    OutlinedButton.icon(
                      onPressed: onDelayUpdate,
                      icon: const Icon(Icons.schedule, size: 18),
                      label: const Text('Delay +5 min'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ComposerPanel extends StatelessWidget {
  const _ComposerPanel({
    required this.announcementTitleController,
    required this.announcementBodyController,
    required this.broadcastController,
    required this.onPostAnnouncement,
    required this.onSendBroadcast,
  });

  final TextEditingController announcementTitleController;
  final TextEditingController announcementBodyController;
  final TextEditingController broadcastController;
  final VoidCallback onPostAnnouncement;
  final VoidCallback onSendBroadcast;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Post announcement',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: announcementTitleController,
            decoration: const InputDecoration(
              labelText: 'Title',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: announcementBodyController,
            decoration: const InputDecoration(
              labelText: 'Message',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onPostAnnouncement,
            child: const Text('Post chef announcement'),
          ),
          const SizedBox(height: 16),
          const Text(
            'Broadcast message',
            style: TextStyle(
              color: AppColors.primaryText,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: broadcastController,
            decoration: const InputDecoration(
              labelText: 'Broadcast to all sections',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: onSendBroadcast,
            child: const Text('Send broadcast'),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, style: const TextStyle(color: AppColors.secondaryText)),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
