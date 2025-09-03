// ===== Глобальное состояние (должно подключаться первым) =====
window.resources = ["труд","зерно","древесина","железо","рыба","хлеб","оружие","доспех","золото"];
window.enabled   = {"труд":true,"зерно":true,"древесина":true,"железо":true,"рыба":true,"хлеб":true,"оружие":true,"доспех":true,"золото":true};
window.basePrice = {"труд":1,"зерно":0.04,"древесина":0.01,"железо":0.6,"рыба":0.07,"хлеб":0.062,"оружие":8.5,"доспех":5,"золото":250};
window.elasticity= {"труд":0.7,"зерно":0.8,"древесина":0.9,"железо":1.0,"рыба":0.9,"хлеб":0.6,"оружие":1.2,"доспех":1.2,"золото":0.6};

window.manualDemand = {}; window.manualSupply = {};
resources.forEach(r=>{ manualDemand[r]=0; manualSupply[r]=0; });

window.markups = {transport:0.10, storage:0.05, risk:0.00, profit:0.10};

window.items = [];           // таблица товаров
window.contracts = [];       // контракты
window.market = {};          // биржевые параметры по itemId
window.lastPriceMap = {};    // карта текущих цен (ресурсы)
window.activeWorld = new Set();
window.activeSeasons = new Set();

// UI state для «Товары»
window.itemsSearchTerm = "";
window.itemsTypeFilter = "all";     // all | onlyResources | onlyComposite | res:<name>
window.itemsSort = "priceDesc";     // priceAsc | priceDesc | nameAsc | nameDesc
