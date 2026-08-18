class FutureAiExpansionEndpoints {
  const FutureAiExpansionEndpoints._();

  static const board = '/future-ai-expansion/board';
  static const activateAll = '/future-ai-expansion/activate-all';

  static String cookingAssistantAction(String entryId) =>
      '/future-ai-expansion/cooking-assistant/$entryId/action';

  static String roboticKitchenAction(String entryId) =>
      '/future-ai-expansion/robotic/$entryId/action';

  static String platingSuggestionAction(String entryId) =>
      '/future-ai-expansion/plating/$entryId/action';

  static String wasteReductionAction(String entryId) =>
      '/future-ai-expansion/waste/$entryId/action';

  static String prepAutomationAction(String entryId) =>
      '/future-ai-expansion/prep-automation/$entryId/action';
}
