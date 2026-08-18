class BakeryDessertEndpoints {

  const BakeryDessertEndpoints._();



  static const board = '/bakery/board';

  static const startProduction = '/bakery/production/start';

  static String jobAction(String jobId) => '/bakery/jobs/$jobId/action';

}

