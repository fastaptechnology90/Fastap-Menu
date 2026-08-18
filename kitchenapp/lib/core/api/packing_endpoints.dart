class PackingEndpoints {

  const PackingEndpoints._();



  static const board = '/packing/board';

  static const printLabels = '/packing/labels/print';

  static String jobAction(String jobId) => '/packing/jobs/$jobId/action';

}

