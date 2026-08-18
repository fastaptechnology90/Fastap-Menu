class ExpeditorEndpoints {

  const ExpeditorEndpoints._();



  static const board = '/expeditor/board';

  static const coordinate = '/expeditor/coordinate';

  static const syncTables = '/expeditor/sync-tables';

  static String ticketAction(String ticketId) => '/expeditor/tickets/$ticketId/action';

}

